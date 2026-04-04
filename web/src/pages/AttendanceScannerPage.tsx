import { useEffect, useMemo, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import LoadingScreen from '../components/LoadingScreen';
import { api, formatDateTime, getErrorMessage, groupLogsBySeverity } from '../lib/api';
import type { AttendanceRecord, Exam, OfflineSyncResult, ScanLog } from '../types';
import {
  clearOfflineQueue,
  enqueueOfflineScan,
  getOfflineQueue,
  setOfflineQueue
} from '../utils/storage';

export default function AttendanceScannerPage() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);

  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const [manualStudentId, setManualStudentId] = useState('');
  const [manualNotes, setManualNotes] = useState('');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadExams() {
    const response = await api.getExams();
    setExams(response.data);

    if (!selectedExamId && response.data.length > 0) {
      setSelectedExamId(response.data[0]._id);
    }
  }

  async function loadAttendance(examId: string) {
    setLoading(true);
    try {
      const response = await api.getAttendanceByExam(examId);
      setAttendance(response.data.attendance);
      setLogs(response.data.logs);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
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

    return () => {
      void stopScanner();
    };
  }, []);

  useEffect(() => {
    if (!selectedExamId) return;

    void loadAttendance(selectedExamId);

    const selectedExam = exams.find((exam) => exam._id === selectedExamId);
    if (selectedExam?.studentIds.length) {
      setManualStudentId(selectedExam.studentIds[0]._id);
    }
  }, [selectedExamId, exams]);

  const selectedExam = useMemo(
    () => exams.find((exam) => exam._id === selectedExamId) || null,
    [exams, selectedExamId]
  );

  const offlineQueue = selectedExamId ? getOfflineQueue(selectedExamId) : [];

  async function startScanner() {
    if (!selectedExamId) {
      setError('Please select an exam first.');
      return;
    }

    setError('');
    setMessage('');

    if (scannerRef.current) {
      await stopScanner();
    }

    const scanner = new Html5Qrcode('scan-reader');
    scannerRef.current = scanner;

    await scanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 250, height: 250 } },
      async (decodedText) => {
        if (processingRef.current) return;

        processingRef.current = true;

        try {
          const response = await api.scanAttendance(selectedExamId, decodedText);
          setMessage(
            response.message ||
              (response.warning
                ? 'Duplicate scan detected.'
                : 'Attendance marked successfully.')
          );
          await loadAttendance(selectedExamId);
        } catch (err) {
          const messageText = getErrorMessage(err);

          if (!navigator.onLine || /failed to fetch/i.test(messageText.toLowerCase())) {
            enqueueOfflineScan(selectedExamId, decodedText);
            setMessage('Network problem detected. Scan saved locally for offline sync.');
          } else {
            setError(messageText);
          }
        } finally {
          setTimeout(() => {
            processingRef.current = false;
          }, 1200);
        }
      },
      () => {
        // ignore frame parse errors
      }
    );

    setScannerActive(true);
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        await scannerRef.current.clear();
      } catch {
        // ignore
      } finally {
        scannerRef.current = null;
      }
    }

    setScannerActive(false);
  }

  async function handleManualSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedExamId || !manualStudentId) return;

    setError('');
    setMessage('');

    try {
      const response = await api.markManualAttendance(
        selectedExamId,
        manualStudentId,
        manualNotes
      );
      setMessage(response.message || 'Manual attendance marked successfully.');
      setManualNotes('');
      await loadAttendance(selectedExamId);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  async function handleSyncOffline() {
    if (!selectedExamId || offlineQueue.length === 0) return;

    setSyncing(true);
    setError('');
    setMessage('');

    try {
      const response = await api.syncOfflineAttendance(selectedExamId, offlineQueue);

      const failed = response.data
        .filter((item: OfflineSyncResult) => !item.success)
        .map((item: OfflineSyncResult) => item.qrCodeValue);

      if (failed.length > 0) {
        setOfflineQueue(selectedExamId, failed);
        setMessage(`Offline sync completed with ${failed.length} remaining failed item(s).`);
      } else {
        clearOfflineQueue(selectedExamId);
        setMessage('All offline attendance records synced successfully.');
      }

      await loadAttendance(selectedExamId);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSyncing(false);
    }
  }

  if (loading && !selectedExamId) {
    return <LoadingScreen text="Loading attendance module..." />;
  }

  return (
    <div className="page-stack">
      <div className="card">
        <div className="card-header-row">
          <div>
            <h3>QR Attendance Scanner</h3>
            <p>
              Scan student QR codes, handle duplicate and invalid scans, and sync
              offline records.
            </p>
          </div>

          <div className="inline-actions">
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

            {!scannerActive ? (
              <button
                className="btn btn-primary"
                onClick={() => void startScanner()}
                disabled={!selectedExamId}
              >
                Start Scanner
              </button>
            ) : (
              <button className="btn btn-secondary" onClick={() => void stopScanner()}>
                Stop Scanner
              </button>
            )}

            <button
              className="btn btn-secondary"
              onClick={() => void handleSyncOffline()}
              disabled={!selectedExamId || offlineQueue.length === 0 || syncing}
            >
              {syncing ? 'Syncing...' : `Sync Offline (${offlineQueue.length})`}
            </button>
          </div>
        </div>

        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-error">{error}</div> : null}

        <div className="scanner-grid">
          <div className="scanner-panel">
            <h4>Live Scanner</h4>
            <div id="scan-reader" className="scanner-box" />
            <div className="scanner-help">
              <p>Use camera-based QR scanning for fast attendance.</p>
              <p>If internet fails, scanned values can be queued and synced later.</p>
            </div>
          </div>

          <div className="scanner-panel">
            <h4>Manual Attendance Fallback</h4>
            <form className="form-grid" onSubmit={handleManualSubmit}>
              <label className="form-field">
                <span>Student</span>
                <select
                  value={manualStudentId}
                  onChange={(event) => setManualStudentId(event.target.value)}
                  required
                >
                  {(selectedExam?.studentIds ?? []).map((student) => (
                    <option key={student._id} value={student._id}>
                      {student.rollNumber} - {student.fullName}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Notes</span>
                <textarea
                  value={manualNotes}
                  onChange={(event) => setManualNotes(event.target.value)}
                  placeholder="Scanner issue / poor QR print / manual verification"
                />
              </label>

              <button
                className="btn btn-primary"
                type="submit"
                disabled={!selectedExamId || !manualStudentId}
              >
                Mark Manual Attendance
              </button>
            </form>

            <div className="offline-box">
              <strong>Offline queue for this exam:</strong>
              <span>{offlineQueue.length} record(s)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <h3>Attendance Records</h3>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Roll</th>
                <th>Hall</th>
                <th>Method</th>
                <th>Status</th>
                <th>Scanned At</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((record) => (
                <tr key={record._id}>
                  <td>{record.studentId.fullName}</td>
                  <td>{record.studentId.rollNumber}</td>
                  <td>{record.hallId.name}</td>
                  <td>{record.scanMethod}</td>
                  <td>
                    <span className="pill pill-active">{record.status}</span>
                  </td>
                  <td>{formatDateTime(record.scannedAt)}</td>
                  <td>{record.notes || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h3>Recent Scan Logs</h3>
        {!logs.length ? (
          <div className="empty-state">No scan logs available.</div>
        ) : (
          <div className="log-list">
            {logs.map((log) => {
              const severity = groupLogsBySeverity(log);

              return (
                <div key={log._id} className={`log-card log-${severity}`}>
                  <div className="log-top">
                    <strong>{log.result.toUpperCase()}</strong>
                    <span>{formatDateTime(log.createdAt)}</span>
                  </div>
                  <p>{log.message}</p>
                  <small>
                    {log.studentId?.fullName
                      ? `${log.studentId.fullName} (${log.studentId.rollNumber})`
                      : 'Unknown / invalid QR'}
                  </small>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}