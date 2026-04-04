import { useEffect, useMemo, useState } from 'react';
import LoadingScreen from '../components/LoadingScreen';
import { api, formatDateTime, getErrorMessage } from '../lib/api';
import type { Exam, ExamReport } from '../types';

function downloadTextFile(filename: string, content: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default function ReportsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [report, setReport] = useState<ExamReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    async function init() {
      try {
        const response = await api.getExams();
        setExams(response.data);

        if (response.data.length > 0) {
          setSelectedExamId(response.data[0]._id);
        }
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, []);

  useEffect(() => {
    async function loadReport() {
      if (!selectedExamId) {
        setReport(null);
        return;
      }

      try {
        const response = await api.getExamReport(selectedExamId);
        setReport(response.data);
      } catch (err) {
        setError(getErrorMessage(err));
      }
    }

    void loadReport();
  }, [selectedExamId]);

  const reportFileBase = useMemo(() => {
    if (!report) {
      return 'exam-report';
    }

    return `${report.exam.subjectCode.toLowerCase()}-${report.exam.examDate}`;
  }, [report]);

  async function handleDownloadJson() {
    if (!report) return;

    downloadTextFile(
      `${reportFileBase}-report.json`,
      JSON.stringify(report, null, 2),
      'application/json'
    );

    setMessage('JSON report downloaded successfully.');
  }

  async function handleDownloadCsv() {
    if (!selectedExamId) return;

    setDownloading(true);
    setError('');

    try {
      const csv = await api.downloadExamReportCsv(selectedExamId);
      downloadTextFile(`${reportFileBase}-attendance.csv`, csv, 'text/csv;charset=utf-8');
      setMessage('CSV report downloaded successfully.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return <LoadingScreen text="Loading reports..." />;
  }

  return (
    <div className="page-stack">
      <div className="card">
        <div className="card-header-row">
          <div>
            <h3>Reports & Exports</h3>
            <p>
              Generate attendance reports, hall occupancy summaries, absent lists,
              and seating chart exports.
            </p>
          </div>

          <div className="report-actions">
            <label className="form-field">
              <span>Select Exam</span>
              <select
                value={selectedExamId}
                onChange={(event) => setSelectedExamId(event.target.value)}
              >
                <option value="">Select exam</option>
                {exams.map((exam) => (
                  <option key={exam._id} value={exam._id}>
                    {exam.subjectCode} - {exam.title}
                  </option>
                ))}
              </select>
            </label>

            <button className="btn btn-primary" onClick={() => void handleDownloadJson()} disabled={!report}>
              Download JSON
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => void handleDownloadCsv()}
              disabled={!report || downloading}
            >
              {downloading ? 'Downloading...' : 'Download CSV'}
            </button>
          </div>
        </div>

        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-error">{error}</div> : null}
      </div>

      {report ? (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <p className="stat-label">Assigned Students</p>
              <h3 className="stat-value">{report.summary.assigned}</h3>
            </div>
            <div className="stat-card">
              <p className="stat-label">Present</p>
              <h3 className="stat-value">{report.summary.present}</h3>
            </div>
            <div className="stat-card">
              <p className="stat-label">Absent</p>
              <h3 className="stat-value">{report.summary.absent}</h3>
            </div>
            <div className="stat-card">
              <p className="stat-label">Progress</p>
              <h3 className="stat-value">{report.summary.progress}%</h3>
            </div>
          </div>

          <div className="stats-grid">
            <div className="stat-card">
              <p className="stat-label">Duplicate Scans</p>
              <h3 className="stat-value">{report.summary.duplicateScanCount}</h3>
            </div>
            <div className="stat-card">
              <p className="stat-label">Invalid Scans</p>
              <h3 className="stat-value">{report.summary.invalidScanCount}</h3>
            </div>
            <div className="stat-card">
              <p className="stat-label">Manual Attendance</p>
              <h3 className="stat-value">{report.summary.manualAttendanceCount}</h3>
            </div>
            <div className="stat-card">
              <p className="stat-label">Offline Sync Marks</p>
              <h3 className="stat-value">{report.summary.offlineSyncCount}</h3>
            </div>
          </div>

          <div className="card">
            <h3>Hall Occupancy Report</h3>
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
                  {report.hallOccupancy.map((hall) => (
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
            <h3>Absent Students</h3>
            {report.absentStudents.length ? (
              <div className="responsive-table">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Roll Number</th>
                      <th>Program</th>
                      <th>Semester</th>
                      <th>Hall</th>
                      <th>Seat</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report.absentStudents.map((student) => (
                      <tr key={student.studentId}>
                        <td>{student.fullName}</td>
                        <td>{student.rollNumber}</td>
                        <td>{student.program}</td>
                        <td>{student.semester}</td>
                        <td>{student.hallName}</td>
                        <td>{student.seatNumber}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="empty-state">No absent students for this exam.</div>
            )}
          </div>

          <div className="card">
            <h3>Warning Logs</h3>
            {report.warningLogs.length ? (
              <div className="log-list">
                {report.warningLogs.map((warning) => (
                  <article key={warning.id} className={`log-card log-${warning.result}`}>
                    <div className="log-top">
                      <strong>{warning.message}</strong>
                      <span>{formatDateTime(warning.createdAt)}</span>
                    </div>
                    <div>Student: {warning.studentName} ({warning.rollNumber})</div>
                    <div>Hall: {warning.hallName}</div>
                    <div>Scanned By: {warning.scannedBy}</div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-state">No duplicate or invalid scan warnings for this exam.</div>
            )}
          </div>

          <div className="card">
            <h3>Digital Seating Charts</h3>
            <div className="report-grid">
              {report.seatingCharts.map((hall) => (
                <div key={hall.hallId} className="seat-map-card">
                  <h4>{hall.hallName}</h4>
                  <div className="seat-grid">
                    {hall.seats.map((seat) => (
                      <div
                        key={seat.seatNumber}
                        className={`seat-chip ${seat.status === 'present' ? 'seat-chip-present' : 'seat-chip-absent'}`}
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
      ) : (
        <div className="card empty-state">Select an exam to generate reports.</div>
      )}
    </div>
  );
}