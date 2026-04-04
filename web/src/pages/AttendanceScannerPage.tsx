import { useEffect, useMemo, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import LoadingScreen from '../components/LoadingScreen';
import {
  api,
  formatDateTime,
  getErrorMessage,
  groupLogsBySeverity
} from '../lib/api';
import type {
  AttendanceRecord,
  Exam,
  OfflineSyncResult,
  ScanLog,
  SeatAllocation
} from '../types';
import {
  clearOfflineQueue,
  enqueueOfflineScan,
  getOfflineQueue,
  setOfflineQueue
} from '../utils/storage';

type ScanStatus = 'success' | 'duplicate' | 'invalid' | 'offline' | 'manual' | null;

type ScanResultState = {
  status: ScanStatus;
  title: string;
  message: string;
  studentName?: string;
  rollNumber?: string;
  hallName?: string;
  seatNumber?: string;
  scannedAt?: string;
};

const initialScanResult: ScanResultState = {
  status: null,
  title: '',
  message: ''
};

export default function AttendanceScannerPage() {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);

  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [scannerActive, setScannerActive] = useState(false);

  const [manualStudentId, setManualStudentId] = useState('');
  const [manualSearch, setManualSearch] = useState('');
  const [manualNotes, setManualNotes] = useState('');

  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [logs, setLogs] = useState<ScanLog[]>([]);
  const [allocations, setAllocations] = useState<SeatAllocation[]>([]);

  const [scanResult, setScanResult] = useState<ScanResultState>(initialScanResult);

  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [startingScanner, setStartingScanner] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectedExam = useMemo(
    () => exams.find((exam) => exam._id === selectedExamId) || null,
    [exams, selectedExamId]
  );

  const offlineQueue = selectedExamId ? getOfflineQueue(selectedExamId) : [];

  const seatMap = useMemo(() => {
    const map = new Map<
      string,
      {
        seatNumber: string;
        hallName: string;
      }
    >();

    allocations.forEach((allocation) => {
      map.set(allocation.studentId._id, {
        seatNumber: allocation.seatNumber,
        hallName: allocation.hallId.name
      });
    });

    return map;
  }, [allocations]);

  const filteredManualStudents = useMemo(() => {
    const students = selectedExam?.studentIds ?? [];
    const keyword = manualSearch.trim().toLowerCase();

    if (!keyword) {
      return students;
    }

    return students.filter((student) => {
      const name = student.fullName.toLowerCase();
      const roll = student.rollNumber.toLowerCase();
      return name.includes(keyword) || roll.includes(keyword);
    });
  }, [selectedExam, manualSearch]);

  async function loadExams() {
    const response = await api.getExams();
    setExams(response.data);

    if (!selectedExamId && response.data.length > 0) {
      setSelectedExamId(response.data[0]._id);
    }
  }

  async function loadAttendance(examId: string) {
    const response = await api.getAttendanceByExam(examId);
    setAttendance(response.data.attendance);
    setLogs(response.data.logs);
  }

  async function loadAllocations(examId: string) {
    const response = await api.getAllocationsByExam(examId);
    setAllocations(response.data);
  }

  async function loadSelectedExamData(examId: string) {
    setLoading(true);
    setError('');

    try {
      await Promise.all([loadAttendance(examId), loadAllocations(examId)]);
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

    void loadSelectedExamData(selectedExamId);

    const exam = exams.find((item) => item._id === selectedExamId);
    if (exam?.studentIds.length) {
      setManualStudentId(exam.studentIds[0]._id);
    } else {
      setManualStudentId('');
    }

    setManualSearch('');
    setScanResult(initialScanResult);
  }, [selectedExamId, exams]);

  useEffect(() => {
    if (!manualStudentId && filteredManualStudents.length > 0) {
      setManualStudentId(filteredManualStudents[0]._id);
    }

    if (
      manualStudentId &&
      filteredManualStudents.length > 0 &&
      !filteredManualStudents.some((student) => student._id === manualStudentId)
    ) {
      setManualStudentId(filteredManualStudents[0]._id);
    }
  }, [filteredManualStudents, manualStudentId]);

  function playTone(type: 'success' | 'warning' | 'error') {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (!AudioContextClass) return;

      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      if (type === 'success') {
        oscillator.frequency.value = 880;
      } else if (type === 'warning') {
        oscillator.frequency.value = 520;
      } else {
        oscillator.frequency.value = 240;
      }

      gainNode.gain.value = 0.08;
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.12);

      oscillator.onended = () => {
        void audioContext.close();
      };
    } catch {
      // ignore sound issues
    }
  }

  function updateScanResult(next: ScanResultState) {
    setScanResult(next);

    if (next.status === 'success' || next.status === 'manual') {
      playTone('success');
    } else if (next.status === 'duplicate' || next.status === 'offline') {
      playTone('warning');
    } else if (next.status === 'invalid') {
      playTone('error');
    }
  }

  async function startScanner() {
    if (!selectedExamId) {
      setError('Please select an exam first.');
      return;
    }

    setError('');
    setMessage('');
    setStartingScanner(true);

    try {
      await stopScanner();

      const scanner = new Html5Qrcode('scan-reader');
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 260, height: 260 }
        },
        async (decodedText) => {
          if (processingRef.current) return;

          processingRef.current = true;
          setError('');
          setMessage('');

          try {
            const response = await api.scanAttendance(selectedExamId, decodedText);
            const record = response.data;
            const seatInfo = seatMap.get(record.studentId._id);

            const duplicateDetected = Boolean(response.warning);

            updateScanResult({
              status: duplicateDetected ? 'duplicate' : 'success',
              title: duplicateDetected ? 'Duplicate Scan' : 'Valid Scan',
              message:
                response.message ||
                (duplicateDetected
                  ? 'Attendance was already marked earlier.'
                  : 'Attendance marked successfully.'),
              studentName: record.studentId.fullName,
              rollNumber: record.studentId.rollNumber,
              hallName: record.hallId.name || seatInfo?.hallName || '-',
              seatNumber: seatInfo?.seatNumber || '-',
              scannedAt: record.scannedAt
            });

            setMessage(
              response.message ||
                (duplicateDetected
                  ? 'Duplicate scan detected.'
                  : 'Attendance marked successfully.')
            );

            await loadAttendance(selectedExamId);
          } catch (err) {
            const messageText = getErrorMessage(err);

            if (!navigator.onLine || /failed to fetch/i.test(messageText.toLowerCase())) {
              enqueueOfflineScan(selectedExamId, decodedText);

              updateScanResult({
                status: 'offline',
                title: 'Saved Offline',
                message:
                  'Internet connection is unavailable. This scan was stored in offline queue.'
              });

              setMessage('Network issue detected. Scan saved in offline queue.');
            } else {
              updateScanResult({
                status: 'invalid',
                title: 'Invalid Scan',
                message: messageText
              });

              setError(messageText);
            }
          } finally {
            window.setTimeout(() => {
              processingRef.current = false;
            }, 1200);
          }
        },
        () => {
          // ignore per-frame scan errors
        }
      );

      setScannerActive(true);
    } catch (err) {
      setError(getErrorMessage(err));
      setScannerActive(false);
    } finally {
      setStartingScanner(false);
    }
  }

  async function stopScanner() {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch {
        // ignore stop errors
      }

      try {
        await scannerRef.current.clear();
      } catch {
        // ignore clear errors
      }

      scannerRef.current = null;
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

      const record = response.data;
      const seatInfo = seatMap.get(record.studentId._id);

      updateScanResult({
        status: 'manual',
        title: 'Manual Attendance Marked',
        message: response.message || 'Attendance marked manually.',
        studentName: record.studentId.fullName,
        rollNumber: record.studentId.rollNumber,
        hallName: record.hallId.name || seatInfo?.hallName || '-',
        seatNumber: seatInfo?.seatNumber || '-',
        scannedAt: record.scannedAt
      });

      setMessage(response.message || 'Manual attendance marked successfully.');
      setManualNotes('');
      await loadAttendance(selectedExamId);
    } catch (err) {
      const messageText = getErrorMessage(err);

      updateScanResult({
        status: 'invalid',
        title: 'Manual Attendance Failed',
        message: messageText
      });

      setError(messageText);
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
        setMessage(`Offline sync completed. ${failed.length} record(s) still failed.`);
      } else {
        clearOfflineQueue(selectedExamId);
        setMessage('All offline attendance records synced successfully.');
      }

      updateScanResult({
        status: failed.length > 0 ? 'offline' : 'success',
        title: failed.length > 0 ? 'Offline Sync Partial' : 'Offline Sync Complete',
        message:
          failed.length > 0
            ? `${failed.length} record(s) still remain in offline queue.`
            : 'All offline attendance records synced successfully.'
      });

      await loadAttendance(selectedExamId);
    } catch (err) {
      const messageText = getErrorMessage(err);

      updateScanResult({
        status: 'invalid',
        title: 'Offline Sync Failed',
        message: messageText
      });

      setError(messageText);
    } finally {
      setSyncing(false);
    }
  }

  const resultClassName =
    scanResult.status === 'success' || scanResult.status === 'manual'
      ? 'alert alert-success'
      : scanResult.status === 'duplicate' || scanResult.status === 'offline'
        ? 'alert alert-info'
        : scanResult.status === 'invalid'
          ? 'alert alert-error'
          : '';

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
              Scan student QR codes, detect duplicate or invalid scans, mark manual
              attendance, and sync offline records.
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
                disabled={!selectedExamId || startingScanner}
              >
                {startingScanner ? 'Starting...' : 'Start Scanner'}
              </button>
            ) : (
              <button
                className="btn btn-secondary"
                onClick={() => void stopScanner()}
              >
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

        {scanResult.status ? (
          <div className={resultClassName}>
            <div className="card-header-row compact-row">
              <strong>{scanResult.title}</strong>
              <span>
                {scanResult.scannedAt ? formatDateTime(scanResult.scannedAt) : ''}
              </span>
            </div>

            <p style={{ marginTop: 0 }}>{scanResult.message}</p>

            {(scanResult.studentName || scanResult.rollNumber || scanResult.hallName || scanResult.seatNumber) ? (
              <div className="details-grid">
                <div>
                  <strong>Student:</strong> {scanResult.studentName || '-'}
                </div>
                <div>
                  <strong>Roll Number:</strong> {scanResult.rollNumber || '-'}
                </div>
                <div>
                  <strong>Hall:</strong> {scanResult.hallName || '-'}
                </div>
                <div>
                  <strong>Seat:</strong> {scanResult.seatNumber || '-'}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-error">{error}</div> : null}

        <div className="scanner-grid">
          <div className="scanner-panel">
            <h4>Live Scanner</h4>
            <div id="scan-reader" className="scanner-box" />
            <div className="scanner-help">
              <p>Use the invigilator phone camera to scan each student QR code at the entrance.</p>
              <p>After each scan, the system shows student name, roll, hall, and seat.</p>
              <p>If internet fails, scanned values can be saved offline and synced later.</p>
            </div>
          </div>

          <div className="scanner-panel">
            <h4>Manual Attendance Fallback</h4>

            <form className="form-grid" onSubmit={handleManualSubmit}>
              <label className="form-field">
                <span>Search Student by Roll or Name</span>
                <input
                  value={manualSearch}
                  onChange={(event) => setManualSearch(event.target.value)}
                  placeholder="Search roll number or student name"
                />
              </label>

              <label className="form-field">
                <span>Select Student</span>
                <select
                  value={manualStudentId}
                  onChange={(event) => setManualStudentId(event.target.value)}
                  required
                >
                  {filteredManualStudents.length === 0 ? (
                    <option value="">No matching student found</option>
                  ) : (
                    filteredManualStudents.map((student) => (
                      <option key={student._id} value={student._id}>
                        {student.rollNumber} - {student.fullName}
                      </option>
                    ))
                  )}
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
                <th>Seat</th>
                <th>Method</th>
                <th>Status</th>
                <th>Scanned At</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map((record) => {
                const seatInfo = seatMap.get(record.studentId._id);

                return (
                  <tr key={record._id}>
                    <td>{record.studentId.fullName}</td>
                    <td>{record.studentId.rollNumber}</td>
                    <td>{record.hallId.name}</td>
                    <td>{seatInfo?.seatNumber || '-'}</td>
                    <td>{record.scanMethod}</td>
                    <td>
                      <span className="pill pill-active">{record.status}</span>
                    </td>
                    <td>{formatDateTime(record.scannedAt)}</td>
                    <td>{record.notes || '-'}</td>
                  </tr>
                );
              })}
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