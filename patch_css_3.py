with open("frontend/src/styles.css", "r") as f:
    content = f.read()

# Insert before media query
media_query_start = "@media (max-width: 768px) {"

desktop_def = """
.report-character-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

"""

if media_query_start in content:
    content = content.replace(media_query_start, desktop_def + media_query_start)
else:
    print("Could not find media query.")

with open("frontend/src/styles.css", "w") as f:
    f.write(content)
