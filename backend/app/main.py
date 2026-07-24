from fastapi import FastAPI

app = FastAPI(title="StudySphere API")


@app.get("/")
async def root():
    return {
        "message": "Welcome to StudySphere API 🚀"
    }