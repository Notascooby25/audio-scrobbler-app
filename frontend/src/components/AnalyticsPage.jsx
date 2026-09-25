export default function AnalyticsPage({ eyebrow, title, children }) {
  return (
    <section className="dashboard analytics-page" aria-labelledby="analytics-page-heading">
      <p className="section-kicker">{eyebrow}</p>
      <h1 id="analytics-page-heading">{title}</h1>
      {children}
    </section>
  )
}