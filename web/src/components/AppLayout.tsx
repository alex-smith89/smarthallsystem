import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  { to: '/', label: 'Dashboard' },
  { to: '/students', label: 'Students' },
  { to: '/halls', label: 'Halls' },
  { to: '/exams', label: 'Exams' },
  { to: '/allocations', label: 'Allocations' },
  { to: '/attendance', label: 'Attendance Scanner' }
];

export default function AppLayout() {
  const { user, logout } = useAuth();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-card">
            <h1>Smart Exam Hall</h1>
            <p>Attendance & seat management</p>
          </div>

          <nav className="sidebar-nav">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  isActive ? 'sidebar-link sidebar-link-active' : 'sidebar-link'
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="user-badge">
            <strong>{user?.name}</strong>
            <span>{user?.role}</span>
          </div>
          <button
            className="btn btn-secondary full-width"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="page-shell">
        <header className="page-header">
          <div>
            <h2>Smart Exam Hall & Attendance System</h2>
            <p>Secure exam seating, QR attendance, and live monitoring.</p>
          </div>
        </header>

        <section className="page-content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}