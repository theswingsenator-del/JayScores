from datetime import datetime

from sqlalchemy import (
    Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text,
    UniqueConstraint, Index,
)
from sqlalchemy.orm import relationship

from .database import Base


class Team(Base):
    __tablename__ = "teams"

    id = Column(Integer, primary_key=True)  # API-Football team id
    name = Column(String(120), nullable=False)
    league_id = Column(Integer, nullable=False, index=True)
    logo = Column(String(300), nullable=True)


class Fixture(Base):
    __tablename__ = "fixtures"

    id = Column(Integer, primary_key=True)  # API-Football fixture id
    league_id = Column(Integer, nullable=False, index=True)
    season = Column(Integer, nullable=False, index=True)
    home_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    away_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    date = Column(DateTime, nullable=False, index=True)
    status = Column(String(10), nullable=False, default="NS")  # NS/1H/HT/2H/FT...
    home_goals = Column(Integer, nullable=True)
    away_goals = Column(Integer, nullable=True)
    minute = Column(Integer, nullable=True)
    is_featured = Column(Boolean, nullable=False, default=False)

    home = relationship("Team", foreign_keys=[home_id])
    away = relationship("Team", foreign_keys=[away_id])

    __table_args__ = (Index("ix_fixtures_league_date", "league_id", "date"),)


class TeamStats(Base):
    __tablename__ = "team_stats"

    id = Column(Integer, primary_key=True, autoincrement=True)
    team_id = Column(Integer, ForeignKey("teams.id"), nullable=False)
    season = Column(Integer, nullable=False)
    matches = Column(Integer, nullable=False, default=0)
    goals_for = Column(Integer, nullable=False, default=0)
    goals_against = Column(Integer, nullable=False, default=0)
    home_gf = Column(Integer, nullable=False, default=0)
    home_ga = Column(Integer, nullable=False, default=0)
    away_gf = Column(Integer, nullable=False, default=0)
    away_ga = Column(Integer, nullable=False, default=0)
    xg_for = Column(Float, nullable=True)
    xg_against = Column(Float, nullable=True)

    __table_args__ = (UniqueConstraint("team_id", "season", name="uq_team_season"),)


class Prediction(Base):
    __tablename__ = "predictions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    fixture_id = Column(Integer, ForeignKey("fixtures.id"), nullable=False, index=True)
    model_version = Column(String(40), nullable=False)
    ts = Column(DateTime, nullable=False, default=datetime.utcnow)
    pred_home_goals = Column(Float, nullable=False)  # lambda home
    pred_away_goals = Column(Float, nullable=False)  # lambda away
    p_home_win = Column(Float, nullable=False)
    p_draw = Column(Float, nullable=False)
    p_away_win = Column(Float, nullable=False)
    p_over25 = Column(Float, nullable=False)
    p_btts = Column(Float, nullable=False)
    likely_scoreline = Column(String(10), nullable=False)  # "2-1"
    is_live = Column(Boolean, nullable=False, default=False)
    is_locked = Column(Boolean, nullable=False, default=False)


class ModelParams(Base):
    __tablename__ = "model_params"

    id = Column(Integer, primary_key=True, autoincrement=True)
    league_id = Column(Integer, nullable=False)
    season = Column(Integer, nullable=False)
    model_version = Column(String(40), nullable=False)
    param_json = Column(Text, nullable=False)
    fitted_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (Index("ix_params_league_season", "league_id", "season"),)


class AccuracyLog(Base):
    __tablename__ = "accuracy_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    fixture_id = Column(Integer, ForeignKey("fixtures.id"), nullable=False, unique=True)
    model_version = Column(String(40), nullable=False)
    evaluated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    outcome_correct = Column(Boolean, nullable=False)      # predicted W/D/L side won
    scoreline_correct = Column(Boolean, nullable=False)    # exact scoreline hit
    over25_correct = Column(Boolean, nullable=False)
    btts_correct = Column(Boolean, nullable=False)
    brier_outcome = Column(Float, nullable=False)          # multiclass Brier score


class ApiRequestLog(Base):
    __tablename__ = "api_request_log"

    id = Column(Integer, primary_key=True, autoincrement=True)
    date = Column(String(10), nullable=False, index=True)  # YYYY-MM-DD (UTC)
    endpoint = Column(String(120), nullable=False)
    ts = Column(DateTime, nullable=False, default=datetime.utcnow)
