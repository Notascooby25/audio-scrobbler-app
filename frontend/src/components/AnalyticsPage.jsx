export default function AnalyticsPage({ eyebrow, title, children }) {
  return (
    <section className="dashboard analytics-page">
      <p className="section-kicker">{eyebrow}</p>
      <h1>{title}</h1>
      {children}
    </section>
  )
}