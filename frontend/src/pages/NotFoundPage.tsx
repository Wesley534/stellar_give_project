import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="not-found">
      <span className="eyebrow">404</span>
      <h2>That page is not in this MVP yet.</h2>
      <p>
        The route you requested does not exist. Head back to login or open the
        dashboard placeholder.
      </p>
      <Link to="/">Return to login</Link>
    </section>
  )
}
