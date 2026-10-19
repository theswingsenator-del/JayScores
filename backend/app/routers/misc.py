"""Leagues, team form, accuracy endpoints."""
import json
from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import or_
from sqlalchemy.orm import Session

from .. import config
from ..database import get_db
from ..models import AccuracyLog, Fixture, ModelParams, Team
from ..schemas import AccuracyOut, AccuracyPoint, FormEntry, LeagueOut, TeamFormOut, TeamOut
from ..services.data_pull import FINISHED

router = APIRouter(tags=["misc"])


@router.get("/leagues", response_model=list[LeagueOut])
def leagues():
    return [LeagueOut(id=lid, name=config.LEAGUE_NAMES.get(lid, f"League {lid}"))
            for lid in config.LEAGUE_IDS]


@router.get("/teams/{team_id}/form", response_model=TeamFormOut)
def team_form(team_id: int, db: Session = Depends(get_db)):
    team = db.get(Team, team_id)
    if team is None:
        raise HTTPException(404, "Team not found")

    recent_fx = (db.query(Fixture)
                 .filter(or_(Fixture.home_id == team_id, Fixture.away_id == team_id),
                         Fixture.status.in_(FINISHED), Fixture.home_goals.isnot(None))
                 .order_by(Fixture.date.desc()).limit(8).all())
    entries = []
    for f in recent_fx:
        home = f.home_id == team_id
        gf = f.home_goals if home else f.away_goals
        ga = f.away_goals if home else f.home_goals
        opp = db.get(Team, f.away_id if home else f.home_id)
        entries.append(FormEntry(
            fixture_id=f.id, date=f.date, opponent=opp.name if opp else "?",
            home=home, goals_for=gf, goals_against=ga,
            result="W" if gf > ga else ("L" if gf < ga else "D"),
        ))

    attack = defense = None
    row = (db.query(ModelParams).filter_by(league_id=team.league_id)
           .order_by(ModelParams.fitted_at.desc()).first())
    if row:
        p = json.loads(row.param_json)
        attack = p["attack"].get(str(team_id))
        defense = p["defense"].get(str(team_id))

    return TeamFormOut(team=TeamOut.model_validate(team),
                       attack=attack, defense=defense, recent=entries)


@router.get("/accuracy", response_model=AccuracyOut)
def accuracy(db: Session = Depends(get_db)):
    logs = db.query(AccuracyLog).order_by(AccuracyLog.evaluated_at).all()
    if not logs:
        return AccuracyOut(total_evaluated=0, overall_outcome_acc=None, points=[])

    buckets: dict[str, list[AccuracyLog]] = defaultdict(list)
    for l in logs:
        buckets[l.evaluated_at.strftime("%Y-%m")].append(l)

    points = []
    for period in sorted(buckets):
        rows = buckets[period]
        n = len(rows)
        points.append(AccuracyPoint(
            period=period, n=n,
            outcome_acc=sum(r.outcome_correct for r in rows) / n,
            scoreline_acc=sum(r.scoreline_correct for r in rows) / n,
            over25_acc=sum(r.over25_correct for r in rows) / n,
            btts_acc=sum(r.btts_correct for r in rows) / n,
            brier=sum(r.brier_outcome for r in rows) / n,
        ))
    return AccuracyOut(
        total_evaluated=len(logs),
        overall_outcome_acc=sum(l.outcome_correct for l in logs) / len(logs),
        points=points,
    )
