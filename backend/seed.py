"""Backfill historical results for the configured leagues.

Quota-aware: one /fixtures call per league+season. Default backfills 2 seasons
per league = 6 requests total for 3 leagues. If quota runs out, rerun tomorrow —
already-pulled data is skipped implicitly (upserts).

Usage:
    python seed.py                 # seasons 2024+2025 for all configured leagues
    python seed.py --seasons 2023 2024 2025
"""
import argparse
import logging

from app import config
from app.api_client import QuotaExceeded, requests_remaining
from app.database import Base, SessionLocal, engine
from app.services import data_pull, predictions

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger("seed")


def main(seasons: list[int]):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        for lid in config.LEAGUE_IDS:
            # World Cup (id=1): only its edition season matters
            lid_seasons = [config.LEAGUE_SEASONS[lid]] if lid == 1 else seasons
            for season in lid_seasons:
                try:
                    data_pull.pull_league_season(db, lid, season)
                except QuotaExceeded:
                    log.warning("Quota exhausted. Rerun seed tomorrow to continue.")
                    return
        for season in set(seasons) | {config.LEAGUE_SEASONS[1]}:
            data_pull.rebuild_team_stats(db, season)

        log.info("Fitting models...")
        predictions.refit_all(db)
        predictions.generate_prematch(db)
        predictions.backtest_predictions(db)
        predictions.evaluate_finished(db)
        log.info("Seed complete. API quota remaining today: %d", requests_remaining(db))
    finally:
        db.close()


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--seasons", type=int, nargs="+",
                    default=[config.DEFAULT_SEASON])  # free plan: 2022-2024 only
    args = ap.parse_args()
    main(args.seasons)
