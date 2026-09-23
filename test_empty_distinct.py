from sqlalchemy import create_engine, select, func, Column, Integer, String, DateTime
from sqlalchemy.orm import declarative_base, Session
import datetime

Base = declarative_base()
class MockEvent(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True)
    artist_name = Column(String)

engine = create_engine("sqlite://")
Base.metadata.create_all(engine)
with Session(engine) as session:
    stmt = select(func.count(func.distinct(MockEvent.artist_name)).label("unique_artists"))
    row = session.execute(stmt).one()
    print("Artists:", row.unique_artists, type(row.unique_artists))
