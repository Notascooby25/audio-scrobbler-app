import re
with open('backend/app/models.py', 'r') as f:
    content = f.read()

# I will append the class at the end
content += '''

class GenreCache(Base):
    __tablename__ = "genre_cache"
    artist_spotify_id: Mapped[str] = mapped_column(String(255), primary_key=True, index=True)
    genres: Mapped[list[str]] = mapped_column(JSON, nullable=False, default=list)
    cached_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)
'''

with open('backend/app/models.py', 'w') as f:
    f.write(content)
