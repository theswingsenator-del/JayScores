"""Basketball vertical: API client, ratings model, and router in one module.

Mirrors the football architecture on the separate api-sports basketball API
(its own 100/day free quota, counted apart from football via the "bball:"
endpoint prefix in api_request_log). Bulk season pulls work for 2022-2024;
current games arrive through the rolling yesterday..tomorrow date window.

Model: weighted ridge least-squares team ratings.
  home_pts = mu + off_home - def_away + home_adv
  away_pts = mu + off_away - def_home
Win probability from a normal approximation on the predicted point diff.
"""
import json
import logging
import math
from datetime import datetime, timedelta, timezone

import numpy as np
import requests as http
from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import Boolean, Column, DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Session

from . import config
from .database import Base, get_db
from .models import ApiRequestLog, ModelParams

log = logging.getLogger("jayscores.bball")

BASE_URL = "https://v1.basketball.api-sports.io"
HEADERS = {"x-apisports-key": config.API_FOOTBALL_KEY}

# Tracked leagues. NBA seasons are "2023-2024" strings; WNBA/World Cup are years.
BBALL_LEAGUES = {12: "NBA", 13: "WNBA", 281: "FIBA WC Qualifiers"}
BBALL_HISTORY_SEASONS = {12: ["2023-2024"], 13: ["2023", "2024"], 281: ["2023"]}
# ModelParams is shared with football — offset avoids league-id collisions.
PARAMS_LEAGUE_OFFSET = 100_000
POINT_DIFF_SD_FLOOR = 8.0


# ---- tables ------------------------------------------------------------------

class BballGame(Base):
    __tablename__ = "bball_games"

    id = Column(Integer, primary_key=True)  # api-sports game id
    league_id = Column(Integer, nullable=False, index=True)
    season = Column(String(12), nullable=False)
    date = Column(DateTime, nullable=False, index=True)
    status = Column(String(10), nullable=False, default="NS")
    home_id = Column(Integer, nullable=False)
    home_name = Column(String(120), nullable=False)
    home_logo = Column(String(300), nullable=True)
    away_id = Column(Integer, nullable=False)
    away_name = Column(String(120), nullable=False)
    away_logo = Column(String(300), nullable=True)
    home_pts = Column(Integer, nullable=True)
    away_pts = Column(Integer, nullable=True)


# ---- quota-guarded client ----------------------------------------------------

def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _bball_requests_remaining(db: Session) -> int:
    used = (db.query(func.count(ApiRequestLog.id))
            .filter(ApiRequestLog.date == _today(),
                    ApiRequestLog.endpoint.like("bball:%")).scalar() or 0)
    return max(0, config.DAILY_API_QUOTA - config.QUOTA_SAFETY_MARGIN - used)


def _guarded_get(db: Session, path: str, params: dict) -> dict:
    remaining = _bball_requests_remaining(db)
    if remaining <= 0:
        raise HTTPException(429, "Basketball API daily quota reached.")
    db.add(ApiRequestLog(date=_today(), endpoint=f"bball:{path}"))
    db.commit()
    log.info("BBALL GET %s %s (remaining after: %d)", path, params, remaining - 1)
    if not config.VERIFY_SSL:
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    resp = http.get(f"{BASE_URL}{path}", headers=HEADERS, params=params,
                    timeout=30, verify=config.VERIFY_SSL)
    resp.raise_for_status()
    data = resp.json()
    if data.get("errors"):
        log.error("BBALL API error on %s: %s", path, data["errors"])
    return data


def _upsert_games(db: Session, payload: dict, only_leagues: bool = True) -> int:
    n = 0
    for g in payload.get("response", []):
        lid = g["league"]["id"]
        if only_leagues and lid not in BBALL_LEAGUES:
            continue
        row = db.get(BballGame, g["id"]) or BballGame(id=g["id"])
        row.league_id = lid
        row.season = str(g["league"]["season"])
        row.date = datetime.fromisoformat(g["date"]).replace(tzinfo=None)
        row.status = g["status"]["short"]
        row.home_id = g["teams"]["home"]["id"]
        row.home_name = g["teams"]["home"]["name"]
        row.home_logo = g["teams"]["home"]["logo"]
        row.away_id = g["teams"]["away"]["id"]
        row.away_name = g["teams"]["away"]["name"]
        row.away_logo = g["teams"]["away"]["logo"]
        row.home_pts = g["scores"]["home"]["total"]
        row.away_pts = g["scores"]["away"]["total"]
        db.merge(row)
        n += 1
    db.commit()
    return n


