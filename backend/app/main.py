import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import basketball
from .database import Base, engine
from .routers import admin, fixtures, misc

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s %(name)s %(levelname)s %(message)s")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)  # dev convenience; prod uses Alembic
    sched = None
    if os.getenv("DISABLE_SCHEDULER") != "1":
        from .scheduler import start_scheduler
        sched = start_scheduler()
    yield
    if sched:
        sched.shutdown(wait=False)


app = FastAPI(title="JayScores API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(fixtures.router)
app.include_router(misc.router)
app.include_router(admin.router)
app.include_router(basketball.router)


@app.get("/")
def root():
    return {"app": "JayScores", "status": "ok"}
