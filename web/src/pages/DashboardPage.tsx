import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import LoadingScreen from '../components/LoadingScreen';
import StatCard from '../components/StatCard';
import { api, formatDateTime, getErrorMessage } from '../lib/api';
import { getSocket } from '../lib/socket';
import type { DashboardSummaryResponse, Exam } from '../types';

const PIE_COLORS = ['#2563eb', '#16a34a', '#f59e0b'];

export default function DashboardPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [summary, setSummary] = useState<DashboardSummaryResponse | null>(null);

  const [loading, setLoading] = useState(true);
  const [panelLoading, setPanelLoading] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadExams() {
    const response = await api.getExams();
    setExams(response.data);

    if (!selectedExamId && response.data.length > 0) {
      setSelectedExamId(response.data[0]._id);
    }
  }

  async function loadSummary(examId?: string, silent = false) {
    if (!silent) {
      if (loading) {
        setLoading(true);
      } else {
        setPanelLoading(true);
      }
    }

    setError('');

    try {
      const response = await api.getDashboardSummary(examId || undefined);
      setSummary(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      if (!silent) {
        setLoading(false);
        setPanelLoading(false);
      }
    }
  }

  useEffect(() => {
    async function init() {
      try {
        await loadExams();
        await loadSummary();
      } catch (err) {
        setError(getErrorMessage(err));
        setLoading(false);
      }
    }

    void init();
  }, []);

  useEffect(() => {
    void loadSummary(selectedExamId || undefined);
  }, [selectedExamId]);

  useEffect(() => {
    const socket = getSocket();

    if (selectedExamId) {
      socket.emit('dashboard:join', selectedExamId);
    }

    const handler = (payload?: { examId?: string; type?: string }) => {
      if (!selectedExamId || !payload?.examId || payload.examId === selectedExamId) {
        setMessage('Dashboard updated live.');
        void loadSummary(selectedExamId || undefined, true);

        window.setTimeout(() => {
          setMessage('');
        }, 1500);
      }
    };

    socket.on('dashboard:updated', handler);

    return () => {
      socket.off('dashboard:updated', handler);
    };
  }, [selectedExamId]);

  const attendanceChartData = useMemo(() => {
    if (!summary?.summary) return [];

    return [
      { name: 'Present', value: summary.summary.present },
      { name: 'Absent', value: summary.summary.absent },
      {
        name: 'Pending',
        value: Math.max(summary.summary.assigned - summary.summary.present - summary.summary.absent, 0)
      }
    ];
  }, [summary]);

  const scanStatsChartData = useMemo(() => {
    if (!summary?.scanStats) return [];

    return [
      { name: 'Valid', value: summary.scanStats.valid },
      { name: 'Duplicate', value: summary.scanStats.duplicate },
      { name: 'Invalid', value: summary.scanStats.invalid },
      { name: 'Manual', value: summary.scanStats.manual }
    ];
  }, [summary]);

  const topWarnings = useMemo(() => {
    return (summary?.warnings ?? []).slice(0, 10);
  }, [summary]);

  if (loading) {
    return <LoadingScreen text="Loading dashboard..." />;
  }

  return (
    <div className="page-stack">
      <div className="card">
        <div className="card-header-row">
          <div>
            <h3>Real-Time Dashboard</h3>
            <p>
              Monitor total assigned students, present and absent count, hall occupancy,
              attendance progress, seating charts, and duplicate or invalid scan warnings.
            </p>
          </div>

          <div className="inline-filter">
            <label className="form-field">
              <span>Select Exam</span>
              <select
                value={selectedExamId}
                onChange={(event) => setSelectedExamId(event.target.value)}
              >
                <option value="">All exams summary</option>
                {exams.map((exam) => (
                  <option key={exam._id} value={exam._id}>
                    {exam.subjectCode} - {exam.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-error">{error}</div> : null}
        {panelLoading ? <div className="alert alert-info">Refreshing dashboard...</div> : null}

        {!selectedExamId && summary ? (
          <div className="stats-grid">
            <StatCard label="Total Exams" value={summary.examCount ?? 0} />
            <StatCard label="Total Allocations" value={summary.allocationCount ?? 0} />
            <StatCard label="Attendance Records" value={summary.attendanceCount ?? 0} />
            <StatCard label="Warning Logs" value={summary.warningCount ?? 0} />
          </div>
        ) : null}

        {selectedExamId && summary?.summary ? (
          <div className="stats-grid">
            <StatCard label="Assigned Students" value={summary.summary.assigned} />
            <StatCard label="Present" value={summary.summary.present} />
            <StatCard label="Absent" value={summary.summary.absent} />
            <StatCard label="Attendance Progress" value={`${summary.summary.progress}%`} />
          </div>
        ) : null}
      </div>

      {selectedExamId && summary?.exam && summary?.summary ? (
        <>
          <div className="card">
            <div className="card-header-row">
              <div>
                <h3>Selected Exam Overview</h3>
                <p>Live details for the selected exam session.</p>
              </div>

              <span className={`pill pill-${summary.exam.status}`}>
                {summary.exam.status}
              </span>
            </div>

            <div className="details-grid">
              <div><strong>Subject Code:</strong> {summary.exam.subjectCode}</div>
              <div><strong>Exam Title:</strong> {summary.exam.title}</div>
              <div><strong>Exam Date:</strong> {summary.exam.examDate}</div>
              <div><strong>Start Time:</strong> {summary.exam.startTime}</div>
              <div><strong>End Time:</strong> {summary.exam.endTime}</div>
              <div><strong>Status:</strong> {summary.exam.status}</div>
            </div>
          </div>

          {summary.scanStats ? (
            <div className="stats-grid">
              <StatCard label="Valid Scans" value={summary.scanStats.valid} />
              <StatCard label="Duplicate Scans" value={summary.scanStats.duplicate} />
              <StatCard label="Invalid Scans" value={summary.scanStats.invalid} />
              <StatCard label="Manual Marks" value={summary.scanStats.manual} />
            </div>
          ) : null}

          <div className="charts-grid">
            <div className="card chart-card">
              <h3>Attendance Summary</h3>
              <div className="chart-area">
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={attendanceChartData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={95}
                      label
                    >
                      {attendanceChartData.map((_, index) => (
                        <Cell
                          key={index}
                          fill={PIE_COLORS[index % PIE_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card chart-card">
              <h3>Hall Occupancy</h3>
              <div className="chart-area">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={summary.hallOccupancy ?? []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hallName" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="assigned" fill="#2563eb" name="Assigned" />
                    <Bar dataKey="present" fill="#16a34a" name="Present" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="charts-grid">
            <div className="card chart-card">
              <h3>Scan Statistics</h3>
              <div className="chart-area">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={scanStatsChartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="value" fill="#2563eb" name="Count" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="card">
              <h3>Quick Dashboard Notes</h3>
              <div className="form-grid">
                <div>
                  <strong>Total Assigned:</strong> {summary.summary.assigned}
                </div>
                <div>
                  <strong>Total Present:</strong> {summary.summary.present}
                </div>
                <div>
                  <strong>Total Absent:</strong> {summary.summary.absent}
                </div>
                <div>
                  <strong>Attendance Progress:</strong> {summary.summary.progress}%
                </div>
                <div>
                  <strong>Duplicate Scans:</strong> {summary.scanStats?.duplicate ?? 0}
                </div>
                <div>
                  <strong>Invalid Scans:</strong> {summary.scanStats?.invalid ?? 0}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Hall Occupancy Details</h3>
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Hall</th>
                    <th>Capacity</th>
                    <th>Assigned</th>
                    <th>Present</th>
                    <th>Vacant</th>
                    <th>Occupancy %</th>
                  </tr>
                </thead>
                <tbody>
                  {(summary.hallOccupancy ?? []).map((hall) => (
                    <tr key={hall.hallId}>
                      <td>{hall.hallName}</td>
                      <td>{hall.capacity}</td>
                      <td>{hall.assigned}</td>
                      <td>{hall.present}</td>
                      <td>{hall.vacant}</td>
                      <td>{hall.occupancyPercent}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3>Recent Attendance Activity</h3>
            {(summary.recentAttendance ?? []).length > 0 ? (
              <div className="responsive-table">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Roll Number</th>
                      <th>Hall</th>
                      <th>Method</th>
                      <th>Scanned By</th>
                      <th>Scanned At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(summary.recentAttendance ?? []).map((item) => (
                      <tr key={item.id}>
                        <td>{item.studentName}</td>
                        <td>{item.rollNumber}</td>
                        <td>{item.hallName}</td>
                        <td>
                          <span className="pill pill-completed">{item.scanMethod}</span>
                        </td>
                        <td>{item.scannedBy}</td>
                        <td>{formatDateTime(item.scannedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">No attendance activity recorded yet.</div>
            )}
          </div>

          <div className="card">
            <h3>Warnings and Scan Issues</h3>
            {topWarnings.length > 0 ? (
              <div className="log-list">
                {topWarnings.map((warning) => (
                  <article
                    key={warning.id}
                    className={`log-card ${
                      warning.result === 'duplicate' ? 'log-warning' : 'log-error'
                    }`}
                  >
                    <div className="log-top">
                      <strong>{warning.message}</strong>
                      <span>{formatDateTime(warning.createdAt)}</span>
                    </div>

                    <div><strong>Result:</strong> {warning.result}</div>
                    <div><strong>Student:</strong> {warning.student?.fullName ?? '-'}</div>
                    <div><strong>Roll Number:</strong> {warning.student?.rollNumber ?? '-'}</div>
                    <div><strong>QR Value:</strong> <code>{warning.qrCodeValue}</code></div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">No duplicate or invalid scan warnings.</div>
            )}
          </div>

          <div className="card">
            <h3>Digital Seating Chart Preview</h3>
            {(summary.seatingCharts ?? []).length > 0 ? (
              <div className="report-grid">
                {(summary.seatingCharts ?? []).map((hall) => (
                  <div key={hall.hallId} className="seat-map-card">
                    <h4>{hall.hallName}</h4>

                    <div className="seat-grid">
                      {hall.seats.map((seat) => (
                        <div
                          key={`${hall.hallId}-${seat.seatNumber}`}
                          className={`seat-chip ${
                            seat.present ? 'seat-chip-present' : 'seat-chip-absent'
                          }`}
                        >
                          <strong>{seat.seatNumber}</strong>
                          <span>{seat.rollNumber}</span>
                          <small>{seat.studentName}</small>
                          <small>{seat.present ? 'PRESENT' : 'ABSENT'}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-state">No seating chart data available yet.</div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}