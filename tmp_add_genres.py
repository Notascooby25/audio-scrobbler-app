import re

with open('backend/app/services/analytics_service.py', 'r') as f:
    content = f.read()

new_code = '''
    if entity == "genres":
        from ..models import GenreCache
        from ..queries.analytics_queries import build_report_genre_artist_counts_query
        from collections import Counter
        
        statement = build_report_genre_artist_counts_query(user_id=user_id, start=start, end=end)
        rows = db.execute(statement).all()
        artist_ids = {row.artist_id for row in rows if row.artist_id}
        
        genres_by_artist = {}
        if artist_ids:
            cache_rows = db.query(GenreCache).filter(GenreCache.artist_spotify_id.in_(artist_ids)).all()
            genres_by_artist = {r.artist_spotify_id: r.genres for r in cache_rows}
            
        counter = Counter()
        for row in rows:
            if not row.artist_id: continue
            genres = genres_by_artist.get(row.artist_id, [])
            for g in genres:
                counter[g] += row.play_count
                
        entries = [
            ChartEntry(label=g, secondary=None, play_count=count, artwork_url=None, sources=[])
            for g, count in counter.most_common(limit)
        ]
        return ChartResponse(user_id=user_id, entity=entity, range=range_key, entries=entries)
'''

content = content.replace('    statement = build_top_entities_query(user_id=user_id, entity=entity, range_key=range_key, limit=limit, start=start, end=end)', new_code + '\n    statement = build_top_entities_query(user_id=user_id, entity=entity, range_key=range_key, limit=limit, start=start, end=end)')

with open('backend/app/services/analytics_service.py', 'w') as f:
    f.write(content)
