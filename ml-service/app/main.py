from fastapi import FastAPI

from app.api.analyze import router as analyze_router

app = FastAPI(
    title="Hakaron ML Service",
    version="0.1.0",
    docs_url="/docs",
)

app.include_router(analyze_router, prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "hakaron-ml"}
