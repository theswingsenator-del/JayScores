"""Smoke test: fit Dixon-Coles on synthetic results, verify prediction sanity.

Run: python test_engine.py
"""
import random
from datetime import datetime, timedelta

import numpy as np

from app.predictor import DixonColesPredictor, MatchResult, live_adjusted_prediction

random.seed(42)
np.random.seed(42)

# Synthetic league: 8 teams, true strengths, 2 rounds of double round-robin
TEAMS = list(range(101, 109))
TRUE_ATK = {t: a for t, a in zip(TEAMS, [0.4, 0.25, 0.1, 0.0, -0.05, -0.1, -0.2, -0.4])}
TRUE_DEF = {t: d for t, d in zip(TEAMS, [-0.3, -0.15, -0.05, 0.0, 0.05, 0.1, 0.15, 0.3])}
HOME_ADV = 0.30

results = []
start = datetime(2025, 8, 1)
day = 0
for rnd in range(2):
    for h in TEAMS:
        for a in TEAMS:
            if h == a:
                continue
            lh = np.exp(TRUE_ATK[h] + TRUE_DEF[a] + HOME_ADV)
            la = np.exp(TRUE_ATK[a] + TRUE_DEF[h])
            hg = np.random.poisson(lh)
            ag = np.random.poisson(la)
            results.append(MatchResult(h, a, int(hg), int(ag), start + timedelta(days=day)))
            day += 1

print(f"Fitting on {len(results)} synthetic matches...")
model = DixonColesPredictor()
params = model.fit(results, as_of=start + timedelta(days=day + 1))
print(f"Converged: {params['converged']}, home_adv={params['home_adv']:.3f} (true 0.30), rho={params['rho']:.3f}")

# strongest (101) home vs weakest (108)
out = model.predict(101, 108)
print(f"\nStrong home vs weak away: {out.likely_scoreline}")
print(f"  lambdas: {out.lambda_home:.2f} vs {out.lambda_away:.2f}")
print(f"  W/D/L: {out.p_home_win:.1%} / {out.p_draw:.1%} / {out.p_away_win:.1%}")
print(f"  Over2.5: {out.p_over25:.1%}  BTTS: {out.p_btts:.1%}")
assert out.p_home_win > 0.55, "strong home team should be clear favorite"
assert abs(out.p_home_win + out.p_draw + out.p_away_win - 1) < 1e-6, "probs must sum to 1"

# reverse fixture — away side now the strong one
out2 = model.predict(108, 101)
print(f"\nWeak home vs strong away: {out2.likely_scoreline}, "
      f"W/D/L: {out2.p_home_win:.1%}/{out2.p_draw:.1%}/{out2.p_away_win:.1%}")
assert out2.p_away_win > out2.p_home_win, "strong away side should be favorite"

# round-trip params
model2 = DixonColesPredictor()
model2.load_params(params)
out3 = model2.predict(101, 108)
assert out3.likely_scoreline == out.likely_scoreline, "param round-trip mismatch"

# live adjustment: 0-0 at minute 80 -> most likely final 0-0, near-lock
live = live_adjusted_prediction(out.lambda_home, out.lambda_away, 0, 0, 80)
print(f"\nLive 0-0 @80': {live.likely_scoreline}, draw prob {live.p_draw:.1%}")
assert live.likely_scoreline == "0-0"
assert live.p_draw > out.p_draw, "late 0-0 must raise draw prob vs pre-match"

# live: home leads 2-0 at 85' -> home win near certain
live2 = live_adjusted_prediction(out.lambda_home, out.lambda_away, 2, 0, 85)
print(f"Live 2-0 @85': {live2.likely_scoreline}, home win {live2.p_home_win:.1%}")
assert live2.p_home_win > 0.95

# red card hurts attack
live3 = live_adjusted_prediction(1.5, 1.2, 1, 1, 60, home_reds=1)
live3b = live_adjusted_prediction(1.5, 1.2, 1, 1, 60)
assert live3.p_home_win < live3b.p_home_win, "home red card must cut home win prob"
print(f"Red card check: home win {live3b.p_home_win:.1%} -> {live3.p_home_win:.1%} after home red")

print("\nALL ENGINE TESTS PASSED")
