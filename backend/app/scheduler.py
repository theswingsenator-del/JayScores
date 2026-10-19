"""APScheduler jobs: daily pull+refit+predict, live polling for featured matches."""
import logging

from apscheduler.schedulers.background import BackgroundScheduler

from . import config
from .database import SessionLocal
from .models import Fixture
from .services import data_pull, predictions

log = logging.getLogger("jayscores.sched")


def daily_job():
    db = SessionLocal()
    try:
        log.info("Daily job start")
        data_pull.daily_pull(db)
        predictions.refit_all(db)
        predictions.generate_prematch(db)
        n = predictions.evaluate_finished(db)
        log.info("Daily job done. Evaluated %d finished fixtures.", n)
        # Basketball: rolling window pull + refit on its own separate quota.
        from . import basketball
        from datetime import datetime, timedelta, timezone
        for delta in (-1, 0, 1):
            day = (datetime.now(timezone.utc) + timedelta(days=delta)).strftime("%Y-%m-%d")
            data = basketball._guarded_get(db, "/games", {"date": day})
            basketball._upsert_games(db, data)
        for lid in basketball.BBALL_LEAGUES:
            try:
                basketball.fit_league(db, lid)
            except Exception as e:
                log.info("Basketball refit skipped for league %s: %s", lid, e)
        log.info("Basketball daily pull+refit done.")
    except Exception:
        log.exception("Daily job failed")
    finally:
        db.close()


def live_job():
    """Runs every LIVE_POLL_SECONDS; no-op unless a featured match is in play."""
    db = SessionLocal()
    try:
        live = (db.query(Fixture)
                .filter(Fixture.is_featured.is_(True),
                        Fixture.status.in_(data_pull.LIVE))
                .limit(2)  # quota guard: max 2 concurrent featured matches
                .all())
        if not live:
            return
        # Refresh live scores with ONE call, then per-match stats
        try:
            from . import api_client
            data = api_client.get_live_fixtures(db)
            by_id = {item["fixture"]["id"]: item for item in data.get("response", [])}
            for f in live:
                item = by_id.get(f.id)
                if item:
                    f.home_goals = item["goals"]["home"]
                    f.away_goals = item["goals"]["away"]
                    f.minute = item["fixture"]["status"].get("elapsed")
                    f.status = item["fixture"]["status"]["short"]
            db.commit()
        except Exception:
            log.exception("Live score refresh failed")
        for f in live:
            predictions.update_live_prediction(db, f)
    except Exception:
        log.exception("Live job failed")
    finally:
        db.close()


def start_scheduler() -> BackgroundScheduler:
    sched = BackgroundScheduler(timezone="UTC")
    sched.add_job(daily_job, "cron", hour=4, minute=30, id="daily")
    sched.add_job(live_job, "interval", seconds=config.LIVE_POLL_SECONDS, id="live")
    sched.start()
    log.info("Scheduler started (daily 04:30 UTC, live every %ds)", config.LIVE_POLL_SECONDS)
    return sched
