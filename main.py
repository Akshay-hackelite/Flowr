from fastapi import FastAPI

from database import init_db
from routes import router


app = FastAPI(title="WATI-like Workflow Bot Backend")


@app.on_event("startup")
def startup_event():
    init_db()


app.include_router(router)
