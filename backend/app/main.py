from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.config import settings

app = FastAPI(
    title="See Your Future, Change Your Future",
    description="Your future is not predicted. It is shaped. Scenario likelihoods are estimates, not predictions.",
    version=settings.VERSION,
)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=False, allow_methods=["*"], allow_headers=["*"])
app.include_router(router)


@app.get("/")
def root():
    return {"name": "see-your-future backend", "docs": "/docs", "health": "/api/health"}
