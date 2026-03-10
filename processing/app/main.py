from fastapi import FastAPI

app = FastAPI(title="Get Mocked - Image Processing")


@app.get("/health")
async def health():
    return {"status": "ok"}
