with open("frontend/src/styles.css", "r") as f:
    content = f.read()

# Remove the trailing .report-character-grid
trailing = """
.report-character-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
"""

if trailing in content:
    content = content.replace(trailing, "")
else:
    print("Could not find trailing report-character-grid block.")

with open("frontend/src/styles.css", "w") as f:
    f.write(content)
