import json
from datetime import datetime, timedelta

import numpy as np
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from ..database import get_db
from ..models import Fixture, ModelParams, Prediction
from ..predictor.dixon_coles import DixonColesPredictor
from ..schemas import FixtureOut, MarketGroup, MarketItem, MarketsOut, PredictionOut

router = APIRouter(prefix="/fixtures", tags=["fixtures"])


def _latest_prediction(db: Session, fixture_id: int) -> Prediction | None:
    return (db.query(Prediction).filter_by(fixture_id=fixture_id)
            .order_by(Prediction.ts.desc()).first())


@router.get("", response_model=list[FixtureOut])
def list_fixtures(
    league: int | None = Query(None),
    date: str | None = Query(None, description="YYYY-MM-DD"),
    days: int = Query(7, ge=1, le=60),
    db: Session = Depends(get_db),
):
    q = db.query(Fixture).options(joinedload(Fixture.home), joinedload(Fixture.away))
    if league:
        q = q.filter(Fixture.league_id == league)
    if date:
        day = datetime.fromisoformat(date)
        q = q.filter(Fixture.date >= day, Fixture.date < day + timedelta(days=1))
    else:
        now = datetime.utcnow()
        q = q.filter(Fixture.date >= now - timedelta(hours=3),
                     Fixture.date <= now + timedelta(days=days))
    fixtures = q.order_by(Fixture.date).limit(100).all()

    if not date:
        # Always append recent results after the upcoming window so the feed
        # shows both what's coming and how the model scored what's done.
        seen_ids = {f.id for f in fixtures}
        q2 = (db.query(Fixture)
              .options(joinedload(Fixture.home), joinedload(Fixture.away))
              .filter(Fixture.date < datetime.utcnow()))
        if league:
            q2 = q2.filter(Fixture.league_id == league)
        recent = q2.order_by(Fixture.date.desc()).limit(30).all()
        fixtures += [f for f in recent if f.id not in seen_ids]

    out = []
    for f in fixtures:
        item = FixtureOut.model_validate(f)
        pred = _latest_prediction(db, f.id)
        item.prediction = PredictionOut.model_validate(pred) if pred else None
        out.append(item)
    return out


@router.get("/{fixture_id}", response_model=FixtureOut)
def get_fixture(fixture_id: int, db: Session = Depends(get_db)):
    f = (db.query(Fixture).options(joinedload(Fixture.home), joinedload(Fixture.away))
         .filter(Fixture.id == fixture_id).first())
    if f is None:
        raise HTTPException(404, "Fixture not found")
    item = FixtureOut.model_validate(f)
    pred = _latest_prediction(db, f.id)
    item.prediction = PredictionOut.model_validate(pred) if pred else None
    return item


@router.get("/{fixture_id}/prediction", response_model=PredictionOut)
def get_prediction(fixture_id: int, db: Session = Depends(get_db)):
    pred = _latest_prediction(db, fixture_id)
    if pred is None:
        raise HTTPException(404, "No prediction for this fixture yet")
    return pred


