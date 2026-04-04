import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="card">
      <h3>Page not found</h3>
      <p>The page you are looking for does not exist.</p>
      <Link to="/" className="btn btn-primary">
        Go to Dashboard
      </Link>
    </div>
  );
}