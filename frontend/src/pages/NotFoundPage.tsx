import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="not-found-page">
      <div>
        <div className="not-found-code">404</div>
        <h2>Page not found</h2>
        <p>The page you're looking for doesn't exist or has been moved.</p>
        <Link to="/" className="btn btn-primary">
          ← Back to Home
        </Link>
      </div>
    </div>
  );
}
