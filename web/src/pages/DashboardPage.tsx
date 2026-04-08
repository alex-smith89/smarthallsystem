import { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
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
  YAxis,
  Line,
  LineChart
} from 'recharts';
import LoadingScreen from '../components/LoadingScreen';
import StatCard from '../components/StatCard';
import {
  api,
  getErrorMessage,
  type DashboardExamOverview,
  type DashboardHallForecastItem,
  type DashboardHallOccupancy,
  type DashboardHallRef,
  type DashboardRecentLog,
  type DashboardSummaryData,
  type DashboardTrendPoint
} from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';

type ScanChartItem = {
  name: string;
  value: number;
};

type HallChartItem = {
  name: string;
  allocated: number;
  present: number;
};

type TrendChartItem = {
  date: string;
  attendanceRate: number;
  occupancyRate: number;
};

const pieColors = ['#36e4ff', '#7af6ff', '#41cfff', '#1596c2'];

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardSummaryData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  async function loadDashboard(showLoader = false): Promise<void> {
    if (showLoader) {
      setLoading(true);
    }

    try {
      const response = await api.getDashboardSummary();
      setDashboard(response.data);
      setError(null);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard(true);

    const socket = connectSocket();
    const refresh = () => {
      void loadDashboard(false);
    };

    socket.on('dashboard:updated', refresh);

    return () => {
      socket.off('dashboard:updated', refresh);
      disconnectSocket();
    };
  }, []);

  const scanChartData = useMemo<ScanChartItem[]>(() => {
    if (!dashboard) return [];

    return [
      { name: 'Valid', value: dashboard.scans.valid || 0 },
      { name: 'Invalid', value: dashboard.scans.invalid || 0 },
      { name: 'Duplicate', value: dashboard.scans.duplicate || 0 },
      { name: 'Manual', value: dashboard.scans.manual || 0 }
    ];
  }, [dashboard]);

  const hallChartData = useMemo<HallChartItem[]>(() => {
    if (!dashboard) return [];

    return dashboard.hallOccupancy.map((item: DashboardHallOccupancy) => ({
      name: item.subjectCode,
      allocated: item.allocated,
      present: item.present
    }));
  }, [dashboard]);

  const trendChartData = useMemo<TrendChartItem[]>(() => {
    if (!dashboard) return [];

    return dashboard.trend.map((item: DashboardTrendPoint) => ({
      date: item.date,
      attendanceRate: item.attendanceRate,
      occupancyRate: item.occupancyRate
    }));
  }, [dashboard]);

  const todaysExamCount = dashboard?.todayExams.length || 0;
  const forecastCount = dashboard?.hallForecast.length || 0;

  const liveStatusText =
    todaysExamCount > 0
      ? `${todaysExamCount} active exam${todaysExamCount > 1 ? 's' : ''} today`
      : 'No exams scheduled today';

  if (loading) {
    return <LoadingScreen text="Loading dashboard summary..." />;
  }

  if (error) {
    return (
      <div className="stack-lg">
        <div className="alert alert-error">{error}</div>
        <button
          type="button"
          className="primary-button"
          onClick={() => {
            void loadDashboard(true);
          }}
        >
          Retry dashboard
        </button>
      </div>
    );
  }

  if (!dashboard) {
    return <div className="alert alert-warning">No dashboard data found.</div>;
  }

  return (
    <div className="stack-xl">
      <section className="hero-panel glass-panel">
        <div>
          <span className="section-eyebrow">Live overview</span>
          <h2>Exam operations dashboard</h2>
          <p>
            View today&apos;s attendance flow, monitor hall occupancy, track QR scanning
            performance, and forecast future hall load in one place.
          </p>
        </div>

        <div className="hero-metrics">
          <div className="hero-metric-card">
            <span className="hero-metric-label">System status</span>
            <strong>Online</strong>
            <small>{liveStatusText}</small>
          </div>

          <div className="hero-metric-card">
            <span className="hero-metric-label">Attendance rate</span>
            <strong>{dashboard.cards.attendanceRate}%</strong>
            <small>Based on today&apos;s present vs seat allocations</small>
          </div>

          <div className="hero-metric-card">
            <span className="hero-metric-label">Forecast sessions</span>
            <strong>{forecastCount}</strong>
            <small>Upcoming hall sessions with occupancy prediction</small>
          </div>
        </div>
      </section>

      <section className="stats-grid">
        <StatCard
          label="Total Students"
          value={dashboard.cards.totalStudents}
          helper={`${dashboard.cards.activeStudents} active students`}
          tone="primary"
        />

        <StatCard
          label="Total Halls"
          value={dashboard.cards.totalHalls}
          helper="Configured halls ready for scheduling"
        />

        <StatCard
          label="Total Exams"
          value={dashboard.cards.totalExams}
          helper={`${dashboard.cards.todayExams} exam(s) today`}
          tone="success"
        />

        <StatCard
          label="Seat Allocations Today"
          value={dashboard.cards.todaySeatAllocations}
          helper="Students assigned seats for today"
          tone="warning"
        />

        <StatCard
          label="Present Today"
          value={dashboard.cards.todayPresent}
          helper={`Scans today: ${dashboard.cards.scansToday}`}
          tone="success"
        />

        <StatCard
          label="Attendance Rate"
          value={`${dashboard.cards.attendanceRate}%`}
          helper="Calculated from allocated vs present"
          tone="primary"
        />
      </section>

      <section className="dashboard-grid-two">
        <div className="glass-panel chart-panel">
          <div className="panel-header-row">
            <div>
              <span className="section-eyebrow">QR scan insights</span>
              <h3>Scan breakdown</h3>
            </div>
          </div>

          <div className="chart-wrapper large-chart">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={scanChartData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={65}
                  outerRadius={105}
                  paddingAngle={3}
                >
                  {scanChartData.map((entry: ScanChartItem, index: number) => (
                    <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="metric-chip-row">
            <span className="metric-chip">Valid: {dashboard.scans.valid}</span>
            <span className="metric-chip">Invalid: {dashboard.scans.invalid}</span>
            <span className="metric-chip">Duplicate: {dashboard.scans.duplicate}</span>
            <span className="metric-chip">Manual: {dashboard.scans.manual}</span>
          </div>
        </div>

        <div className="glass-panel chart-panel">
          <div className="panel-header-row">
            <div>
              <span className="section-eyebrow">Hall performance</span>
              <h3>Seat allocation vs present count</h3>
            </div>
          </div>

          <div className="chart-wrapper large-chart">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hallChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis dataKey="name" stroke="#a9d8e6" />
                <YAxis stroke="#a9d8e6" />
                <Tooltip />
                <Legend />
                <Bar dataKey="allocated" fill="#36e4ff" radius={[10, 10, 0, 0]} />
                <Bar dataKey="present" fill="#7af6ff" radius={[10, 10, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="dashboard-grid-two">
        <div className="glass-panel chart-panel">
          <div className="panel-header-row">
            <div>
              <span className="section-eyebrow">Attendance trend</span>
              <h3>Recent attendance and occupancy pattern</h3>
            </div>
          </div>

          {trendChartData.length > 0 ? (
            <div className="chart-wrapper large-chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trendChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="date" stroke="#a9d8e6" />
                  <YAxis stroke="#a9d8e6" domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="attendanceRate"
                    stroke="#36e4ff"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    name="Attendance %"
                  />
                  <Line
                    type="monotone"
                    dataKey="occupancyRate"
                    stroke="#7af6ff"
                    strokeWidth={3}
                    dot={{ r: 3 }}
                    name="Hall fill %"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state compact-empty-state">
              <h4>No trend data yet</h4>
              <p>Add more exam history to show attendance and hall usage trends.</p>
            </div>
          )}
        </div>

        <div className="glass-panel chart-panel">
          <div className="panel-header-row">
            <div>
              <span className="section-eyebrow">Upcoming forecast</span>
              <h3>Predicted hall occupancy</h3>
            </div>
          </div>

          {dashboard.hallForecast.length > 0 ? (
            <div className="chart-wrapper large-chart">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dashboard.hallForecast.slice(0, 8)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="hallName" stroke="#a9d8e6" />
                  <YAxis stroke="#a9d8e6" domain={[0, 100]} />
                  <Tooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="predictedAttendanceRate"
                    stroke="#36e4ff"
                    fill="#36e4ff"
                    fillOpacity={0.18}
                    name="Predicted attendance %"
                  />
                  <Area
                    type="monotone"
                    dataKey="predictedOccupancyRate"
                    stroke="#7af6ff"
                    fill="#7af6ff"
                    fillOpacity={0.12}
                    name="Predicted occupancy %"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="empty-state compact-empty-state">
              <h4>No forecast data yet</h4>
              <p>Generate seat allocations and train the hall model to unlock predictions.</p>
            </div>
          )}
        </div>
      </section>

      <section className="glass-panel panel-section">
        <div className="panel-header-row">
          <div>
            <span className="section-eyebrow">Forecast table</span>
            <h3>Hall occupancy / attendance planning</h3>
          </div>
        </div>

        {dashboard.hallForecast.length > 0 ? (
          <div className="table-shell logs-table-shell">
            <table>
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Hall</th>
                  <th>Allocated</th>
                  <th>Predicted Present</th>
                  <th>Attendance %</th>
                  <th>Occupancy %</th>
                  <th>Source</th>
                  <th>Confidence</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.hallForecast.map((item: DashboardHallForecastItem) => (
                  <tr key={`${item.examId}-${item.hallId}`}>
                    <td>
                      <div className="table-primary-cell">
                        <strong>{item.subjectCode}</strong>
                        <span>
                          {item.examDate} • {item.startTime}
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="table-primary-cell">
                        <strong>{item.hallName}</strong>
                        <span>
                          {item.hallBuilding} • {item.hallFloor}
                        </span>
                      </div>
                    </td>
                    <td>{item.allocatedCount}</td>
                    <td>{item.predictedPresentCount}</td>
                    <td>{item.predictedAttendanceRate}%</td>
                    <td>{item.predictedOccupancyRate}%</td>
                    <td>
                      <span
                        className={`pill pill-${
                          item.predictionBasis === 'ml' ? 'valid' : 'manual'
                        }`}
                      >
                        {item.predictionBasis}
                      </span>
                    </td>
                    <td>
                      <span
                        className={`pill pill-${
                          item.confidenceLabel === 'high'
                            ? 'valid'
                            : item.confidenceLabel === 'medium'
                              ? 'duplicate'
                              : 'manual'
                        }`}
                      >
                        {item.confidenceLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state compact-empty-state">
            <h4>No upcoming forecast rows</h4>
            <p>Once future exams and seat allocations exist, the planning forecast will appear here.</p>
          </div>
        )}
      </section>

      <section className="dashboard-grid-two">
        <div className="glass-panel panel-section">
          <div className="panel-header-row">
            <div>
              <span className="section-eyebrow">Today&apos;s exams</span>
              <h3>Scheduled exam sessions</h3>
            </div>
          </div>

          {dashboard.todayExams.length > 0 ? (
            <div className="stack-md">
              {dashboard.todayExams.map((exam: DashboardExamOverview) => (
                <ExamCard key={exam._id} exam={exam} />
              ))}
            </div>
          ) : (
            <div className="empty-state compact-empty-state">
              <h4>No exams today</h4>
              <p>Add an exam schedule to start tracking attendance and hall occupancy.</p>
            </div>
          )}
        </div>

        <div className="glass-panel panel-section">
          <div className="panel-header-row">
            <div>
              <span className="section-eyebrow">Recent scan activity</span>
              <h3>Latest attendance logs</h3>
            </div>
          </div>

          {dashboard.recentLogs.length > 0 ? (
            <div className="table-shell logs-table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Result</th>
                    <th>Message</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {dashboard.recentLogs.map((log: DashboardRecentLog) => {
                    const student =
                      typeof log.studentId === 'object' && log.studentId !== null
                        ? log.studentId
                        : null;

                    return (
                      <tr key={log._id}>
                        <td>
                          <div className="table-primary-cell">
                            <strong>{student?.fullName || 'Unknown Student'}</strong>
                            <span>{student?.rollNumber || 'N/A'}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`pill pill-${log.result}`}>{log.result}</span>
                        </td>
                        <td>{log.message}</td>
                        <td>{new Date(log.createdAt).toLocaleString()}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state compact-empty-state">
              <h4>No scan logs yet</h4>
              <p>Attendance scan activity will appear here when QR or manual scans begin.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

type ExamCardProps = {
  exam: DashboardExamOverview;
};

function ExamCard({ exam }: ExamCardProps) {
  const hallNames = exam.hallIds
    .map((hall: DashboardHallRef) =>
      typeof hall === 'object' && hall !== null ? hall.name : 'Hall'
    )
    .join(', ');

  return (
    <article className="exam-overview-card glass-subpanel">
      <div className="exam-overview-top">
        <div>
          <p className="exam-subject-code">{exam.subjectCode}</p>
          <h4>{exam.title}</h4>
        </div>
        <span className="pill pill-scheduled">Scheduled</span>
      </div>

      <div className="exam-overview-meta">
        <span>{exam.examDate}</span>
        <span>
          {exam.startTime} - {exam.endTime}
        </span>
      </div>

      <div className="exam-overview-footer">
        <div>
          <small>Assigned halls</small>
          <strong>{hallNames || 'No halls assigned'}</strong>
        </div>
        <div>
          <small>Students</small>
          <strong>{exam.studentIds.length}</strong>
        </div>
      </div>
    </article>
  );
}