import { useEffect, useMemo, useState } from 'react';
import LoadingScreen from '../components/LoadingScreen';
import { useAuth } from '../contexts/AuthContext';
import { api, getErrorMessage } from '../lib/api';
import type { Hall, Student } from '../types';

type ExamStatus = 'scheduled' | 'active' | 'completed';

type ExamHallRef = {
  _id: string;
  name: string;
};

type ExamStudentRef = {
  _id: string;
  fullName: string;
};

type ExamRecord = {
  _id: string;
  title: string;
  subjectCode: string;
  examDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  status: ExamStatus;
  hallIds: ExamHallRef[];
  studentIds: ExamStudentRef[];
};

type ExamFormState = {
  title: string;
  subjectCode: string;
  examDate: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
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
  durationMinutes: 180,
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

  const [exams, setExams] = useState<ExamRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [halls, setHalls] = useState<Hall[]>([]);

  const [form, setForm] = useState<ExamFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [studentSearch, setStudentSearch] = useState('');
  const [hallSearch, setHallSearch] = useState('');

  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canEdit = user?.role === 'admin';

  async function loadAll(): Promise<void> {
    setLoading(true);
    setError('');

    try {
      const [examResponse, studentResponse, hallResponse] = await Promise.all([
        api.getExams(),
        api.getStudents(),
        api.getHalls()
      ]);

      setExams(examResponse.data as ExamRecord[]);
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

  function resetForm(): void {
    setForm(initialForm);
    setEditingId(null);
    setStudentSearch('');
    setHallSearch('');
  }

  const filteredStudents = useMemo(() => {
    const keyword = studentSearch.trim().toLowerCase();

    if (!keyword) {
      return students;
    }

    return students.filter((student) => {
      return (
        student.fullName.toLowerCase().includes(keyword) ||
        student.rollNumber.toLowerCase().includes(keyword) ||
        student.email.toLowerCase().includes(keyword) ||
        student.program.toLowerCase().includes(keyword)
      );
    });
  }, [students, studentSearch]);

  const filteredHalls = useMemo(() => {
    const keyword = hallSearch.trim().toLowerCase();

    if (!keyword) {
      return halls;
    }

    return halls.filter((hall) => {
      return (
        hall.name.toLowerCase().includes(keyword) ||
        hall.building.toLowerCase().includes(keyword) ||
        hall.floor.toLowerCase().includes(keyword) ||
        (hall.seatPrefix || '').toLowerCase().includes(keyword)
      );
    });
  }, [halls, hallSearch]);

  const totalSelectedHallCapacity = useMemo(() => {
    return halls
      .filter((hall) => form.hallIds.includes(hall._id))
      .reduce((sum, hall) => sum + hall.capacity, 0);
  }, [halls, form.hallIds]);

  const selectedStudentCount = form.studentIds.length;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!canEdit) return;

    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      if (form.durationMinutes < 1) {
        throw new Error('Duration must be at least 1 minute.');
      }

      if (form.hallIds.length === 0) {
        throw new Error('Please select at least one hall.');
      }

      if (form.studentIds.length === 0) {
        throw new Error('Please select at least one student.');
      }

      if (totalSelectedHallCapacity < selectedStudentCount) {
        throw new Error('Selected hall capacity is lower than selected student count.');
      }

      if (editingId) {
        await api.updateExam(editingId, {
          title: form.title,
          subjectCode: form.subjectCode,
          examDate: form.examDate,
          startTime: form.startTime,
          endTime: form.endTime,
          durationMinutes: form.durationMinutes,
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
          durationMinutes: form.durationMinutes,
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

  function handleEdit(exam: ExamRecord): void {
    setEditingId(exam._id);
    setForm({
      title: exam.title,
      subjectCode: exam.subjectCode,
      examDate: exam.examDate,
      startTime: exam.startTime,
      endTime: exam.endTime,
      durationMinutes: exam.durationMinutes,
      status: exam.status,
      hallIds: exam.hallIds.map((hall) => hall._id),
      studentIds: exam.studentIds.map((student) => student._id)
    });

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  async function handleDelete(id: string): Promise<void> {
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

  function handleSelectAllFilteredStudents(): void {
    const filteredIds = filteredStudents.map((student) => student._id);
    const merged = Array.from(new Set([...form.studentIds, ...filteredIds]));
    setForm((prev) => ({ ...prev, studentIds: merged }));
  }

  function handleClearStudents(): void {
    setForm((prev) => ({ ...prev, studentIds: [] }));
  }

  function handleSelectAllFilteredHalls(): void {
    const filteredIds = filteredHalls.map((hall) => hall._id);
    const merged = Array.from(new Set([...form.hallIds, ...filteredIds]));
    setForm((prev) => ({ ...prev, hallIds: merged }));
  }

  function handleClearHalls(): void {
    setForm((prev) => ({ ...prev, hallIds: [] }));
  }

  const scheduledCount = exams.filter((exam) => exam.status === 'scheduled').length;
  const activeCount = exams.filter((exam) => exam.status === 'active').length;
  const completedCount = exams.filter((exam) => exam.status === 'completed').length;

  if (loading) {
    return <LoadingScreen text="Loading exams..." />;
  }

  return (
    <div className="page-stack">
      <div className="stats-grid stats-grid-3">
        <div className="stat-card">
          <p className="stat-label">Total Exams</p>
          <h3 className="stat-value">{exams.length}</h3>
          <p className="stat-helper">All exam records</p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Scheduled / Active</p>
          <h3 className="stat-value">
            {scheduledCount} / {activeCount}
          </h3>
          <p className="stat-helper">Upcoming and running exams</p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Completed</p>
          <h3 className="stat-value">{completedCount}</h3>
          <p className="stat-helper">Finished exam sessions</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header-row">
          <div>
            <h3>Exam Management</h3>
            <p>
              Create exams, assign halls and students, and manage status for seat
              allocation and attendance scanning.
            </p>
          </div>

          {!canEdit ? (
            <span className="pill pill-completed">Read only for invigilator</span>
          ) : null}
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
                placeholder="Distributed Systems Final Exam"
                required
                disabled={!canEdit}
              />
            </label>

            <label className="form-field">
              <span>Subject Code</span>
              <input
                value={form.subjectCode}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    subjectCode: e.target.value.toUpperCase()
                  }))
                }
                placeholder="CSC401"
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
              <span>Status</span>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    status: e.target.value as ExamStatus
                  }))
                }
                disabled={!canEdit}
              >
                <option value="scheduled">Scheduled</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </select>
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
              <span>Duration (minutes)</span>
              <input
                type="number"
                min={1}
                value={form.durationMinutes}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    durationMinutes: Number(e.target.value)
                  }))
                }
                required
                disabled={!canEdit}
              />
            </label>
          </div>

          <div className="stats-grid stats-grid-3">
            <div className="stat-card">
              <p className="stat-label">Selected Halls</p>
              <h3 className="stat-value">{form.hallIds.length}</h3>
              <p className="stat-helper">Capacity: {totalSelectedHallCapacity}</p>
            </div>

            <div className="stat-card">
              <p className="stat-label">Selected Students</p>
              <h3 className="stat-value">{selectedStudentCount}</h3>
              <p className="stat-helper">Students chosen for this exam</p>
            </div>

            <div className="stat-card">
              <p className="stat-label">Capacity Check</p>
              <h3 className="stat-value">
                {totalSelectedHallCapacity >= selectedStudentCount ? 'OK' : 'Low'}
              </h3>
              <p className="stat-helper">
                {totalSelectedHallCapacity} seats vs {selectedStudentCount} students
              </p>
            </div>
          </div>

          <div className="selection-box">
            <div className="card-header-row compact-row">
              <strong>Select Halls</strong>

              <div className="small-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleSelectAllFilteredHalls}
                  disabled={!canEdit}
                >
                  Select Filtered
                </button>

                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleClearHalls}
                  disabled={!canEdit}
                >
                  Clear
                </button>
              </div>
            </div>

            <label className="form-field">
              <span>Search Halls</span>
              <input
                value={hallSearch}
                onChange={(e) => setHallSearch(e.target.value)}
                placeholder="Search hall / building / floor / prefix"
                disabled={!canEdit}
              />
            </label>

            <div className="checkbox-list">
              {filteredHalls.length > 0 ? (
                filteredHalls.map((hall) => (
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
                      {hall.name} - {hall.building}, {hall.floor} ({hall.capacity} seats)
                    </span>
                  </label>
                ))
              ) : (
                <div className="empty-state">No hall matched your search.</div>
              )}
            </div>
          </div>

          <div className="selection-box">
            <div className="card-header-row compact-row">
              <strong>Select Students</strong>

              <div className="small-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleSelectAllFilteredStudents}
                  disabled={!canEdit}
                >
                  Select Filtered
                </button>

                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={handleClearStudents}
                  disabled={!canEdit}
                >
                  Clear
                </button>
              </div>
            </div>

            <label className="form-field">
              <span>Search Students</span>
              <input
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                placeholder="Search name / roll / email / program"
                disabled={!canEdit}
              />
            </label>

            <div className="checkbox-list tall-list">
              {filteredStudents.length > 0 ? (
                filteredStudents.map((student) => (
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
                      {student.rollNumber} - {student.fullName} ({student.program})
                    </span>
                  </label>
                ))
              ) : (
                <div className="empty-state">No student matched your search.</div>
              )}
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
                <th>Duration</th>
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
                  <td>{exam.durationMinutes} min</td>
                  <td>
                    <span className={`pill pill-${exam.status}`}>{exam.status}</span>
                  </td>
                  <td>{exam.hallIds.map((hall) => hall.name).join(', ')}</td>
                  <td>{exam.studentIds.length}</td>

                  {canEdit ? (
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => handleEdit(exam)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
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

              {exams.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 9 : 8}>
                    <div className="empty-state">No exams created yet.</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}