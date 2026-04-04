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
import { api, formatDateTime, getErrorMessage } from '../lib/api';
import { getSocket } from '../lib/socket';
import type { DashboardSummaryResponse, Exam } from '../types';
import LoadingScreen from '../components/LoadingScreen';
import StatCard from '../components/StatCard';

const PIE_COLORS = ['#2563eb', '#16a34a', '#dc2626'];

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
    if (!selectedExamId && response.data.length > 0) {
      setSelectedExamId(response.data[0]._id);
    }
  }

  async function loadSummary(examId?: string) {
    setPanelLoading(true);
    setError('');

    try {
      const response = await api.getDashboardSummary(examId);
      setSummary(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setPanelLoading(false);
      setLoading(false);
    }
  }

  useEffect(() => {
    async function init() {
      try {
        await loadExams();
      } catch (err) {
        setError(getErrorMessage(err));
        setLoading(false);
      }
    }

    void init();
  }, []);

  useEffect(() => {
    if (!selectedExamId) {
      void loadSummary();
      return;
    }

    void loadSummary(selectedExamId);
  }, [selectedExamId]);

  useEffect(() => {
    const socket = getSocket();

    const handler = (payload: { examId?: string }) => {
      if (!selectedExamId || payload.examId === selectedExamId) {
        void loadSummary(selectedExamId || undefined);
      }
    };

    socket.on('dashboard:updated', handler);

    if (selectedExamId) {
      socket.emit('dashboard:join', selectedExamId);
    }

    return () => {
      socket.off('dashboard:updated', handler);
    };
  }, [selectedExamId]);

  const summaryCards = useMemo(() => {
    if (!summary?.summary) {
      return null;
    }

    return (
      <div className="stats-grid">
        <StatCard
          label="Assigned Students"
          value={summary.summary.assigned}
        />
        <StatCard
          label="Present"
          value={summary.summary.present}
        />
        <StatCard
          label="Absent"
          value={summary.summary.absent}
        />
        <StatCard
          label="Attendance Progress"
          value={`${summary.summary.progress}%`}
        />
      </div>
    );
  }, [summary]);

  const chartData = useMemo(() => {
    if (!summary?.summary) {
      return [];
    }

    return [
      { name: 'Assigned', value: summary.summary.assigned },
      { name: 'Present', value: summary.summary.present },
      { name: 'Absent', value: summary.summary.absent }
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
            <h3>Live Dashboard</h3>
            <p>Monitor attendance progress, hall occupancy, and warning logs in real time.</p>
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
                  <option
                    key={exam._id}
                    value={exam._id}
                  >
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
            <StatCard
              label="Total Exams"
              value={summary.examCount ?? 0}
            />
            <StatCard
              label="Total Allocations"
              value={summary.allocationCount ?? 0}
            />
            <StatCard
              label="Attendance Records"
              value={summary.attendanceCount ?? 0}
            />
            <StatCard
              label="Info"
              value={summary.message || 'Select an exam'}
            />
          </div>
        ) : null}

        {selectedExamId && summaryCards}
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
              <div><strong>Status:</strong> <span className={`pill pill-${summary.exam.status}`}>{summary.exam.status}</span></div>
            </div>
          </div>

          <div className="charts-grid">
            <div className="card chart-card">
              <h3>Attendance Summary</h3>
              <div className="chart-area">
                <ResponsiveContainer
                  width="100%"
                  height={300}
                >
                  <PieChart>
                    <Pie
                      data={chartData}
                      dataKey="value"
                      nameKey="name"
                      outerRadius={100}
                      label
                    >
                      {chartData.map((_, index) => (
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
                <ResponsiveContainer
                  width="100%"
                  height={300}
                >
                  <BarChart data={summary.hallOccupancy ?? []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="hallName" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="assigned"
                      fill="#2563eb"
                      name="Assigned"
                    />
                    <Bar
                      dataKey="present"
                      fill="#16a34a"
                      name="Present"
                    />
                    <Bar
                      dataKey="capacity"
                      fill="#94a3b8"
                      name="Capacity"
                    />
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
                  </tr>
                </thead>
                <tbody>
                  {(summary.hallOccupancy ?? []).map((hall) => (
                    <tr key={hall.hallName}>
                      <td>{hall.hallName}</td>
                      <td>{hall.capacity}</td>
                      <td>{hall.assigned}</td>
                      <td>{hall.present}</td>
                      <td>{Math.max(hall.capacity - hall.present, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3>Recent Warnings / Scan Events</h3>
            {!summary.warnings?.length ? (
              <div className="empty-state">No scan warnings yet.</div>
            ) : (
              <div className="log-list">
                {summary.warnings.map((warning) => (
                  <div
                    key={warning.id}
                    className={`log-card log-${warning.result}`}
                  >
                    <div className="log-top">
                      <strong>{warning.result.toUpperCase()}</strong>
                      <span>{formatDateTime(warning.createdAt)}</span>
                    </div>
                    <p>{warning.message}</p>
                    {warning.student ? (
                      <small>
                        {warning.student.fullName} ({warning.student.rollNumber})
                      </small>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}