"""Predictor interface.

Any model (Poisson today, XGBoost later) implements this. A future blender can
hold several Predictors and mix their outputs — nothing else in the app needs
to change.
"""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class MatchResult:
    """A finished match used for fitting."""
    home_id: int
    away_id: int
    home_goals: int
    away_goals: int
    date: object  # datetime


@dataclass
class PredictionOutput:
    lambda_home: float
    lambda_away: float
    p_home_win: float
    p_draw: float
    p_away_win: float
    p_over25: float
    p_btts: float
    likely_scoreline: str
    matrix: list = field(default_factory=list)  # goals matrix for viz (optional)


class Predictor(ABC):
    """fit(results) -> params dict; predict(home_id, away_id) -> PredictionOutput."""

    name: str = "base"

    @abstractmethod
    def fit(self, results: list[MatchResult], as_of=None) -> dict:
        """Fit on historical results, return serializable params."""

    @abstractmethod
    def load_params(self, params: dict) -> None:
        """Restore a previously fitted state."""

    @abstractmethod
    def predict(self, home_id: int, away_id: int) -> PredictionOutput:
        """Predict a fixture between two known teams."""
