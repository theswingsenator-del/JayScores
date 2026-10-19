"""Model fitting, pre-match + live prediction generation, accuracy evaluation."""
import json
import logging
from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from .. import api_client, config
from ..models import AccuracyLog, Fixture, ModelParams, Prediction
from ..predictor import DixonColesPredictor, MatchResult, live_adjusted_prediction
from .data_pull import FINISHED, LIVE

log = logging.getLogger("jayscores.predict")


def _version() -> str:
    return "dc-" + datetime.utcnow().strftime("%Y%m%d%H%M")


# ---- fitting ----------------------------------------------------------------

def refit_league(db: Session, league_id: int, season: int) -> ModelParams | None:
    """Fit on ALL stored seasons of the league — exponential time-decay makes
    old seasons nearly weightless, but they keep tournament teams (e.g. World
    Cup nations) in the parameter set between editions."""
    results = [
        MatchResult(f.home_id, f.away_id, f.home_goals, f.away_goals, f.date)
        for f in db.query(Fixture)
        .filter(Fixture.league_id == league_id,
                Fixture.status.in_(FINISHED), Fixture.home_goals.isnot(None))
        .all()
    ]
    if len(results) < 20:
        log.warning("League %d: only %d results — skipping fit", league_id, len(results))
        return None

    half_life = config.LEAGUE_HALF_LIFE.get(league_id, config.DECAY_HALF_LIFE_DAYS)
    model = DixonColesPredictor(half_life_days=half_life)
    params = model.fit(results)
    row = ModelParams(league_id=league_id, season=season,
                      model_version=_version(), param_json=json.dumps(params))
    db.add(row)
    db.commit()
    log.info("Refit league %d: %d matches, home_adv=%.3f rho=%.3f",
             league_id, len(results), params["home_adv"], params["rho"])
    return row


def refit_all(db: Session, season: int | None = None) -> list[str]:
    versions = []
    for lid in config.LEAGUE_IDS:
        lg_season = season or config.LEAGUE_SEASONS.get(lid, config.DEFAULT_SEASON)
        row = refit_league(db, lid, lg_season)
        if row:
            versions.append(row.model_version)
    return versions


def load_model(db: Session, league_id: int, season: int) -> tuple[DixonColesPredictor, str] | None:
    row = (db.query(ModelParams)
           .filter_by(league_id=league_id, season=season)
           .order_by(ModelParams.fitted_at.desc())
           .first())
    if row is None:
        return None
    model = DixonColesPredictor()
    model.load_params(json.loads(row.param_json))
    return model, row.model_version


# ---- pre-match predictions ---------------------------------------------------

def generate_prematch(db: Session, season: int | None = None,
                      days_ahead: int = 14) -> int:
    """Predict all upcoming fixtures in the window that lack a fresh prediction."""
    now = datetime.utcnow()
    horizon = now + timedelta(days=days_ahead)
    made = 0
    for lid in config.LEAGUE_IDS:
        lg_season = season or config.LEAGUE_SEASONS.get(lid, config.DEFAULT_SEASON)
        loaded = load_model(db, lid, lg_season)
        if loaded is None:
            continue
        model, version = loaded
        # No season filter: upcoming fixtures may carry a newer season tag than
        # the fitted history (e.g. WC 2026 predicted off 2022+2026 results).
        upcoming = (db.query(Fixture)
                    .filter(Fixture.league_id == lid,
                            Fixture.status == "NS",
                            Fixture.date >= now, Fixture.date <= horizon)
                    .all())
        for f in upcoming:
            latest = (db.query(Prediction).filter_by(fixture_id=f.id, is_live=False)
                      .order_by(Prediction.ts.desc()).first())
            if latest and latest.model_version == version:
                continue  # already predicted with current model
            try:
                out = model.predict(f.home_id, f.away_id)
            except KeyError:
                continue  # promoted team with no data yet
            db.add(Prediction(
                fixture_id=f.id, model_version=version,
                pred_home_goals=out.lambda_home, pred_away_goals=out.lambda_away,
                p_home_win=out.p_home_win, p_draw=out.p_draw, p_away_win=out.p_away_win,
                p_over25=out.p_over25, p_btts=out.p_btts,
                likely_scoreline=out.likely_scoreline, is_live=False, is_locked=False,
            ))
            made += 1
    db.commit()
    log.info("Generated %d pre-match predictions", made)
    return made


