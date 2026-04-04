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
  const [error, setError] = useState('');

  async function loadExams() {
    const response = await api.getExams();
    setExams(response.data);
  }

  async function loadSummary(examId?: string) {
    if (loading) {
      setLoading(true);
    } else {
      setPanelLoading(true);
    }

    setError('');

    try {
      const response = await api.getDashboardSummary(examId || undefined);
      setSummary(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
      setPanelLoading(false);
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

    const handler = () => {
      void loadSummary(selectedExamId || undefined);
    };

    socket.on('dashboard:updated', handler);

    return () => {
      socket.off('dashboard:updated', handler);
    };
  }, [selectedExamId]);

  const chartData = useMemo(() => {
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
              Monitor seat allocations, attendance progress, hall occupancy, and
              duplicate or invalid scan warnings in real time.
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
            <StatCard
              label="Attendance Progress"
              value={`${summary.summary.progress}%`}
            />
          </div>
        ) : null}
      </div>

      {selectedExamId && summary?.exam && summary?.summary ? (
        <>
          <div className="card">
            <h3>Selected Exam</h3>
            <div className="details-grid">
              <div><strong>Title:</strong> {summary.exam.title}</div>
              <div><strong>Subject:</strong> {summary.exam.subjectCode}</div>
              <div><strong>Date:</strong> {summary.exam.examDate}</div>
              <div><strong>Time:</strong> {summary.exam.startTime} - {summary.exam.endTime}</div>
              <div>
                <strong>Status:</strong>{' '}
                <span className={`pill pill-${summary.exam.status}`}>
                  {summary.exam.status}
                </span>
              </div>
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
                    <Pie data={chartData} dataKey="value" nameKey="name" outerRadius={100} label>
                      {chartData.map((_, index) => (
                        <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
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
            <h3>Recent Attendance</h3>
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Roll Number</th>
                    <th>Hall</th>
                    <th>Method</th>
                    <th>Scanned By</th>
                    <th>Time</th>
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
          </div>

          <div className="card">
            <h3>Scan Warnings</h3>
            {summary.warnings?.length ? (
              <div className="log-list">
                {summary.warnings.map((warning) => (
                  <article key={warning.id} className={`log-card log-${warning.result}`}>
                    <div className="log-top">
                      <strong>{warning.message}</strong>
                      <span>{formatDateTime(warning.createdAt)}</span>
                    </div>
                    <div>Result: {warning.result}</div>
                    <div>Student: {warning.student?.fullName ?? '-'}</div>
                    <div>QR Value: <code>{warning.qrCodeValue}</code></div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">No warning logs for this exam yet.</div>
            )}
          </div>

          <div className="card">
            <h3>Digital Seating Charts</h3>
            <div className="report-grid">
              {(summary.seatingCharts ?? []).map((hall) => (
                <div key={hall.hallId} className="seat-map-card">
                  <h4>{hall.hallName}</h4>
                  <div className="seat-grid">
                    {hall.seats.map((seat) => (
                      <div
                        key={seat.seatNumber}
                        className={`seat-chip ${seat.present ? 'seat-chip-present' : 'seat-chip-absent'}`}
                      >
                        <strong>{seat.seatNumber}</strong>
                        <span>{seat.rollNumber}</span>
                        <small>{seat.studentName}</small>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}