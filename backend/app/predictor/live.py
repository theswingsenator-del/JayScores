"""In-play prediction adjustment.

Start from pre-match lambdas, scale by remaining minutes, nudge by live signals
(shots-on-target rate, red cards), then predict FINAL score = current score +
Poisson(remaining expectation) via a shifted goals matrix.
"""
import numpy as np
from scipy.stats import poisson

from .. import config
from .dixon_coles import DixonColesPredictor, _dc_correction
from .base import PredictionOutput

FULL_TIME = 90.0


def _sot_factor(sot: float, minute: float, baseline_per90: float = 4.5) -> float:
    """Shots-on-target rate vs league baseline -> multiplier in [0.7, 1.4]."""
    if minute < 10:
        return 1.0  # too early to trust
    rate90 = sot * FULL_TIME / minute
    factor = 1.0 + 0.5 * (rate90 - baseline_per90) / baseline_per90
    return float(np.clip(factor, 0.7, 1.4))


def live_adjusted_prediction(
    lambda_home_pre: float,
    lambda_away_pre: float,
    home_goals: int,
    away_goals: int,
    minute: int,
    home_sot: float | None = None,
    away_sot: float | None = None,
    home_reds: int = 0,
    away_reds: int = 0,
    rho: float = -0.05,
    max_goals: int = config.MAX_GOALS,
) -> PredictionOutput:
    minute = max(1, min(minute, 89))
    remaining_frac = (FULL_TIME - minute) / FULL_TIME

    # Remaining-goal expectation from pre-match rates
    lh_rem = lambda_home_pre * remaining_frac
    la_rem = lambda_away_pre * remaining_frac

    # Live signal: shots-on-target pace
    if home_sot is not None:
        lh_rem *= _sot_factor(home_sot, minute)
    if away_sot is not None:
        la_rem *= _sot_factor(away_sot, minute)

    # Red cards: each red ~ -30% own attack, +15% opponent attack
    lh_rem *= (0.70 ** home_reds) * (1.15 ** away_reds)
    la_rem *= (0.70 ** away_reds) * (1.15 ** home_reds)

    lh_rem = float(np.clip(lh_rem, 0.01, 6.0))
    la_rem = float(np.clip(la_rem, 0.01, 6.0))

    # Matrix over REMAINING goals, then shift by current score
    size = max_goals + 1
    g = np.arange(0, size)
    ph = poisson.pmf(g, lh_rem)
    pa = poisson.pmf(g, la_rem)
    rem = np.outer(ph, pa)
    if home_goals == 0 and away_goals == 0 and minute < 25:
        # early game: low-score correction still meaningful
        for i in (0, 1):
            for j in (0, 1):
                rem[i, j] *= _dc_correction(i, j, lh_rem, la_rem, rho)
    rem = np.clip(rem, 0, None)
    rem = rem / rem.sum()

    final = np.zeros((size, size))
    for i in range(size):
        for j in range(size):
            fi, fj = min(home_goals + i, max_goals), min(away_goals + j, max_goals)
            final[fi, fj] += rem[i, j]

    out = DixonColesPredictor.derive(final, home_goals + lh_rem, away_goals + la_rem)
    return out
