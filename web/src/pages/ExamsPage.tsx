import { useEffect, useMemo, useState } from 'react';
import { api, getErrorMessage } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { Exam, ExamStatus, Hall, Student } from '../types';
import LoadingScreen from '../components/LoadingScreen';

type ExamFormState = {
  title: string;
  subjectCode: string;
  examDate: string;
  startTime: string;
  endTime: string;
  status: ExamStatus;
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

export default function ExamsPage() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin';

  const [exams, setExams] = useState<Exam[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);
  const [form, setForm] = useState<ExamFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadAll() {
    setLoading(true);
    try {
      const [examResponse, studentResponse, hallResponse] = await Promise.all([
        api.getExams(),
        api.getStudents(),
        api.getHalls()
      ]);

      setExams(examResponse.data);
      setStudents(studentResponse.data);
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

  function toggleSelection(list: string[], value: string) {
    return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;

    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      if (editingId) {
        await api.updateExam(editingId, {
          title: form.title,
          subjectCode: form.subjectCode,
          examDate: form.examDate,
          startTime: form.startTime,
          endTime: form.endTime,
          status: form.status,
          hallIds: form.hallIds,
          studentIds: form.studentIds
        });
        setMessage('Exam updated successfully.');
      } else {
        await api.createExam({
          title: form.title,
          subjectCode: form.subjectCode,
          examDate: form.examDate,
          startTime: form.startTime,
          endTime: form.endTime,
          hallIds: form.hallIds,
          studentIds: form.studentIds
        });
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
    if (!window.confirm('Delete this exam?')) return;

    try {
      await api.deleteExam(id);
      setMessage('Exam deleted successfully.');
      await loadAll();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const selectedStudentCount = useMemo(() => form.studentIds.length, [form.studentIds]);
  const selectedHallCount = useMemo(() => form.hallIds.length, [form.hallIds]);

  if (loading) {
    return <LoadingScreen text="Loading exams..." />;
  }

  return (
    <div className="page-stack">
      <div className="card">
        <div className="card-header-row">
          <div>
            <h3>Exam Management</h3>
            <p>Create exam schedules and assign students and halls before seat allocation.</p>
          </div>
          {!canEdit ? <span className="pill pill-completed">Read only for invigilator</span> : null}
        </div>

        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-error">{error}</div> : null}

        <form
          className="form-grid"
          onSubmit={handleSubmit}
        >
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
              onChange={(e) => setForm((prev) => ({ ...prev, subjectCode: e.target.value.toUpperCase() }))}
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
              onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value as ExamStatus }))}
              disabled={!canEdit}
            >
              <option value="scheduled">scheduled</option>
              <option value="active">active</option>
              <option value="completed">completed</option>
            </select>
          </label>

          <div className="selection-box">
            <div className="card-header-row compact-row">
              <strong>Select Halls</strong>
              <span>{selectedHallCount} selected</span>
            </div>
            <div className="checkbox-list">
              {halls.map((hall) => (
                <label
                  key={hall._id}
                  className="checkbox-item"
                >
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
                  onClick={() => setForm((prev) => ({ ...prev, studentIds: students.map((s) => s._id) }))}
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
                <label
                  key={student._id}
                  className="checkbox-item"
                >
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
              <button
                className="btn btn-primary"
                type="submit"
                disabled={submitting}
              >
                {submitting ? 'Saving...' : editingId ? 'Update Exam' : 'Create Exam'}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetForm}
              >
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
                  <td>{exam.startTime} - {exam.endTime}</td>
                  <td>
                    <span className={`pill pill-${exam.status}`}>{exam.status}</span>
                  </td>
                  <td>{exam.hallIds.map((hall) => hall.name).join(', ')}</td>
                  <td>{exam.studentIds.length}</td>
                  {canEdit ? (
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn btn-ghost"
                          onClick={() => handleEdit(exam)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => void handleDelete(exam._id)}
                        >
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