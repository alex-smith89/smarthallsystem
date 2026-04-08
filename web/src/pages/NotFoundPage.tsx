import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="center-screen">
      <div className="glass-panel empty-state" style={{ width: 'min(520px, 100%)' }}>
        <span className="section-eyebrow">404 Error</span>
        <h2>Page not found</h2>
        <p style={{ maxWidth: 420 }}>
          The page you are looking for does not exist or may have been moved.
        </p>
        <div className="action-row" style={{ justifyContent: 'center', marginTop: 12 }}>
          <Link to="/" className="primary-button">
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}