# ---- ratings model -----------------------------------------------------------

def fit_league(db: Session, league_id: int) -> dict:
    games = (db.query(BballGame)
             .filter(BballGame.league_id == league_id,
                     BballGame.status == "FT",
                     BballGame.home_pts.isnot(None))
             .order_by(BballGame.date).all())
    if len(games) < 20:
        raise HTTPException(400, f"Not enough finished games to fit ({len(games)}).")

    teams = sorted({g.home_id for g in games} | {g.away_id for g in games})
    idx = {t: i for i, t in enumerate(teams)}
    n = len(teams)
    now = datetime.utcnow()
    xi = math.log(2) / 365.0  # 1-year half-life: rosters churn season to season

    # Design matrix: columns = [off(n), def(n), mu, home_adv]
    rows, ys, ws = [], [], []
    for g in games:
        w = math.exp(-xi * max((now - g.date).days, 0))
        h, a = idx[g.home_id], idx[g.away_id]
        r1 = np.zeros(2 * n + 2); r1[h] = 1; r1[n + a] = -1; r1[2 * n] = 1; r1[2 * n + 1] = 1
        rows.append(r1); ys.append(g.home_pts); ws.append(w)
        r2 = np.zeros(2 * n + 2); r2[a] = 1; r2[n + h] = -1; r2[2 * n] = 1
        rows.append(r2); ys.append(g.away_pts); ws.append(w)

    X = np.array(rows); y = np.array(ys, dtype=float); w = np.array(ws)
    Xw = X * w[:, None]
    ridge = np.eye(2 * n + 2) * 2.0
    ridge[2 * n, 2 * n] = ridge[2 * n + 1, 2 * n + 1] = 1e-6  # don't shrink mu/hadv
    beta = np.linalg.solve(Xw.T @ X + ridge, Xw.T @ y)

    resid_diff = []
    for g in games:
        h, a = idx[g.home_id], idx[g.away_id]
        eh = beta[2 * n] + beta[2 * n + 1] + beta[h] - beta[n + a]
        ea = beta[2 * n] + beta[a] - beta[n + h]
        resid_diff.append((g.home_pts - g.away_pts) - (eh - ea))
    sd = max(float(np.std(resid_diff)), POINT_DIFF_SD_FLOOR)

    params = {
        "model": "bball-ratings",
        "off": {str(t): float(beta[idx[t]]) for t in teams},
        "def": {str(t): float(beta[n + idx[t]]) for t in teams},
        "mu": float(beta[2 * n]),
        "home_adv": float(beta[2 * n + 1]),
        "sd_diff": sd,
        "n_games": len(games),
    }
    db.add(ModelParams(league_id=PARAMS_LEAGUE_OFFSET + league_id, season=now.year,
                       model_version=f"bball-{now:%Y%m%d}", param_json=json.dumps(params)))
    db.commit()
    return params


def _load_params(db: Session, league_id: int) -> dict | None:
    row = (db.query(ModelParams)
           .filter_by(league_id=PARAMS_LEAGUE_OFFSET + league_id)
           .order_by(ModelParams.fitted_at.desc()).first())
    return json.loads(row.param_json) if row else None


def _predict(params: dict, home_id: int, away_id: int) -> dict:
    mu, hadv, sd = params["mu"], params["home_adv"], params["sd_diff"]
    oh = params["off"].get(str(home_id), 0.0); dh = params["def"].get(str(home_id), 0.0)
    oa = params["off"].get(str(away_id), 0.0); da = params["def"].get(str(away_id), 0.0)
    eh = mu + hadv + oh - da
    ea = mu + oa - dh
    z = (eh - ea) / sd
    p_home = 0.5 * (1 + math.erf(z / math.sqrt(2)))
    return {
        "exp_home_pts": round(eh, 1),
        "exp_away_pts": round(ea, 1),
        "exp_total": round(eh + ea, 1),
        "p_home_win": round(p_home, 4),
        "p_away_win": round(1 - p_home, 4),
    }


