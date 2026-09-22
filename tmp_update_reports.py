import re

with open('frontend/src/pages/ReportsPage.jsx', 'r') as f:
    content = f.read()

# Replace ListeningClockChart import
content = content.replace("import ListeningClockChart from '../components/charts/ListeningClockChart'", "import ListeningHeatmap from '../components/charts/ListeningHeatmap'\nimport GenreBarList from '../components/charts/GenreBarList'")

# Replace the data grid structure
# Old:
#       {report && <div className="report-data-grid">
#         <BarTrendChart title="Scrobbles over time" points={report.charts.weekly_scrobbles} />
#         <ListeningClockChart points={report.charts.listening_clock} />
#       </div>}
# New: Heatmap below Scrobbles over time. Wait, the mockup says they are in `report-data-grid` (now single column full width).
# Both in `report-data-grid` or just one under another.

new_data_grid = '''      {report && <div className="report-data-grid">
        <BarTrendChart title="Scrobbles over time" points={report.charts.weekly_scrobbles} />
        <div className="chart-panel">
          <h2>Listening routines</h2>
          <ListeningHeatmap points={report.charts.listening_heatmap} />
          <div className="chart-caption">Your listening activity mapped by hour and day of the week.</div>
        </div>
      </div>}
      {report && <div className="report-character-grid">
        <div className="chart-panel">
          <h2>Music by decade</h2>
          <BarTrendChart title="Releases by decade" points={report.charts.music_by_decade} />
        </div>
        <div className="chart-panel">
          <h2>Top genres</h2>
          <GenreBarList genres={report.genres?.entries?.map(e => ({ label: e.label, count: e.play_count })) || []} />
        </div>
      </div>}'''

content = re.sub(r'\{report && <div className="report-data-grid">.*?</div>\}', new_data_grid, content, flags=re.DOTALL)

# Delete the old decade chart section at the bottom
content = re.sub(r'\{report && report\.charts\.music_by_decade.*?</div>\s*\)\}', '', content, flags=re.DOTALL)

# Add fetchReportsEntity for genres
#       fetchReportsEntity({ token: session.accessToken, entity: 'artists', dateRange, userId: targetUserId }),
#       fetchReportsEntity({ token: session.accessToken, entity: 'albums', dateRange, userId: targetUserId }),
#       fetchReportsEntity({ token: session.accessToken, entity: 'tracks', dateRange, userId: targetUserId }),
#       fetchReportsEntity({ token: session.accessToken, entity: 'genres', dateRange, userId: targetUserId }),

fetch_calls = '''      fetchReportsEntity({ token: session.accessToken, entity: 'artists', dateRange, userId: targetUserId }),
      fetchReportsEntity({ token: session.accessToken, entity: 'albums', dateRange, userId: targetUserId }),
      fetchReportsEntity({ token: session.accessToken, entity: 'tracks', dateRange, userId: targetUserId }),
      fetchReportsEntity({ token: session.accessToken, entity: 'genres', dateRange, userId: targetUserId }),'''
content = content.replace("      fetchReportsEntity({ token: session.accessToken, entity: 'artists', dateRange, userId: targetUserId }),\n      fetchReportsEntity({ token: session.accessToken, entity: 'albums', dateRange, userId: targetUserId }),\n      fetchReportsEntity({ token: session.accessToken, entity: 'tracks', dateRange, userId: targetUserId }),", fetch_calls)

# ]).then(([summary, charts, artists, albums, tracks]) => setReport({ summary, charts, artists, albums, tracks }))
content = content.replace("]).then(([summary, charts, artists, albums, tracks]) => setReport({ summary, charts, artists, albums, tracks }))", "]).then(([summary, charts, artists, albums, tracks, genres]) => setReport({ summary, charts, artists, albums, tracks, genres }))")

with open('frontend/src/pages/ReportsPage.jsx', 'w') as f:
    f.write(content)
