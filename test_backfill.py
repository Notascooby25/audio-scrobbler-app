import sys
import logging
from backend.app.db import SessionLocal
from backend.app.services.processed_import_service import backfill_artwork_stream

logging.basicConfig(level=logging.DEBUG)

def run():
    db = SessionLocal()
    try:
        events = list(backfill_artwork_stream(db, 1))
        for e in events:
            print(e.model_dump())
    finally:
        db.close()

if __name__ == "__main__":
    run()
