import re

with open('backend/app/schemas/analytics.py', 'r') as f:
    content = f.read()

heatmap_schema = '''
class HeatmapPoint(BaseModel):
    day: int
    hour: int
    count: int

class ReportChartsResponse(BaseModel):'''

content = content.replace('class ReportChartsResponse(BaseModel):', heatmap_schema)
content = content.replace('    music_by_decade: list[ReportPoint]', '    music_by_decade: list[ReportPoint]\n    listening_heatmap: list[HeatmapPoint]')

with open('backend/app/schemas/analytics.py', 'w') as f:
    f.write(content)


with open('backend/app/queries/analytics_queries.py', 'r') as f:
    queries = f.read()

new_query = '''
def build_report_heatmap_query(user_id: int, start: datetime | None, end: datetime | None) -> Select:
    # We will use extract('dow', ...) and extract('hour', ...)
    statement = (
        select(
            func.extract('dow', ListeningEvent.played_at).label('day'),
            func.extract('hour', ListeningEvent.played_at).label('hour'),
            func.count(ListeningEvent.id).label('count')
        )
        .where(ListeningEvent.user_id == user_id)
        .group_by('day', 'hour')
    )
    if start is not None:
        statement = statement.where(ListeningEvent.played_at >= start)
    if end is not None:
        statement = statement.where(ListeningEvent.played_at < end)
    return statement
'''
queries += new_query

with open('backend/app/queries/analytics_queries.py', 'w') as f:
    f.write(queries)
