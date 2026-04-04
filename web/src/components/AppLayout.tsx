import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';

const navItems = [
  {
    to: '/',
    label: 'Dashboard',
    description: 'Real-time exam monitoring'
  },
  {
    to: '/students',
    label: 'Students',
    description: 'Student records and QR cards'
  },
  {
    to: '/halls',
    label: 'Halls',
    description: 'Hall setup and capacity'
  },
  {
    to: '/exams',
    label: 'Exams',
    description: 'Exam creation and setup'
  },
  {
    to: '/allocations',
    label: 'Allocations',
    description: 'Seat generation and charts'
  },
  {
    to: '/attendance',
    label: 'Scanner',
    description: 'QR attendance scanning'
  },
  {
    to: '/reports',
    label: 'Reports',
    description: 'Exports and report views'
  }
];

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Dashboard',
    subtitle:
      'Monitor attendance, hall occupancy, scan warnings, and seating charts in real time.'
  },
  '/students': {
    title: 'Students',
    subtitle:
      'Manage students, preview QR codes, and print QR attendance cards.'
  },
  '/halls': {
    title: 'Halls',
    subtitle:
      'Configure halls, seating capacity, layout rows and columns, and seat prefixes.'
  },
  '/exams': {
    title: 'Exams',
    subtitle:
      'Create exams, assign halls and students, and manage exam status.'
  },
  '/allocations': {
    title: 'Seat Allocations',
    subtitle:
      'Generate automatic seating and print hall-wise seating charts.'
  },
  '/attendance': {
    title: 'Attendance Scanner',
    subtitle:
      'Scan QR codes, handle duplicate or invalid scans, and mark manual attendance.'
  },
  '/scanner': {
    title: 'Attendance Scanner',
    subtitle:
      'Use mobile-friendly QR scanning for fast exam hall attendance.'
  },
  '/reports': {
    title: 'Reports',
    subtitle:
      'View attendance reports, hall occupancy, absent lists, warnings, and exports.'
  }
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const currentPage = useMemo(() => {
    return pageMeta[location.pathname] ?? {
      title: 'Smart Exam Hall & Attendance System',
      subtitle:
        'Manage exams, seating, attendance, monitoring, and reporting.'
    };
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-card">
            <h1>Smart Exam Hall</h1>
            <p>Seat allocation, QR attendance, dashboard, and reports</p>
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
                <div style={{ fontWeight: 700 }}>{item.label}</div>
                <div style={{ fontSize: '0.84rem', opacity: 0.9 }}>
                  {item.description}
                </div>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="user-badge">
            <strong>{user?.name || 'User'}</strong>
            <span>{user?.role || 'unknown role'}</span>
            <span>{user?.email || ''}</span>
          </div>

          <button
            type="button"
            className="btn btn-secondary full-width"
            onClick={logout}
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="page-shell">
        <header className="page-header">
          <div className="card">
            <div className="card-header-row" style={{ marginBottom: 0 }}>
              <div>
                <h2 style={{ marginBottom: '8px' }}>{currentPage.title}</h2>
                <p>{currentPage.subtitle}</p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700 }}>{user?.name}</div>
                <div style={{ color: '#64748b', textTransform: 'capitalize' }}>
                  {user?.role}
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="page-content">
          <Outlet />
        </section>
      </main>
    </div>
  );
}