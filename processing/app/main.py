from fastapi import FastAPI

app = FastAPI(title="Get Mocked - Processing Service")


@app.get("/health")
async def health():
    return {"status": "ok"}
