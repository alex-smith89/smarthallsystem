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
    description: 'Manage student profiles'
  },
  {
    to: '/halls',
    label: 'Halls',
    description: 'Manage exam venues'
  },
  {
    to: '/exams',
    label: 'Exams',
    description: 'Schedule exams and halls'
  },
  {
    to: '/allocations',
    label: 'Seat Allocation',
    description: 'Assign seats automatically'
  },
  {
    to: '/attendance',
    label: 'Attendance Scanner',
    description: 'Scan QR attendance'
  },
  {
    to: '/reports',
    label: 'Reports',
    description: 'Export summaries and data'
  }
] as const;

const pageMeta: Record<string, { title: string; subtitle: string }> = {
  '/': {
    title: 'Smart Digital Exam Hall Management',
    subtitle: 'Monitor attendance, seat allocation, and hall activity in real time.'
  },
  '/students': {
    title: 'Students',
    subtitle: 'Maintain the student list, QR codes, and semester details.'
  },
  '/halls': {
    title: 'Halls',
    subtitle: 'Configure buildings, floors, and hall capacities for scheduling.'
  },
  '/exams': {
    title: 'Exams',
    subtitle: 'Create exam schedules with halls, students, and time ranges.'
  },
  '/allocations': {
    title: 'Seat Allocation',
    subtitle: 'Generate clean seat plans automatically for each exam.'
  },
  '/attendance': {
    title: 'Attendance Scanner',
    subtitle: 'Use QR scan or manual marking and sync instantly to the dashboard.'
  },
  '/reports': {
    title: 'Reports',
    subtitle: 'Review attendance insights, exports, and seat allocation summaries.'
  }
};

export default function AppLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const currentMeta = useMemo(() => {
    if (pageMeta[location.pathname]) {
      return pageMeta[location.pathname];
    }

    const matched = Object.entries(pageMeta).find(([path]) =>
      path !== '/' && location.pathname.startsWith(path)
    );

    return matched?.[1] || pageMeta['/'];
  }, [location.pathname]);

  const initials = useMemo(() => {
    const name = user?.name?.trim() || 'Admin User';
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() || '')
      .join('');
  }, [user?.name]);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div>
          <div className="brand-card">
            <div className="brand-badge">SE</div>
            <div>
              <p className="brand-eyebrow">Cyan Glass Theme</p>
              <h1>Smart Exam System</h1>
            </div>
          </div>

          <nav className="nav-list">
            {navItems.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  isActive ? 'nav-link nav-link-active' : 'nav-link'
                }
              >
                <span className="nav-link-label">{item.label}</span>
                <span className="nav-link-description">{item.description}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="user-chip glass-panel">
            <div className="user-avatar">{initials || 'AU'}</div>
            <div>
              <strong>{user?.name || 'Admin User'}</strong>
              <p>{user?.role || 'Administrator'}</p>
            </div>
          </div>
          <button className="secondary-button full-width" onClick={logout}>
            Logout
          </button>
        </div>
      </aside>

      <main className="page-shell">
        <header className="page-header glass-panel">
          <div>
            <p className="section-eyebrow">Dashboard Workspace</p>
            <h2>{currentMeta.title}</h2>
            <p>{currentMeta.subtitle}</p>
          </div>
          <div className="header-status">
            <span className="status-dot" />
            <div>
              <strong>System online</strong>
              <p>Live dashboard and QR attendance are active.</p>
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