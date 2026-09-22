from sqlalchemy import create_engine, select, func, text
engine = create_engine("sqlite://")
with engine.connect() as conn:
    try:
        res = conn.execute(select(func.extract('dow', func.datetime('now')))).scalar()
        print(f"DOW works! {res}")
    except Exception as e:
        print(f"FAILED: {e}")
