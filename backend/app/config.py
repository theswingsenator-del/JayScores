"""App configuration. Values can be overridden via environment variables."""
import os
import sys

# API-Football (api-sports.io) — must be set via environment variable
_api_football_key = os.getenv("API_FOOTBALL_KEY")
if not _api_football_key:
    print("ERROR: API_FOOTBALL_KEY environment variable is not set.")
    print("Set it and restart the app.", file=sys.stderr)
    sys.exit(1)
API_FOOTBALL_KEY = _api_football_key

API_FOOTBALL_HOST = os.getenv("API_FOOTBALL_HOST", "v3.football.api-sports.io")

# Database — Postgres in prod; sqlite fallback for local dev.
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./jayscores.db")

# Live prediction lock minute
LIVE_LOCK_MINUTE = int(os.getenv("LIVE_LOCK_MINUTE", "70"))

# Leagues: EPL=39, LaLiga=140, World Cup=1
LEAGUE_IDS = [int(x) for x in os.getenv("LEAGUE_IDS", "39,140,1").split(",")]

# TLS verification for outbound API calls. Keep ON in prod; set VERIFY_SSL=0
# only on dev machines with broken cert stores (e.g. AV/proxy interception).
VERIFY_SSL = os.getenv("VERIFY_SSL", "1") == "1"

# Daily API quota (free tier = 100 req/day). Guard keeps a safety margin.
DAILY_API_QUOTA = int(os.getenv("DAILY_API_QUOTA", "100"))
QUOTA_SAFETY_MARGIN = int(os.getenv("QUOTA_SAFETY_MARGIN", "5"))

# Live polling interval (seconds) for featured matches
LIVE_POLL_SECONDS = int(os.getenv("LIVE_POLL_SECONDS", "180"))

# Admin token for protected endpoints — must be set via environment variable
_admin_token = os.getenv("ADMIN_TOKEN")
if not _admin_token:
    print("ERROR: ADMIN_TOKEN environment variable is not set.", file=sys.stderr)
    print("Set it and restart the app.", file=sys.stderr)
    sys.exit(1)
ADMIN_TOKEN = _admin_token

# Model
DECAY_HALF_LIFE_DAYS = float(os.getenv("DECAY_HALF_LIFE_DAYS", "180"))
# Tournaments with multi-year gaps need a slower decay or the previous
# edition's matches carry ~zero weight and the fit degenerates.
LEAGUE_HALF_LIFE = {1: 1200.0}  # World Cup
MAX_GOALS = 10  # goals matrix dimension (0..MAX_GOALS)

# Current season default (API-Football uses start year).
# NOTE: free plan only serves seasons 2022-2024.
DEFAULT_SEASON = int(os.getenv("DEFAULT_SEASON", "2024"))

# Per-league season override. World Cup 2026 is in progress; its fixtures
# arrive via the rolling date-window pull (free plan serves yesterday..tomorrow
# by date even for seasons the bulk season endpoint blocks).
LEAGUE_SEASONS = {39: DEFAULT_SEASON, 140: DEFAULT_SEASON, 1: 2026}

# Historical seasons used only for the one-time seed backfill per league
HISTORY_SEASONS = {39: [2024], 140: [2024], 1: [2022]}

LEAGUE_NAMES = {39: "Premier League", 140: "La Liga", 1: "FIFA World Cup"}
