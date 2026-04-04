import { useEffect, useState } from 'react';
import LoadingScreen from '../components/LoadingScreen';
import { useAuth } from '../contexts/AuthContext';
import { api, getErrorMessage } from '../lib/api';
import type { Exam, Hall, Student } from '../types';

type ExamFormState = {
  title: string;
  subjectCode: string;
  examDate: string;
  startTime: string;
  endTime: string;
  status: 'scheduled' | 'active' | 'completed';
  hallIds: string[];
  studentIds: string[];
};

const initialForm: ExamFormState = {
  title: '',
  subjectCode: '',
  examDate: '',
  startTime: '',
  endTime: '',
  status: 'scheduled',
  hallIds: [],
  studentIds: []
};

function toggleSelection(items: string[], value: string): string[] {
  return items.includes(value)
    ? items.filter((item) => item !== value)
    : [...items, value];
}

export default function ExamsPage() {
  const { user } = useAuth();
  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [form, setForm] = useState<ExamFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canEdit = user?.role === 'admin';

  async function loadAll() {
    setLoading(true);
    setError('');

    try {
      const [examResponse, studentResponse, hallResponse] = await Promise.all([
        api.getExams(),
        api.getStudents(),
        api.getHalls()
      ]);

      setExams(examResponse.data);
      setStudents(studentResponse.data.filter((student) => student.isActive));
      setHalls(hallResponse.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;

    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      if (editingId) {
        await api.updateExam(editingId, form);
        setMessage('Exam updated successfully.');
      } else {
        await api.createExam(form);
        setMessage('Exam created successfully.');
      }

      resetForm();
      await loadAll();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(exam: Exam) {
    setEditingId(exam._id);
    setForm({
      title: exam.title,
      subjectCode: exam.subjectCode,
      examDate: exam.examDate,
      startTime: exam.startTime,
      endTime: exam.endTime,
      status: exam.status,
      hallIds: exam.hallIds.map((hall) => hall._id),
      studentIds: exam.studentIds.map((student) => student._id)
    });
  }

  async function handleDelete(id: string) {
    if (!canEdit) return;

    const confirmed = window.confirm('Delete this exam?');
    if (!confirmed) return;

    try {
      await api.deleteExam(id);
      setMessage('Exam deleted successfully.');
      await loadAll();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (loading) {
    return <LoadingScreen text="Loading exams..." />;
  }

  return (
    <div className="page-stack">
      <div className="stats-grid stats-grid-3">
        <div className="stat-card">
          <p className="stat-label">Total Exams</p>
          <h3 className="stat-value">{exams.length}</h3>
        </div>
        <div className="stat-card">
          <p className="stat-label">Available Halls</p>
          <h3 className="stat-value">{halls.length}</h3>
        </div>
        <div className="stat-card">
          <p className="stat-label">Available Students</p>
          <h3 className="stat-value">{students.length}</h3>
        </div>
      </div>

      <div className="card">
        <div className="card-header-row">
          <div>
            <h3>Exam Management</h3>
            <p>Create exams, assign halls and students, and manage exam status.</p>
          </div>
          {!canEdit ? <span className="pill pill-completed">Read only for invigilator</span> : null}
        </div>

        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-error">{error}</div> : null}

        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="form-grid form-grid-2">
            <label className="form-field">
              <span>Exam Title</span>
              <input
                value={form.title}
                onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                required
                disabled={!canEdit}
              />
            </label>

            <label className="form-field">
              <span>Subject Code</span>
              <input
                value={form.subjectCode}
                onChange={(e) => setForm((prev) => ({ ...prev, subjectCode: e.target.value }))}
                required
                disabled={!canEdit}
              />
            </label>

            <label className="form-field">
              <span>Exam Date</span>
              <input
                type="date"
                value={form.examDate}
                onChange={(e) => setForm((prev) => ({ ...prev, examDate: e.target.value }))}
                required
                disabled={!canEdit}
              />
            </label>

            <label className="form-field">
              <span>Start Time</span>
              <input
                type="time"
                value={form.startTime}
                onChange={(e) => setForm((prev) => ({ ...prev, startTime: e.target.value }))}
                required
                disabled={!canEdit}
              />
            </label>

            <label className="form-field">
              <span>End Time</span>
              <input
                type="time"
                value={form.endTime}
                onChange={(e) => setForm((prev) => ({ ...prev, endTime: e.target.value }))}
                required
                disabled={!canEdit}
              />
            </label>

            <label className="form-field">
              <span>Status</span>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    status: e.target.value as ExamFormState['status']
                  }))
                }
                disabled={!canEdit}
              >
                <option value="scheduled">Scheduled</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
            </label>
          </div>

          <div className="selection-box">
            <div className="card-header-row compact-row">
              <strong>Select Halls</strong>
              <div className="small-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setForm((prev) => ({ ...prev, hallIds: halls.map((h) => h._id) }))}
                  disabled={!canEdit}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setForm((prev) => ({ ...prev, hallIds: [] }))}
                  disabled={!canEdit}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="checkbox-list">
              {halls.map((hall) => (
                <label key={hall._id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={form.hallIds.includes(hall._id)}
                    onChange={() =>
                      setForm((prev) => ({
                        ...prev,
                        hallIds: toggleSelection(prev.hallIds, hall._id)
                      }))
                    }
                    disabled={!canEdit}
                  />
                  <span>
                    {hall.name} ({hall.capacity} seats)
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="selection-box">
            <div className="card-header-row compact-row">
              <strong>Select Students</strong>
              <div className="small-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() =>
                    setForm((prev) => ({
                      ...prev,
                      studentIds: students.map((student) => student._id)
                    }))
                  }
                  disabled={!canEdit}
                >
                  Select All
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setForm((prev) => ({ ...prev, studentIds: [] }))}
                  disabled={!canEdit}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="checkbox-list tall-list">
              {students.map((student) => (
                <label key={student._id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={form.studentIds.includes(student._id)}
                    onChange={() =>
                      setForm((prev) => ({
                        ...prev,
                        studentIds: toggleSelection(prev.studentIds, student._id)
                      }))
                    }
                    disabled={!canEdit}
                  />
                  <span>
                    {student.rollNumber} - {student.fullName}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {canEdit ? (
            <div className="form-actions">
              <button className="btn btn-primary" type="submit" disabled={submitting}>
                {submitting ? 'Saving...' : editingId ? 'Update Exam' : 'Create Exam'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Reset
              </button>
            </div>
          ) : null}
        </form>
      </div>

      <div className="card">
        <h3>Exam List</h3>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Title</th>
                <th>Date</th>
                <th>Time</th>
                <th>Status</th>
                <th>Halls</th>
                <th>Students</th>
                {canEdit ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {exams.map((exam) => (
                <tr key={exam._id}>
                  <td>{exam.subjectCode}</td>
                  <td>{exam.title}</td>
                  <td>{exam.examDate}</td>
                  <td>
                    {exam.startTime} - {exam.endTime}
                  </td>
                  <td>
                    <span className={`pill pill-${exam.status}`}>{exam.status}</span>
                  </td>
                  <td>{exam.hallIds.map((hall) => hall.name).join(', ')}</td>
                  <td>{exam.studentIds.length}</td>
                  {canEdit ? (
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-ghost" onClick={() => handleEdit(exam)}>
                          Edit
                        </button>
                        <button className="btn btn-danger" onClick={() => void handleDelete(exam._id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}