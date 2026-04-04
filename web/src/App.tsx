import { Navigate, Route, Routes } from 'react-router-dom';
import AppLayout from './components/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import AllocationsPage from './pages/AllocationsPage';
import AttendanceScannerPage from './pages/AttendanceScannerPage';
import DashboardPage from './pages/DashboardPage';
import ExamsPage from './pages/ExamsPage';
import HallsPage from './pages/HallsPage';
import LoginPage from './pages/LoginPage';
import NotFoundPage from './pages/NotFoundPage';
import ReportsPage from './pages/ReportsPage';
import StudentsPage from './pages/StudentsPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="students" element={<StudentsPage />} />
        <Route path="halls" element={<HallsPage />} />
        <Route path="exams" element={<ExamsPage />} />
        <Route path="allocations" element={<AllocationsPage />} />
        <Route path="attendance" element={<AttendanceScannerPage />} />
        <Route path="scanner" element={<AttendanceScannerPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="404" element={<NotFoundPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}