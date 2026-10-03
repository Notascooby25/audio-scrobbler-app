import json
import logging
import os
from datetime import datetime, timedelta, timezone
from sqlalchemy import create_engine, Column, select, func, Boolean, DateTime, Integer, String, Text
from sqlalchemy.orm import declarative_base, sessionmaker

from pywebpush import webpush, WebPushException

logger = logging.getLogger(__name__)

Base = declarative_base()

class UserPreferences(Base):
    __tablename__ = "user_preferences"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    notify_recaps = Column(Boolean, default=False)
    recap_frequency = Column(String, default="weekly")

class ListeningEvent(Base):
    __tablename__ = "listening_events"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    artist_name = Column(String, nullable=False)
    played_at = Column(DateTime, nullable=False)

class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String, nullable=False, default="general")
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

class PushSubscription(Base):
    __tablename__ = "push_subscriptions"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    endpoint = Column(Text, nullable=False)
    p256dh = Column(String, nullable=False)
    auth = Column(String, nullable=False)

database_url = os.environ.get("DATABASE_URL", "")
vapid_private_key = os.environ.get("VAPID_PRIVATE_KEY", "")

def generate_recaps():
    logger.info("Starting scheduled recaps generation...")
    today = datetime.now(timezone.utc)
    is_monday = today.weekday() == 0
    is_first = today.day == 1
    
    engine = create_engine(database_url)
    Session = sessionmaker(bind=engine)
    db = Session()
    try:
        users_prefs = db.query(UserPreferences).filter(UserPreferences.notify_recaps == True).all()
        
        for pref in users_prefs:
            generate = False
            start_date = today
            title = ""
            
            if pref.recap_frequency == "daily":
                generate = True
                start_date = today - timedelta(days=1)
                title = "Daily Recap"
            elif pref.recap_frequency == "weekly" and is_monday:
                generate = True
                start_date = today - timedelta(days=7)
                title = "Weekly Recap"
            elif pref.recap_frequency == "monthly" and is_first:
                generate = True
                start_date = today.replace(day=1) - timedelta(days=1)
                start_date = start_date.replace(day=1)
                title = "Monthly Recap"
                
            if not generate:
                continue
                
            # Calculate stats
            total_scrobbles = db.query(func.count(ListeningEvent.id)).filter(
                ListeningEvent.user_id == pref.user_id,
                ListeningEvent.played_at >= start_date,
                ListeningEvent.played_at < today
            ).scalar() or 0
            
            if total_scrobbles == 0:
                continue # Skip recap if they didn't listen to anything!
                
            # Get top artist
            top_artist_result = db.query(ListeningEvent.artist_name, func.count(ListeningEvent.id).label('c')).filter(
                ListeningEvent.user_id == pref.user_id,
                ListeningEvent.played_at >= start_date,
                ListeningEvent.played_at < today
            ).group_by(ListeningEvent.artist_name).order_by(func.count(ListeningEvent.id).desc()).first()
            
            top_artist = top_artist_result[0] if top_artist_result else "Unknown"
            
            message = f"You listened to {total_scrobbles} tracks! Your top artist was {top_artist}."
            
            # Save notification
            notif = Notification(
                user_id=pref.user_id,
                title=title,
                message=message,
                type="recap"
            )
            db.add(notif)
            db.commit()
            
            # Send WebPush
            if vapid_private_key:
                subs = db.query(PushSubscription).filter(PushSubscription.user_id == pref.user_id).all()
                for sub in subs:
                    try:
                        webpush(
                            subscription_info={
                                'endpoint': sub.endpoint,
                                'keys': {'p256dh': sub.p256dh, 'auth': sub.auth}
                            },
                            data=json.dumps({
                                'title': title,
                                'body': message,
                                'url': '/settings?tab=notifications'
                            }),
                            vapid_private_key=vapid_private_key,
                            vapid_claims={"sub": "mailto:admin@example.com"}
                        )
                    except WebPushException as e:
                        logger.error(f"Failed to send webpush to user {pref.user_id}: {e}")
            
        logger.info("Recaps generation completed successfully.")
    except Exception as e:
        logger.exception("Error generating recaps")
    finally:
        db.close()
        engine.dispose()
