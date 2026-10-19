from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .. import api_client, config
from ..database import get_db
from ..models import Fixture
from ..services import data_pull, predictions

router = APIRouter(prefix="/admin", tags=["admin"])


def require_admin(x_admin_token: str = Header(...)):
    if x_admin_token != config.ADMIN_TOKEN:
        raise HTTPException(403, "Bad admin token")


@router.post("/pull", dependencies=[Depends(require_admin)])
def trigger_pull(season: int = config.DEFAULT_SEASON, db: Session = Depends(get_db)):
    return data_pull.daily_pull(db, season)


@router.post("/refit", dependencies=[Depends(require_admin)])
def trigger_refit(season: int = config.DEFAULT_SEASON, db: Session = Depends(get_db)):
    versions = predictions.refit_all(db, season)
    made = predictions.generate_prematch(db, season)
    evaluated = predictions.evaluate_finished(db)
    return {"model_versions": versions, "predictions_made": made, "evaluated": evaluated}


@router.post("/feature/{fixture_id}", dependencies=[Depends(require_admin)])
def toggle_featured(fixture_id: int, db: Session = Depends(get_db)):
    f = db.get(Fixture, fixture_id)
    if f is None:
        raise HTTPException(404, "Fixture not found")
    f.is_featured = not f.is_featured
    db.commit()
    return {"fixture_id": fixture_id, "is_featured": f.is_featured}


@router.get("/quota", dependencies=[Depends(require_admin)])
def quota(db: Session = Depends(get_db)):
    return {"used_today": api_client.requests_used_today(db),
            "remaining": api_client.requests_remaining(db),
            "daily_cap": config.DAILY_API_QUOTA}
