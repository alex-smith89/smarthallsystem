import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { getErrorMessage } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login, user } = useAuth();

  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('Admin123!');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (user) {
    return <Navigate to="/" replace />;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await login(email, password);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function fillAdminDemo() {
    setEmail('admin@example.com');
    setPassword('Admin123!');
    setError('');
  }

  function fillInvigilatorDemo() {
    setEmail('invigilator@example.com');
    setPassword('Invigilator123!');
    setError('');
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-intro">
          <h1>Smart Exam Hall & Attendance System</h1>
          <p>
            Login to manage automatic seat allocation, QR attendance scanning,
            real-time hall monitoring, dashboard tracking, and reports.
          </p>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email"
              required
              autoComplete="email"
            />
          </label>

          <label className="form-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
              autoComplete="current-password"
            />
          </label>

          {error ? <div className="alert alert-error">{error}</div> : null}

          <button className="btn btn-primary" disabled={submitting} type="submit">
            {submitting ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <div className="demo-box">
          <p><strong>Demo Login Accounts</strong></p>

          <div className="form-actions">
            <button type="button" className="btn btn-secondary" onClick={fillAdminDemo}>
              Use Admin Demo
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={fillInvigilatorDemo}
            >
              Use Invigilator Demo
            </button>
          </div>

          <div style={{ marginTop: '12px' }}>
            <p style={{ margin: '6px 0' }}>
              <strong>Admin:</strong> admin@example.com / Admin123!
            </p>
            <p style={{ margin: '6px 0' }}>
              <strong>Invigilator:</strong> invigilator@example.com / Invigilator123!
            </p>
          </div>
        </div>

        <div className="demo-box" style={{ marginTop: '14px' }}>
          <p><strong>What you can do after login</strong></p>
          <ul style={{ margin: '8px 0 0 18px', padding: 0 }}>
            <li>Create and manage students, halls, and exams</li>
            <li>Generate seat allocations automatically</li>
            <li>Scan QR codes for attendance on phone</li>
            <li>Monitor present, absent, and hall occupancy in real time</li>
            <li>Export attendance and exam reports</li>
          </ul>
        </div>
      </div>
    </div>
  );
}