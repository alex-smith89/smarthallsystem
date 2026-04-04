import { useEffect, useMemo, useState } from 'react';
import LoadingScreen from '../components/LoadingScreen';
import { useAuth } from '../contexts/AuthContext';
import { api, getErrorMessage } from '../lib/api';
import type { Exam, SeatAllocation } from '../types';

type HallAllocationGroup = {
  hallId: string;
  hallName: string;
  building?: string;
  floor?: string;
  capacity: number;
  assigned: number;
  seats: SeatAllocation[];
};

export default function AllocationsPage() {
  const { user } = useAuth();

  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [allocations, setAllocations] = useState<SeatAllocation[]>([]);

  const [loading, setLoading] = useState(true);
  const [loadingAllocations, setLoadingAllocations] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canGenerate = user?.role === 'admin';

  async function loadExams() {
    const response = await api.getExams();
    setExams(response.data);

    if (!selectedExamId && response.data.length > 0) {
      setSelectedExamId(response.data[0]._id);
    }
  }

  async function loadAllocations(examId: string) {
    setLoadingAllocations(true);
    setError('');

    try {
      const response = await api.getAllocationsByExam(examId);
      setAllocations(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
      setAllocations([]);
    } finally {
      setLoadingAllocations(false);
    }
  }

  useEffect(() => {
    async function init() {
      try {
        await loadExams();
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    }

    void init();
  }, []);

  useEffect(() => {
    if (!selectedExamId) {
      setAllocations([]);
      return;
    }

    void loadAllocations(selectedExamId);
  }, [selectedExamId]);

  const selectedExam = useMemo(
    () => exams.find((exam) => exam._id === selectedExamId) || null,
    [exams, selectedExamId]
  );

  const groupedAllocations = useMemo<HallAllocationGroup[]>(() => {
    const map = new Map<string, HallAllocationGroup>();

    allocations.forEach((allocation) => {
      const key = allocation.hallId._id;

      if (!map.has(key)) {
        map.set(key, {
          hallId: allocation.hallId._id,
          hallName: allocation.hallId.name,
          building: allocation.hallId.building,
          floor: allocation.hallId.floor,
          capacity: allocation.hallId.capacity,
          assigned: 0,
          seats: []
        });
      }

      const group = map.get(key)!;
      group.assigned += 1;
      group.seats.push(allocation);
    });

    return Array.from(map.values()).map((group) => ({
      ...group,
      seats: [...group.seats].sort((a, b) => a.row - b.row || a.column - b.column)
    }));
  }, [allocations]);

  const totalCapacity = useMemo(() => {
    return selectedExam?.hallIds.reduce((sum, hall) => sum + hall.capacity, 0) ?? 0;
  }, [selectedExam]);

  const totalAssigned = allocations.length;
  const totalStudentsInExam = selectedExam?.studentIds.length ?? 0;
  const remainingCapacity = Math.max(totalCapacity - totalAssigned, 0);

  async function handleGenerate() {
    if (!selectedExamId || !canGenerate) return;

    setGenerating(true);
    setError('');
    setMessage('');

    try {
      const response = await api.generateAllocations(selectedExamId);
      setAllocations(response.data);
      setMessage('Seat allocations generated successfully.');
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setGenerating(false);
    }
  }

  async function handleRefresh() {
    if (!selectedExamId) return;

    setMessage('');
    setError('');
    await loadAllocations(selectedExamId);
  }

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return <LoadingScreen text="Loading allocations..." />;
  }

  return (
    <div className="page-stack">
      <div className="card">
        <div className="card-header-row">
          <div>
            <h3>Seat Allocation</h3>
            <p>
              Generate automatic seating using hall capacity, hall layout, and student
              roll number order, then print hall-wise seating charts.
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

            {canGenerate ? (
              <button
                type="button"
                className="btn btn-primary"
                disabled={!selectedExamId || generating}
                onClick={() => void handleGenerate()}
              >
                {generating ? 'Generating...' : 'Generate Allocations'}
              </button>
            ) : null}

            <button
              type="button"
              className="btn btn-secondary"
              disabled={!selectedExamId || loadingAllocations}
              onClick={() => void handleRefresh()}
            >
              Refresh
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              disabled={allocations.length === 0}
              onClick={handlePrint}
            >
              Print Seating Chart
            </button>
          </div>
        </div>

        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-error">{error}</div> : null}
        {loadingAllocations ? (
          <div className="alert alert-info">Loading seat allocations...</div>
        ) : null}
      </div>

      {selectedExam ? (
        <div className="card">
          <div className="card-header-row">
            <div>
              <h3>Selected Exam Overview</h3>
              <p>Exam setup summary before or after seat generation.</p>
            </div>

            <span className={`pill pill-${selectedExam.status}`}>{selectedExam.status}</span>
          </div>

          <div className="details-grid">
            <div><strong>Subject Code:</strong> {selectedExam.subjectCode}</div>
            <div><strong>Exam Title:</strong> {selectedExam.title}</div>
            <div><strong>Exam Date:</strong> {selectedExam.examDate}</div>
            <div><strong>Start Time:</strong> {selectedExam.startTime}</div>
            <div><strong>End Time:</strong> {selectedExam.endTime}</div>
            <div><strong>Status:</strong> {selectedExam.status}</div>
          </div>
        </div>
      ) : null}

      {selectedExam ? (
        <div className="stats-grid stats-grid-3">
          <div className="stat-card">
            <p className="stat-label">Exam Students</p>
            <h3 className="stat-value">{totalStudentsInExam}</h3>
            <p className="stat-helper">Students selected for this exam</p>
          </div>

          <div className="stat-card">
            <p className="stat-label">Total Hall Capacity</p>
            <h3 className="stat-value">{totalCapacity}</h3>
            <p className="stat-helper">Combined selected hall capacity</p>
          </div>

          <div className="stat-card">
            <p className="stat-label">Allocated Seats</p>
            <h3 className="stat-value">{totalAssigned}</h3>
            <p className="stat-helper">Remaining capacity: {remainingCapacity}</p>
          </div>
        </div>
      ) : null}

      {!selectedExam ? (
        <div className="card">
          <div className="empty-state">Select an exam to manage seat allocations.</div>
        </div>
      ) : null}

      {selectedExam && groupedAllocations.length === 0 && !loadingAllocations ? (
        <div className="card">
          <div className="empty-state">
            No seat allocations found yet. Generate seat allocations for the selected exam.
          </div>
        </div>
      ) : null}

      {groupedAllocations.length > 0 ? (
        <>
          <div className="card">
            <h3>Hall Allocation Summary</h3>
            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Hall</th>
                    <th>Building</th>
                    <th>Floor</th>
                    <th>Capacity</th>
                    <th>Assigned</th>
                    <th>Vacant</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedAllocations.map((group) => (
                    <tr key={group.hallId}>
                      <td>{group.hallName}</td>
                      <td>{group.building || '-'}</td>
                      <td>{group.floor || '-'}</td>
                      <td>{group.capacity}</td>
                      <td>{group.assigned}</td>
                      <td>{Math.max(group.capacity - group.assigned, 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3>Hall-Wise Seating Preview</h3>
            <div className="report-grid">
              {groupedAllocations.map((group) => (
                <div key={group.hallId} className="seat-map-card">
                  <h4>{group.hallName}</h4>
                  <p>
                    {group.building || '-'} {group.floor ? `• ${group.floor}` : ''}
                  </p>

                  <div className="seat-grid">
                    {group.seats.map((seat) => (
                      <div
                        key={seat._id}
                        className="seat-chip seat-chip-present"
                      >
                        <strong>{seat.seatNumber}</strong>
                        <span>{seat.studentId.rollNumber}</span>
                        <small>{seat.studentId.fullName}</small>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {groupedAllocations.map((group) => (
            <div key={group.hallId} className="card">
              <div className="card-header-row">
                <div>
                  <h3>{group.hallName} Seating Chart</h3>
                  <p>
                    {group.building || '-'} {group.floor ? `• ${group.floor}` : ''} •
                    Capacity: {group.capacity} • Assigned: {group.assigned}
                  </p>
                </div>
              </div>

              <div className="responsive-table">
                <table>
                  <thead>
                    <tr>
                      <th>Seat Number</th>
                      <th>Row</th>
                      <th>Column</th>
                      <th>Student Name</th>
                      <th>Roll Number</th>
                      <th>Program</th>
                      <th>Semester</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.seats.map((seat) => (
                      <tr key={seat._id}>
                        <td>{seat.seatNumber}</td>
                        <td>{seat.row}</td>
                        <td>{seat.column}</td>
                        <td>{seat.studentId.fullName}</td>
                        <td>{seat.studentId.rollNumber}</td>
                        <td>{seat.studentId.program}</td>
                        <td>{seat.studentId.semester}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </>
      ) : null}
    </div>
  );
}