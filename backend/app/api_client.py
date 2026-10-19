"""API-Football client with a hard daily quota guard.

Every outbound request is logged to api_request_log. Before each call we count
today's rows; at or beyond (DAILY_API_QUOTA - QUOTA_SAFETY_MARGIN) the call is
refused with QuotaExceeded. This makes it impossible for any code path to blow
the 100/day free-tier cap.
"""
import logging
from datetime import datetime, timezone

import requests
from sqlalchemy import func
from sqlalchemy.orm import Session

from . import config
from .models import ApiRequestLog

log = logging.getLogger("jayscores.api")

BASE_URL = f"https://{config.API_FOOTBALL_HOST}"
HEADERS = {"x-apisports-key": config.API_FOOTBALL_KEY}


class QuotaExceeded(Exception):
    pass


def _today() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def requests_used_today(db: Session) -> int:
    return db.query(func.count(ApiRequestLog.id)).filter(ApiRequestLog.date == _today()).scalar() or 0


def requests_remaining(db: Session) -> int:
    return max(0, config.DAILY_API_QUOTA - config.QUOTA_SAFETY_MARGIN - requests_used_today(db))


def _guarded_get(db: Session, path: str, params: dict | None = None) -> dict:
    remaining = requests_remaining(db)
    if remaining <= 0:
        raise QuotaExceeded(f"Daily API quota reached ({config.DAILY_API_QUOTA}/day). Try tomorrow.")

    db.add(ApiRequestLog(date=_today(), endpoint=path))
    db.commit()

    log.info("API GET %s params=%s (quota remaining after this: %d)", path, params, remaining - 1)
    if not config.VERIFY_SSL:
        import urllib3
        urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    resp = requests.get(f"{BASE_URL}{path}", headers=HEADERS, params=params or {},
                        timeout=30, verify=config.VERIFY_SSL)
    resp.raise_for_status()
    data = resp.json()
    if data.get("errors"):
        # API-Football returns errors inside a 200 body
        log.error("API error on %s: %s", path, data["errors"])
    return data


# ---- typed endpoint wrappers -------------------------------------------------

def get_leagues(db: Session, league_id: int) -> dict:
    return _guarded_get(db, "/leagues", {"id": league_id})


def get_teams(db: Session, league_id: int, season: int) -> dict:
    return _guarded_get(db, "/teams", {"league": league_id, "season": season})


def get_fixtures(db: Session, league_id: int, season: int) -> dict:
    """One call returns ALL fixtures for a league+season — the bulk pull."""
    return _guarded_get(db, "/fixtures", {"league": league_id, "season": season})


def get_fixtures_by_date(db: Session, day: str) -> dict:
    """All fixtures worldwide on a date (YYYY-MM-DD). Free plan serves a
    rolling yesterday..tomorrow window — our path to future fixtures."""
    return _guarded_get(db, "/fixtures", {"date": day})


def get_live_fixtures(db: Session) -> dict:
    return _guarded_get(db, "/fixtures", {"live": "all"})


def get_fixture_statistics(db: Session, fixture_id: int) -> dict:
    return _guarded_get(db, "/fixtures/statistics", {"fixture": fixture_id})


def get_api_predictions(db: Session, fixture_id: int) -> dict:
    """API-Football's own prediction — stored as an extra feature only."""
    return _guarded_get(db, "/predictions", {"fixture": fixture_id})
