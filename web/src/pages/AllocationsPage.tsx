import { useEffect, useMemo, useState } from 'react';
import LoadingScreen from '../components/LoadingScreen';
import { api, getErrorMessage } from '../lib/api';
import type { Exam, SeatAllocation } from '../types';

export default function AllocationsPage() {
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExamId, setSelectedExamId] = useState('');
  const [allocations, setAllocations] = useState<SeatAllocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadExams() {
    const response = await api.getExams();
    setExams(response.data);

    if (!selectedExamId && response.data.length > 0) {
      setSelectedExamId(response.data[0]._id);
    }
  }

  async function loadAllocations(examId: string) {
    setLoading(true);
    setError('');

    try {
      const response = await api.getAllocationsByExam(examId);
      setAllocations(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
      setAllocations([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadExams().catch((err) => {
      setError(getErrorMessage(err));
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedExamId) return;
    void loadAllocations(selectedExamId);
  }, [selectedExamId]);

  async function handleGenerate() {
    if (!selectedExamId) return;

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

  const groupedByHall = useMemo(() => {
    return allocations.reduce<Record<string, SeatAllocation[]>>((acc, allocation) => {
      const hallName = allocation.hallId.name;
      if (!acc[hallName]) acc[hallName] = [];
      acc[hallName].push(allocation);
      return acc;
    }, {});
  }, [allocations]);

  if (loading && !selectedExamId) {
    return <LoadingScreen text="Loading allocations..." />;
  }

  return (
    <div className="page-stack">
      <div className="card">
        <div className="card-header-row">
          <div>
            <h3>Seat Allocation</h3>
            <p>
              Generate automatic seating by hall capacity, rows, columns, and roll number order.
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

            <button
              className="btn btn-primary"
              disabled={!selectedExamId || generating}
              onClick={() => void handleGenerate()}
            >
              {generating ? 'Generating...' : 'Generate Allocations'}
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => window.print()}
              disabled={!allocations.length}
            >
              Print Seating Chart
            </button>
          </div>
        </div>

        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-error">{error}</div> : null}
      </div>

      {!allocations.length ? (
        <div className="card">
          <div className="empty-state">
            Select an exam and generate allocations to see seating charts.
          </div>
        </div>
      ) : (
        Object.entries(groupedByHall).map(([hallName, hallAllocations]) => (
          <div key={hallName} className="card">
            <h3>{hallName} Seating Chart</h3>

            <div className="responsive-table">
              <table>
                <thead>
                  <tr>
                    <th>Seat</th>
                    <th>Row</th>
                    <th>Column</th>
                    <th>Student</th>
                    <th>Roll</th>
                    <th>Program</th>
                  </tr>
                </thead>
                <tbody>
                  {hallAllocations.map((allocation) => (
                    <tr key={allocation._id}>
                      <td>{allocation.seatNumber}</td>
                      <td>{allocation.row}</td>
                      <td>{allocation.column}</td>
                      <td>{allocation.studentId.fullName}</td>
                      <td>{allocation.studentId.rollNumber}</td>
                      <td>{allocation.studentId.program}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  );
}