from datetime import datetime

from pydantic import BaseModel


class TeamOut(BaseModel):
    id: int
    name: str
    logo: str | None = None

    class Config:
        from_attributes = True


class PredictionOut(BaseModel):
    fixture_id: int
    model_version: str
    ts: datetime
    pred_home_goals: float
    pred_away_goals: float
    p_home_win: float
    p_draw: float
    p_away_win: float
    p_over25: float
    p_btts: float
    likely_scoreline: str
    is_live: bool
    is_locked: bool

    class Config:
        from_attributes = True


class FixtureOut(BaseModel):
    id: int
    league_id: int
    season: int
    date: datetime
    status: str
    minute: int | None
    home_goals: int | None
    away_goals: int | None
    is_featured: bool
    home: TeamOut
    away: TeamOut
    prediction: PredictionOut | None = None

    class Config:
        from_attributes = True


class LeagueOut(BaseModel):
    id: int
    name: str


class FormEntry(BaseModel):
    fixture_id: int
    date: datetime
    opponent: str
    home: bool
    goals_for: int
    goals_against: int
    result: str  # W/D/L


class TeamFormOut(BaseModel):
    team: TeamOut
    attack: float | None = None
    defense: float | None = None
    recent: list[FormEntry]


class AccuracyPoint(BaseModel):
    period: str  # YYYY-MM
    n: int
    outcome_acc: float
    scoreline_acc: float
    over25_acc: float
    btts_acc: float
    brier: float


class AccuracyOut(BaseModel):
    total_evaluated: int
    overall_outcome_acc: float | None
    points: list[AccuracyPoint]


class MarketItem(BaseModel):
    label: str
    prob: float


class MarketGroup(BaseModel):
    name: str
    markets: list[MarketItem]


class MarketsOut(BaseModel):
    fixture_id: int
    model_version: str
    groups: list[MarketGroup]
