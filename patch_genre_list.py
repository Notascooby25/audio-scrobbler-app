with open("frontend/src/components/charts/GenreBarList.jsx", "r") as f:
    content = f.read()

content = content.replace(
    "if (!genres || genres.length === 0) return null",
    "if (!genres || genres.length === 0) return <p className=\"notice\">No genre data available for this period. Background syncing may still be processing your recent listening.</p>"
)

with open("frontend/src/components/charts/GenreBarList.jsx", "w") as f:
    f.write(content)
