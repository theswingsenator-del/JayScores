"""Dixon-Coles Poisson model.

Per team: attack + defense strength. Global: home advantage + rho (low-score
correction). Fitted by maximum likelihood with exponential time-decay weights
(half-life ~180 days) so recent form dominates — this is the self-learning
mechanism: each refit on new results shifts the parameters.
"""
import math
from datetime import datetime

import numpy as np
from scipy.optimize import minimize
from scipy.stats import poisson

from .. import config
from .base import MatchResult, PredictionOutput, Predictor


def _dc_correction(hg: int, ag: int, lh: float, la: float, rho: float) -> float:
    """Dixon-Coles tau: adjusts probability of 0-0 / 1-0 / 0-1 / 1-1."""
    if hg == 0 and ag == 0:
        return 1 - lh * la * rho
    if hg == 0 and ag == 1:
        return 1 + lh * rho
    if hg == 1 and ag == 0:
        return 1 + la * rho
    if hg == 1 and ag == 1:
        return 1 - rho
    return 1.0


class DixonColesPredictor(Predictor):
    name = "dixon_coles"

    def __init__(self, half_life_days: float = config.DECAY_HALF_LIFE_DAYS,
                 max_goals: int = config.MAX_GOALS):
        self.half_life = half_life_days
        self.max_goals = max_goals
        self.attack: dict[int, float] = {}
        self.defense: dict[int, float] = {}
        self.home_adv: float = 0.25
        self.rho: float = -0.05

    # ---- fitting -------------------------------------------------------

    def _weights(self, results: list[MatchResult], as_of: datetime) -> np.ndarray:
        xi = math.log(2) / self.half_life  # decay rate for chosen half-life
        days = np.array([(as_of - r.date).days for r in results], dtype=float)
        days = np.clip(days, 0, None)
        return np.exp(-xi * days)

    def fit(self, results: list[MatchResult], as_of: datetime | None = None) -> dict:
        if not results:
            raise ValueError("No results to fit on")
        as_of = as_of or datetime.utcnow()

        team_ids = sorted({r.home_id for r in results} | {r.away_id for r in results})
        idx = {t: i for i, t in enumerate(team_ids)}
        n = len(team_ids)
        w = self._weights(results, as_of)

        hg = np.array([r.home_goals for r in results])
        ag = np.array([r.away_goals for r in results])
        hi = np.array([idx[r.home_id] for r in results])
        ai = np.array([idx[r.away_id] for r in results])

        def neg_ll(params):
            atk = params[:n]
            dfn = params[n:2 * n]
            home_adv = params[2 * n]
            rho = params[2 * n + 1]

            lh = np.exp(atk[hi] + dfn[ai] + home_adv)
            la = np.exp(atk[ai] + dfn[hi])

            ll = (poisson.logpmf(hg, lh) + poisson.logpmf(ag, la))
            # DC low-score correction on 0/1 scorelines
            tau = np.ones_like(lh)
            m00 = (hg == 0) & (ag == 0)
            m01 = (hg == 0) & (ag == 1)
            m10 = (hg == 1) & (ag == 0)
            m11 = (hg == 1) & (ag == 1)
            tau[m00] = 1 - lh[m00] * la[m00] * rho
            tau[m01] = 1 + lh[m01] * rho
            tau[m10] = 1 + la[m10] * rho
            tau[m11] = 1 - rho
            tau = np.clip(tau, 1e-10, None)
            ll = ll + np.log(tau)
            # Ridge penalty: shrinks thin-data teams toward league average
            # instead of letting near-zero decay weights produce wild params.
            l2 = 0.5 * (np.sum(atk ** 2) + np.sum(dfn ** 2))
            return -np.sum(w * ll) + l2

        x0 = np.concatenate([np.zeros(n), np.zeros(n), [0.25], [-0.05]])
        # identifiability: mean attack = 0
        cons = [{"type": "eq", "fun": lambda p: np.mean(p[:n])}]
        bounds = [(-3, 3)] * (2 * n) + [(-1, 1.5), (-0.5, 0.5)]

        res = minimize(neg_ll, x0, method="SLSQP", constraints=cons,
                       bounds=bounds, options={"maxiter": 300, "ftol": 1e-7})

        atk = res.x[:n]
        dfn = res.x[n:2 * n]
        self.attack = {t: float(atk[idx[t]]) for t in team_ids}
        self.defense = {t: float(dfn[idx[t]]) for t in team_ids}
        self.home_adv = float(res.x[2 * n])
        self.rho = float(res.x[2 * n + 1])

        return {
            "model": self.name,
            "attack": {str(k): v for k, v in self.attack.items()},
            "defense": {str(k): v for k, v in self.defense.items()},
            "home_adv": self.home_adv,
            "rho": self.rho,
            "half_life_days": self.half_life,
            "n_matches": len(results),
            "converged": bool(res.success),
        }

    def load_params(self, params: dict) -> None:
        self.attack = {int(k): v for k, v in params["attack"].items()}
        self.defense = {int(k): v for k, v in params["defense"].items()}
        self.home_adv = params["home_adv"]
        self.rho = params["rho"]

    # ---- prediction ----------------------------------------------------

    def lambdas(self, home_id: int, away_id: int) -> tuple[float, float]:
        # Teams without fitted history (new/promoted/tournament debutants) get
        # neutral league-average strength (0.0) so a prediction always exists.
        ha, hd = self.attack.get(home_id, 0.0), self.defense.get(home_id, 0.0)
        aa, ad = self.attack.get(away_id, 0.0), self.defense.get(away_id, 0.0)
        lh = math.exp(ha + ad + self.home_adv)
        la = math.exp(aa + hd)
        return lh, la

    def goals_matrix(self, lh: float, la: float) -> np.ndarray:
        g = np.arange(0, self.max_goals + 1)
        ph = poisson.pmf(g, lh)
        pa = poisson.pmf(g, la)
        m = np.outer(ph, pa)  # m[i, j] = P(home=i, away=j)
        for i in (0, 1):
            for j in (0, 1):
                m[i, j] *= _dc_correction(i, j, lh, la, self.rho)
        m = np.clip(m, 0, None)
        return m / m.sum()

    @staticmethod
    def derive(m: np.ndarray, lh: float, la: float) -> PredictionOutput:
        i, j = np.unravel_index(np.argmax(m), m.shape)
        p_home = float(np.sum(np.tril(m, -1)))   # i > j
        p_draw = float(np.trace(m))
        p_away = float(np.sum(np.triu(m, 1)))    # j > i
        totals = np.add.outer(np.arange(m.shape[0]), np.arange(m.shape[1]))
        p_over25 = float(m[totals >= 3].sum())
        p_btts = float(m[1:, 1:].sum())
        return PredictionOutput(
            lambda_home=float(lh), lambda_away=float(la),
            p_home_win=p_home, p_draw=p_draw, p_away_win=p_away,
            p_over25=p_over25, p_btts=p_btts,
            likely_scoreline=f"{int(i)}-{int(j)}",
            matrix=np.round(m, 5).tolist(),
        )

    def predict(self, home_id: int, away_id: int) -> PredictionOutput:
        lh, la = self.lambdas(home_id, away_id)
        return self.derive(self.goals_matrix(lh, la), lh, la)