def backtest_predictions(db: Session, per_league: int = 400) -> int:
    """Predict finished fixtures that have no prediction yet, using the current
    fitted model. Fills fixture cards + accuracy history when the data plan has
    no future fixtures (free tier serves past seasons only). In-sample by
    nature — accuracy figures from this are optimistic vs true out-of-sample.
    """
    made = 0
    for lid in config.LEAGUE_IDS:
        lg_season = config.LEAGUE_SEASONS.get(lid, config.DEFAULT_SEASON)
        loaded = load_model(db, lid, lg_season)
        if loaded is None:
            continue
        model, version = loaded
        finished = (db.query(Fixture)
                    .filter(Fixture.league_id == lid, Fixture.season == lg_season,
                            Fixture.status.in_(FINISHED), Fixture.home_goals.isnot(None))
                    .order_by(Fixture.date.desc()).limit(per_league).all())
        for f in finished:
            if db.query(Prediction.id).filter_by(fixture_id=f.id).first():
                continue
            try:
                out = model.predict(f.home_id, f.away_id)
            except KeyError:
                continue
            db.add(Prediction(
                fixture_id=f.id, model_version=version,
                pred_home_goals=out.lambda_home, pred_away_goals=out.lambda_away,
                p_home_win=out.p_home_win, p_draw=out.p_draw, p_away_win=out.p_away_win,
                p_over25=out.p_over25, p_btts=out.p_btts,
                likely_scoreline=out.likely_scoreline, is_live=False, is_locked=False,
            ))
            made += 1
    db.commit()
    log.info("Backtest predictions created: %d", made)
    return made


# ---- live predictions --------------------------------------------------------

def _extract_stat(stats_resp: dict, team_id: int, name: str):
    for block in stats_resp.get("response", []):
        if block["team"]["id"] == team_id:
            for s in block.get("statistics", []):
                if s["type"] == name:
                    return s["value"]
    return None


def update_live_prediction(db: Session, fixture: Fixture) -> Prediction | None:
    """One live poll for a featured in-play fixture."""
    last = (db.query(Prediction).filter_by(fixture_id=fixture.id)
            .order_by(Prediction.ts.desc()).first())
    if last and last.is_locked:
        return None  # frozen

    pre = (db.query(Prediction).filter_by(fixture_id=fixture.id, is_live=False)
           .order_by(Prediction.ts.desc()).first())
    if pre is None:
        return None  # never predicted pre-match; skip

    minute = fixture.minute or 0
    hg, ag = fixture.home_goals or 0, fixture.away_goals or 0

    home_sot = away_sot = None
    home_reds = away_reds = 0
    try:
        stats = api_client.get_fixture_statistics(db, fixture.id)
        home_sot = _extract_stat(stats, fixture.home_id, "Shots on Goal")
        away_sot = _extract_stat(stats, fixture.away_id, "Shots on Goal")
        home_reds = _extract_stat(stats, fixture.home_id, "Red Cards") or 0
        away_reds = _extract_stat(stats, fixture.away_id, "Red Cards") or 0
    except api_client.QuotaExceeded:
        log.warning("Quota hit — live update for %d uses score+minute only", fixture.id)

    out = live_adjusted_prediction(
        pre.pred_home_goals, pre.pred_away_goals, hg, ag, minute,
        home_sot=home_sot, away_sot=away_sot,
        home_reds=int(home_reds), away_reds=int(away_reds),
    )

    locked = minute >= config.LIVE_LOCK_MINUTE
    row = Prediction(
        fixture_id=fixture.id, model_version=pre.model_version + "-live",
        pred_home_goals=out.lambda_home, pred_away_goals=out.lambda_away,
        p_home_win=out.p_home_win, p_draw=out.p_draw, p_away_win=out.p_away_win,
        p_over25=out.p_over25, p_btts=out.p_btts,
        likely_scoreline=out.likely_scoreline, is_live=True, is_locked=locked,
    )
    db.add(row)
    db.commit()
    log.info("Live update fixture %d min %d -> %s %s", fixture.id, minute,
             out.likely_scoreline, "LOCKED" if locked else "updating")
    return row


# ---- accuracy ----------------------------------------------------------------

def evaluate_finished(db: Session) -> int:
    """Score final predictions against actual results (uses locked live pred if
    present, else last pre-match)."""
    evaluated = 0
    done_ids = {r.fixture_id for r in db.query(AccuracyLog.fixture_id).all()}
    finished = (db.query(Fixture)
                .filter(Fixture.status.in_(FINISHED), Fixture.home_goals.isnot(None))
                .all())
    for f in finished:
        if f.id in done_ids:
            continue
        pred = (db.query(Prediction).filter_by(fixture_id=f.id, is_live=False)
                .order_by(Prediction.ts.desc()).first())
        if pred is None:
            continue
        hg, ag = f.home_goals, f.away_goals
        actual = "H" if hg > ag else ("A" if ag > hg else "D")
        probs = {"H": pred.p_home_win, "D": pred.p_draw, "A": pred.p_away_win}
        predicted = max(probs, key=probs.get)
        brier = sum((probs[k] - (1.0 if k == actual else 0.0)) ** 2 for k in probs)

        db.add(AccuracyLog(
            fixture_id=f.id, model_version=pred.model_version,
            outcome_correct=(predicted == actual),
            scoreline_correct=(pred.likely_scoreline == f"{hg}-{ag}"),
            over25_correct=((pred.p_over25 >= 0.5) == (hg + ag >= 3)),
            btts_correct=((pred.p_btts >= 0.5) == (hg >= 1 and ag >= 1)),
            brier_outcome=brier,
        ))
        evaluated += 1
    db.commit()
    return evaluated
