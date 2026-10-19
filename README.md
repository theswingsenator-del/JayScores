# JayScores

Statistical match prediction using Dixon-Coles Poisson model. Predicts soccer match outcomes (Win/Draw/Loss %, scorelines, Over/Under 2.5, Both Teams to Score) with daily model refitting.

**Disclaimer:** For educational and research purposes. Not betting advice. Use predictions at your own risk.

**Tech:** FastAPI, SQLAlchemy, Alembic, Dixon-Coles, Next.js, React Three Fiber, Tailwind CSS

## Features

- Dixon-Coles Poisson regression for soccer prediction
- Daily model refit with exponential time decay (180-day half-life)
- Live in-play updates locked at minute 70
- Leagues: EPL, La Liga, FIFA World Cup
- 3D visualization of prediction probabilities
- Real-time model accuracy tracking

## Setup

```bash
# Backend
cd backend
export API_FOOTBALL_KEY="your_key"
export ADMIN_TOKEN="your_token"
pip install -r requirements.txt
python -m alembic upgrade head
python seed.py
python -m uvicorn app.main:app --port 8010

# Frontend  
cd frontend
npm install
npm run dev  # http://localhost:3000
```
