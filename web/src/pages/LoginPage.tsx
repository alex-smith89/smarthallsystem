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

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-intro">
          <h1>Smart Exam Hall System</h1>
          <p>
            Login to manage seat allocation, QR attendance, real-time dashboard,
            and reports.
          </p>
        </div>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="form-field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error ? <div className="alert alert-error">{error}</div> : null}

          <button className="btn btn-primary" disabled={submitting} type="submit">
            {submitting ? 'Signing in...' : 'Login'}
          </button>
        </form>

        <div className="demo-box">
          <p><strong>Demo accounts</strong></p>
          <p>Admin: admin@example.com / Admin123!</p>
          <p>Invigilator: invigilator@example.com / Invigilator123!</p>
        </div>
      </div>
    </div>
  );
}