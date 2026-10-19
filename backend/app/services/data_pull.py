"""Data ingestion from API-Football into the local DB.

Quota discipline: one /fixtures call per league+season returns EVERYTHING
(teams appear inside fixture payloads too), so a full daily refresh for 3
leagues costs 3 requests.
"""
import logging
from datetime import datetime

from sqlalchemy.orm import Session

from .. import api_client, config
from ..models import Fixture, Team, TeamStats

log = logging.getLogger("jayscores.pull")

FINISHED = {"FT", "AET", "PEN"}
LIVE = {"1H", "HT", "2H", "ET", "BT", "P", "LIVE"}


def _parse_dt(iso: str) -> datetime:
    return datetime.fromisoformat(iso.replace("Z", "+00:00")).replace(tzinfo=None)


def upsert_team(db: Session, seen: set[int], tid: int, name: str, league_id: int, logo: str | None):
    if tid in seen:
        return
    seen.add(tid)
    team = db.get(Team, tid)
    if team is None:
        db.add(Team(id=tid, name=name, league_id=league_id, logo=logo))
        db.flush()  # make it visible to db.get within this transaction
    else:
        team.name, team.logo = name, logo or team.logo


def pull_league_season(db: Session, league_id: int, season: int) -> int:
    """Bulk-pull all fixtures for a league+season (1 API request)."""
    data = api_client.get_fixtures(db, league_id, season)
    count = 0
    seen: set[int] = set()
    for item in data.get("response", []):
        fx = item["fixture"]
        teams = item["teams"]
        goals = item["goals"]

        upsert_team(db, seen, teams["home"]["id"], teams["home"]["name"], league_id, teams["home"].get("logo"))
        upsert_team(db, seen, teams["away"]["id"], teams["away"]["name"], league_id, teams["away"].get("logo"))

        row = db.get(Fixture, fx["id"])
        vals = dict(
            league_id=league_id, season=season,
            home_id=teams["home"]["id"], away_id=teams["away"]["id"],
            date=_parse_dt(fx["date"]), status=fx["status"]["short"],
            home_goals=goals["home"], away_goals=goals["away"],
            minute=fx["status"].get("elapsed"),
        )
        if row is None:
            db.add(Fixture(id=fx["id"], **vals))
        else:
            for k, v in vals.items():
                setattr(row, k, v)
        count += 1
    db.commit()
    log.info("Pulled %d fixtures for league %d season %d", count, league_id, season)
    return count


def rebuild_team_stats(db: Session, season: int) -> None:
    """Recompute aggregate team stats from finished fixtures in the DB (0 API calls)."""
    fixtures = (db.query(Fixture)
                .filter(Fixture.season == season, Fixture.status.in_(FINISHED),
                        Fixture.home_goals.isnot(None))
                .all())
    stats: dict[int, dict] = {}

    def s(tid):
        return stats.setdefault(tid, dict(matches=0, goals_for=0, goals_against=0,
                                          home_gf=0, home_ga=0, away_gf=0, away_ga=0))

    for f in fixtures:
        h, a = s(f.home_id), s(f.away_id)
        h["matches"] += 1; a["matches"] += 1
        h["goals_for"] += f.home_goals; h["goals_against"] += f.away_goals
        a["goals_for"] += f.away_goals; a["goals_against"] += f.home_goals
        h["home_gf"] += f.home_goals; h["home_ga"] += f.away_goals
        a["away_gf"] += f.away_goals; a["away_ga"] += f.home_goals

    for tid, v in stats.items():
        row = db.query(TeamStats).filter_by(team_id=tid, season=season).first()
        if row is None:
            row = TeamStats(team_id=tid, season=season)
            db.add(row)
        for k, val in v.items():
            setattr(row, k, val)
    db.commit()


def store_fixture_item(db: Session, item: dict, seen: set[int]) -> bool:
    """Upsert one API fixture payload. Returns True if it belongs to a
    configured league (and was stored)."""
    league = item.get("league", {})
    lid = league.get("id")
    if lid not in config.LEAGUE_IDS:
        return False
    fx = item["fixture"]
    teams = item["teams"]
    goals = item["goals"]

    upsert_team(db, seen, teams["home"]["id"], teams["home"]["name"], lid, teams["home"].get("logo"))
    upsert_team(db, seen, teams["away"]["id"], teams["away"]["name"], lid, teams["away"].get("logo"))

    row = db.get(Fixture, fx["id"])
    vals = dict(
        league_id=lid, season=league.get("season") or config.LEAGUE_SEASONS.get(lid, config.DEFAULT_SEASON),
        home_id=teams["home"]["id"], away_id=teams["away"]["id"],
        date=_parse_dt(fx["date"]), status=fx["status"]["short"],
        home_goals=goals["home"], away_goals=goals["away"],
        minute=fx["status"].get("elapsed"),
    )
    if row is None:
        db.add(Fixture(id=fx["id"], **vals))
    else:
        for k, v in vals.items():
            setattr(row, k, v)
    return True


def pull_date_window(db: Session, days: tuple[int, ...] = (-1, 0, 1)) -> dict:
    """Pull fixtures by DATE for yesterday/today/tomorrow (3 API calls).

    This is how future fixtures reach the DB: the free plan blocks bulk pulls
    of current seasons but serves a rolling yesterday..tomorrow date window,
    World Cup 2026 included. Each daily run slides the window forward, so
    upcoming games (status NS) accumulate ahead of kickoff and results
    backfill behind it.
    """
    from datetime import date, timedelta as td

    stored = {}
    seen: set[int] = set()
    for off in days:
        day = (date.today() + td(days=off)).isoformat()
        try:
            data = api_client.get_fixtures_by_date(db, day)
        except api_client.QuotaExceeded as e:
            log.warning("Quota hit during date pull: %s", e)
            break
        if data.get("errors"):
            stored[day] = 0
            continue
        n = sum(store_fixture_item(db, item, seen) for item in data.get("response", []))
        stored[day] = n
        log.info("Date pull %s: stored %d fixtures for configured leagues", day, n)
    db.commit()
    return stored


def daily_pull(db: Session, season: int | None = None) -> dict:
    """Daily refresh:
    1. Rolling date-window pull (3 calls) — brings in upcoming fixtures + fresh results.
    2. One-time season backfill per league if its history is missing (seed usually
       covers this; 0 extra calls afterwards).
    """
    dated = pull_date_window(db)

    pulled = {}
    seasons_touched = set()
    for lid in config.LEAGUE_IDS:
        for hist_season in config.HISTORY_SEASONS.get(lid, []):
            have = (db.query(Fixture.id)
                    .filter(Fixture.league_id == lid, Fixture.season == hist_season)
                    .first())
            if have:
                continue  # history already in DB — no API spend
            try:
                pulled[lid] = pull_league_season(db, lid, hist_season)
                seasons_touched.add(hist_season)
            except api_client.QuotaExceeded as e:
                log.warning("Quota hit during pull: %s", e)
                pulled[lid] = -1
                break

    for s in seasons_touched | {config.LEAGUE_SEASONS.get(lid) for lid in config.LEAGUE_IDS}:
        if s:
            rebuild_team_stats(db, s)
    return {"dated": dated, "backfilled": pulled,
            "quota_remaining": api_client.requests_remaining(db)}
