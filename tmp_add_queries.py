import re

with open('backend/app/queries/analytics_queries.py', 'r') as f:
    content = f.read()

new_queries = '''
class extract_primary_artist_id(FunctionElement):
    name = "extract_primary_artist_id"
    inherit_cache = True

@compiles(extract_primary_artist_id, "sqlite")
def sqlite_extract_primary_artist_id(element, compiler, **kw):
    arg = compiler.process(element.clauses.clauses[0], **kw)
    return (f"coalesce(json_extract({arg}, '$.track.artists[0].id'), "
            f"json_extract({arg}, '$.item.artists[0].id'))")

@compiles(extract_primary_artist_id, "postgresql")
def pg_extract_primary_artist_id(element, compiler, **kw):
    arg = compiler.process(element.clauses.clauses[0], **kw)
    return (f"coalesce({arg}->'track'->'artists'->0->>'id', "
            f"{arg}->'item'->'artists'->0->>'id')")

def build_pending_genre_artist_ids_query(limit: int) -> Select:
    from ..models import GenreCache
    artist_id_expr = extract_primary_artist_id(ListeningEvent.raw_metadata)
    statement = (
        select(artist_id_expr.label("artist_id"))
        .select_from(ListeningEvent)
        .where(
            ListeningEvent.source == "spotify",
            artist_id_expr.isnot(None),
            ~exists().where(GenreCache.artist_spotify_id == artist_id_expr)
        )
        .group_by(artist_id_expr)
        .limit(limit)
    )
    return statement

def build_report_genre_artist_counts_query(user_id: int, start: datetime | None, end: datetime | None) -> Select:
    artist_id_expr = extract_primary_artist_id(ListeningEvent.raw_metadata)
    statement = (
        select(
            artist_id_expr.label("artist_id"),
            func.count(ListeningEvent.id).label("play_count")
        )
        .select_from(ListeningEvent)
        .where(
            ListeningEvent.user_id == user_id,
            ListeningEvent.source == "spotify",
            artist_id_expr.isnot(None)
        )
    )
    if start is not None:
        statement = statement.where(ListeningEvent.played_at >= start)
    if end is not None:
        statement = statement.where(ListeningEvent.played_at < end)
    
    statement = statement.group_by(artist_id_expr).order_by(desc("play_count"))
    return statement
'''

content += new_queries

with open('backend/app/queries/analytics_queries.py', 'w') as f:
    f.write(content)
