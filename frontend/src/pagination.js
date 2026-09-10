export function buildPageItems(currentPage, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1)
  }

  const keep = new Set([1, 2, totalPages - 1, totalPages, currentPage - 1, currentPage, currentPage + 1])
  const pages = [...keep].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b)

  const items = []
  let previous = null
  for (const page of pages) {
    if (previous !== null && page - previous > 1) {
      items.push('...')
    }
    items.push(page)
    previous = page
  }
  return items
}