@router.get("/{fixture_id}/markets", response_model=MarketsOut)
def get_markets(fixture_id: int, db: Session = Depends(get_db)):
    """Full market board derived from the stored Poisson lambdas.

    The score matrix already encodes every goals-based market, so this costs
    no extra model work — just different sums over the same matrix.
    """
    f = (db.query(Fixture).options(joinedload(Fixture.home), joinedload(Fixture.away))
         .filter(Fixture.id == fixture_id).first())
    if f is None:
        raise HTTPException(404, "Fixture not found")
    pred = _latest_prediction(db, fixture_id)
    if pred is None:
        raise HTTPException(404, "No prediction for this fixture yet")

    model = DixonColesPredictor()
    row = (db.query(ModelParams).filter_by(league_id=f.league_id)
           .order_by(ModelParams.fitted_at.desc()).first())
    if row:
        model.rho = json.loads(row.param_json).get("rho", model.rho)

    lh, la = pred.pred_home_goals, pred.pred_away_goals
    m = model.goals_matrix(lh, la)
    home, away = f.home.name, f.away.name

    p_home = float(np.sum(np.tril(m, -1)))
    p_draw = float(np.trace(m))
    p_away = float(np.sum(np.triu(m, 1)))
    totals = np.add.outer(np.arange(m.shape[0]), np.arange(m.shape[1]))

    def over(line: float) -> float:
        return float(m[totals >= int(line) + 1].sum())

    p_home_cs = float(m[:, 0].sum())   # away scores 0
    p_away_cs = float(m[0, :].sum())   # home scores 0
    diff = np.subtract.outer(np.arange(m.shape[0]), np.arange(m.shape[1]))

    top = sorted(
        ((int(i), int(j), float(m[i, j]))
         for i in range(m.shape[0]) for j in range(m.shape[1])),
        key=lambda t: -t[2],
    )[:6]

    groups = [
        MarketGroup(name="Match Result", markets=[
            MarketItem(label=f"{home} win", prob=p_home),
            MarketItem(label="Draw", prob=p_draw),
            MarketItem(label=f"{away} win", prob=p_away),
        ]),
        MarketGroup(name="Double Chance", markets=[
            MarketItem(label=f"{home} or draw (1X)", prob=p_home + p_draw),
            MarketItem(label=f"{home} or {away} (12)", prob=p_home + p_away),
            MarketItem(label=f"{away} or draw (X2)", prob=p_away + p_draw),
        ]),
        MarketGroup(name="Draw No Bet", markets=[
            MarketItem(label=home, prob=p_home / (p_home + p_away) if p_home + p_away else 0.5),
            MarketItem(label=away, prob=p_away / (p_home + p_away) if p_home + p_away else 0.5),
        ]),
        MarketGroup(name="Total Goals", markets=[
            MarketItem(label="Over 1.5", prob=over(1.5)),
            MarketItem(label="Over 2.5", prob=over(2.5)),
            MarketItem(label="Over 3.5", prob=over(3.5)),
            MarketItem(label="Under 2.5", prob=1 - over(2.5)),
            MarketItem(label="Odd total", prob=float(m[totals % 2 == 1].sum())),
            MarketItem(label="Even total", prob=float(m[totals % 2 == 0].sum())),
        ]),
        MarketGroup(name="Both Teams To Score", markets=[
            MarketItem(label="Yes", prob=float(m[1:, 1:].sum())),
            MarketItem(label="No", prob=1 - float(m[1:, 1:].sum())),
        ]),
        MarketGroup(name="Team Goals", markets=[
            MarketItem(label=f"{home} over 0.5", prob=1 - p_away_cs),
            MarketItem(label=f"{home} over 1.5", prob=float(m[2:, :].sum())),
            MarketItem(label=f"{away} over 0.5", prob=1 - p_home_cs),
            MarketItem(label=f"{away} over 1.5", prob=float(m[:, 2:].sum())),
        ]),
        MarketGroup(name="Clean Sheet", markets=[
            MarketItem(label=f"{home} clean sheet", prob=p_home_cs),
            MarketItem(label=f"{away} clean sheet", prob=p_away_cs),
        ]),
        MarketGroup(name="Winning Margin", markets=[
            MarketItem(label=f"{home} by 1", prob=float(m[diff == 1].sum())),
            MarketItem(label=f"{home} by 2+", prob=float(m[diff >= 2].sum())),
            MarketItem(label="Draw", prob=p_draw),
            MarketItem(label=f"{away} by 1", prob=float(m[diff == -1].sum())),
            MarketItem(label=f"{away} by 2+", prob=float(m[diff <= -2].sum())),
        ]),
        MarketGroup(name="Most Likely Scorelines", markets=[
            MarketItem(label=f"{i}–{j}", prob=p) for i, j, p in top
        ]),
    ]

    # Corners & cards: no per-match feed on the free plan, so these are
    # model estimates — league baselines scaled by the attacking intensity
    # the goals model already implies (more expected goals => more corners,
    # fewer cards in open games). Clearly labelled "est." in the UI.
    from scipy.stats import poisson as _poisson
    intensity = (lh + la) / 2.7  # league-average total goals baseline
    corners_lambda = 10.2 * min(max(intensity, 0.6), 1.6)
    cards_lambda = 4.3 * min(max(2.0 - intensity, 0.7), 1.3)

    def over_pois(lam: float, line: float) -> float:
        return float(1 - _poisson.cdf(int(line), lam))

    groups.append(MarketGroup(name="Corners (model est.)", markets=[
        MarketItem(label="Over 8.5 corners", prob=over_pois(corners_lambda, 8.5)),
        MarketItem(label="Over 9.5 corners", prob=over_pois(corners_lambda, 9.5)),
        MarketItem(label="Over 10.5 corners", prob=over_pois(corners_lambda, 10.5)),
        MarketItem(label="Under 9.5 corners", prob=1 - over_pois(corners_lambda, 9.5)),
    ]))
    groups.append(MarketGroup(name="Cards (model est.)", markets=[
        MarketItem(label="Over 2.5 cards", prob=over_pois(cards_lambda, 2.5)),
        MarketItem(label="Over 3.5 cards", prob=over_pois(cards_lambda, 3.5)),
        MarketItem(label="Over 4.5 cards", prob=over_pois(cards_lambda, 4.5)),
        MarketItem(label="Under 3.5 cards", prob=1 - over_pois(cards_lambda, 3.5)),
    ]))
    return MarketsOut(fixture_id=fixture_id, model_version=pred.model_version, groups=groups)
