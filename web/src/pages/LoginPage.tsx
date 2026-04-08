import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getErrorMessage } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login, user } = useAuth();

  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('Admin@123!');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <div className="auth-hero glass-panel">
          <span className="auth-badge">Cyan / Aqua Glassmorphism</span>
          <h1>Smart Digital Exam Hall Management</h1>
          <p>
            Secure admin access for seat allocation, QR attendance, real-time dashboard,
            reports, and exam scheduling.
          </p>

          <div className="auth-feature-list">
            <div className="auth-feature-item">
              <strong>Automatic seat planning</strong>
              <span>Hall size, seat numbering, and exam assignment support.</span>
            </div>
            <div className="auth-feature-item">
              <strong>QR attendance</strong>
              <span>Fast scan, duplicate detection, and invalid QR protection.</span>
            </div>
            <div className="auth-feature-item">
              <strong>Live dashboard</strong>
              <span>Track present count, hall occupancy, and recent scans instantly.</span>
            </div>
          </div>
        </div>

        <form className="auth-card glass-panel" onSubmit={handleSubmit}>
          <div>
            <p className="section-eyebrow">Admin Login</p>
            <h2>Welcome back</h2>
            <p className="muted-text">
              Login to manage exams, students, halls, allocations, and attendance.
            </p>
          </div>

          <label className="form-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              autoComplete="email"
              required
            />
          </label>

          <label className="form-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              autoComplete="current-password"
              required
            />
          </label>

          {error ? <div className="alert alert-error">{error}</div> : null}

          <button className="primary-button auth-submit" type="submit" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Login to dashboard'}
          </button>

          <div className="demo-credentials">
            <span>Demo credentials</span>
            <strong>admin@example.com / Admin@123!</strong>
          </div>
        </form>
      </div>
    </div>
  );
}