# ---- schemas -----------------------------------------------------------------

class BballTeamOut(BaseModel):
    id: int
    name: str
    logo: str | None


class BballPredictionOut(BaseModel):
    exp_home_pts: float
    exp_away_pts: float
    exp_total: float
    p_home_win: float
    p_away_win: float


class BballGameOut(BaseModel):
    id: int
    league_id: int
    league_name: str
    date: datetime
    status: str
    home: BballTeamOut
    away: BballTeamOut
    home_pts: int | None
    away_pts: int | None
    prediction: BballPredictionOut | None = None


# ---- router ------------------------------------------------------------------

router = APIRouter(prefix="/basketball", tags=["basketball"])


@router.get("/leagues")
def bball_leagues():
    return [{"id": k, "name": v} for k, v in BBALL_LEAGUES.items()]


@router.get("/games", response_model=list[BballGameOut])
def bball_games(league: int | None = Query(None), db: Session = Depends(get_db)):
    now = datetime.utcnow()
    q = db.query(BballGame).filter(BballGame.date >= now - timedelta(days=10),
                                   BballGame.date <= now + timedelta(days=14))
    if league:
        q = q.filter(BballGame.league_id == league)
    games = q.order_by(BballGame.date).limit(120).all()

    params_cache: dict[int, dict | None] = {}
    out = []
    for g in games:
        if g.league_id not in params_cache:
            params_cache[g.league_id] = _load_params(db, g.league_id)
        p = params_cache[g.league_id]
        out.append(BballGameOut(
            id=g.id, league_id=g.league_id,
            league_name=BBALL_LEAGUES.get(g.league_id, "Basketball"),
            date=g.date, status=g.status,
            home=BballTeamOut(id=g.home_id, name=g.home_name, logo=g.home_logo),
            away=BballTeamOut(id=g.away_id, name=g.away_name, logo=g.away_logo),
            home_pts=g.home_pts, away_pts=g.away_pts,
            prediction=BballPredictionOut(**_predict(p, g.home_id, g.away_id)) if p else None,
        ))
    return out


def _require_admin(x_admin_token: str = Header(...)):
    if x_admin_token != config.ADMIN_TOKEN:
        raise HTTPException(401, "Bad admin token")


@router.post("/admin/seed", dependencies=[Depends(_require_admin)])
def bball_seed(db: Session = Depends(get_db)):
    """One-time backfill: pull historical seasons for every tracked league."""
    pulled = {}
    for lid, seasons in BBALL_HISTORY_SEASONS.items():
        for season in seasons:
            data = _guarded_get(db, "/games", {"league": lid, "season": season})
            pulled[f"{lid}:{season}"] = _upsert_games(db, data)
    return {"pulled": pulled}


@router.post("/admin/pull-window", dependencies=[Depends(_require_admin)])
def bball_pull_window(db: Session = Depends(get_db)):
    """Daily rolling pull: yesterday, today, tomorrow (3 requests)."""
    pulled = {}
    for delta in (-1, 0, 1):
        day = (datetime.now(timezone.utc) + timedelta(days=delta)).strftime("%Y-%m-%d")
        data = _guarded_get(db, "/games", {"date": day})
        pulled[day] = _upsert_games(db, data)
    return {"pulled": pulled}


@router.post("/admin/refit", dependencies=[Depends(_require_admin)])
def bball_refit(db: Session = Depends(get_db)):
    fitted = {}
    for lid in BBALL_LEAGUES:
        try:
            p = fit_league(db, lid)
            fitted[lid] = {"n_games": p["n_games"], "sd_diff": round(p["sd_diff"], 2)}
        except HTTPException as e:
            fitted[lid] = str(e.detail)
    return {"fitted": fitted}
