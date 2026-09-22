import re

with open('backend/app/services/analytics_service.py', 'r') as f:
    content = f.read()

import_block = 'from ..queries.analytics_queries import (\n    build_report_heatmap_query,'
content = content.replace('from ..queries.analytics_queries import (', import_block, 1)

schema_block = '    HeatmapPoint,\n    ReportChartsResponse,'
content = content.replace('    ReportChartsResponse,', schema_block, 1)

# In get_report_charts
heatmap_logic = '''
    heatmap_rows = db.execute(build_report_heatmap_query(user_id, period_start, period_end)).all()
    heatmap_data = {(int(row.day), int(row.hour)): int(row.count) for row in heatmap_rows if row.day is not None and row.hour is not None}
    
    listening_heatmap = []
    for day in range(7):
        for hour in range(24):
            listening_heatmap.append(HeatmapPoint(day=day, hour=hour, count=heatmap_data.get((day, hour), 0)))
            
    return ReportChartsResponse(
'''

content = content.replace('    return ReportChartsResponse(', heatmap_logic)
content = content.replace('        music_by_decade=[ReportPoint(label=f"{int(row.label)}s", count=int(row.count)) for row in decade_rows if row.label],\n    )', '        music_by_decade=[ReportPoint(label=f"{int(row.label)}s", count=int(row.count)) for row in decade_rows if row.label],\n        listening_heatmap=listening_heatmap,\n    )')

with open('backend/app/services/analytics_service.py', 'w') as f:
    f.write(content)
