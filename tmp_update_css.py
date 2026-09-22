import re

with open('frontend/src/styles.css', 'r') as f:
    content = f.read()

# report-facts
content = content.replace('.report-facts {\n  display: grid;\n  gap: 1rem;\n  grid-template-columns: repeat(3, 1fr);\n}', '.report-facts {\n  display: grid;\n  gap: 1rem;\n  grid-template-columns: repeat(4, 1fr);\n}')

# report-data-grid
content = content.replace('.report-data-grid {\n  display: grid;\n  gap: 1rem;\n  grid-template-columns: minmax(0, 1.4fr) minmax(0, 1fr);\n}', '.report-data-grid {\n  display: grid;\n  gap: 1rem;\n  grid-template-columns: minmax(0, 1fr);\n}')

# new styles
new_css = '''
.heatmap-container {
  display: flex;
  flex-direction: column;
}
.heatmap-body {
  display: flex;
}
.heatmap-y-axis {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding-right: 12px;
  color: var(--color-muted);
  font-size: 12px;
  padding-top: 8px;
  padding-bottom: 8px;
}
.heatmap-y-axis div {
  height: 16px;
  line-height: 16px;
}
.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(24, 16px);
  grid-template-rows: repeat(7, 16px);
  gap: 2px;
  flex-grow: 1;
}
.heatmap-cell {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  background-color: var(--color-surface-hover);
  transition: fill 140ms;
}
.heatmap-cell[data-level="1"] { background-color: rgba(0, 102, 255, 0.2); }
.heatmap-cell[data-level="2"] { background-color: rgba(0, 102, 255, 0.4); }
.heatmap-cell[data-level="3"] { background-color: rgba(0, 102, 255, 0.6); }
.heatmap-cell[data-level="4"] { background-color: rgba(0, 102, 255, 0.85); }
.heatmap-cell.peak { border: 1px solid var(--color-ink); box-sizing: border-box; }

.heatmap-x-axis {
  display: grid;
  grid-template-columns: repeat(24, 16px);
  gap: 2px;
  margin-left: 35px;
  margin-top: 8px;
  color: var(--color-muted);
  font-size: 12px;
}
.heatmap-x-label { grid-column: span 6; text-align: left; }
.chart-caption {
  margin-top: 16px;
  font-size: 13px;
  color: var(--color-muted);
}

.report-character-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.genre-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.genre-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  position: relative;
}
.genre-label { flex: 0 0 120px; text-transform: capitalize; }
.genre-bar-container { flex: 1; height: 24px; background: transparent; position: relative; }
.genre-bar {
  position: absolute;
  top: 0; left: 0; bottom: 0;
  background-color: rgba(0, 102, 255, 0.35);
  border-radius: 4px;
  transition: background-color 140ms;
}
.genre-row:hover .genre-bar {
  background-color: var(--color-accent);
}
.genre-count { flex: 0 0 40px; text-align: right; color: var(--color-muted); }
'''

# insert new CSS before media queries or at the end
content += new_css

# fix media queries
#   .report-category-grid,
#   .report-facts,
#   .report-data-grid {
content = content.replace('  .report-category-grid,\n  .report-facts,\n  .report-data-grid {\n    grid-template-columns: minmax(0, 1fr);\n  }', '  .report-category-grid,\n  .report-facts,\n  .report-data-grid,\n  .report-character-grid {\n    grid-template-columns: minmax(0, 1fr);\n  }\n  .heatmap-grid { grid-template-columns: repeat(24, 12px); grid-template-rows: repeat(7, 12px); }\n  .heatmap-cell { width: 12px; height: 12px; }\n  .heatmap-x-axis { grid-template-columns: repeat(24, 12px); }')

with open('frontend/src/styles.css', 'w') as f:
    f.write(content)
