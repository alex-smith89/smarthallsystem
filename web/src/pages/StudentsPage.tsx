import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { api, getErrorMessage } from '../lib/api';
import { useAuth } from '../contexts/AuthContext';
import type { Student } from '../types';
import LoadingScreen from '../components/LoadingScreen';

type StudentFormState = {
  fullName: string;
  rollNumber: string;
  email: string;
  program: string;
  semester: string;
  isActive: boolean;
};

const initialForm: StudentFormState = {
  fullName: '',
  rollNumber: '',
  email: '',
  program: '',
  semester: '1',
  isActive: true
};

export default function StudentsPage() {
  const { user } = useAuth();
  const [students, setStudents] = useState<Student[]>([]);
  const [form, setForm] = useState<StudentFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewStudent, setPreviewStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const canEdit = user?.role === 'admin';

  async function loadStudents() {
    setLoading(true);
    try {
      const response = await api.getStudents();
      setStudents(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadStudents();
  }, []);

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
  }

  const activeCount = useMemo(
    () => students.filter((student) => student.isActive).length,
    [students]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;

    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      if (editingId) {
        await api.updateStudent(editingId, {
          fullName: form.fullName,
          rollNumber: form.rollNumber,
          email: form.email,
          program: form.program,
          semester: Number(form.semester),
          isActive: form.isActive
        });
        setMessage('Student updated successfully.');
      } else {
        await api.createStudent({
          fullName: form.fullName,
          rollNumber: form.rollNumber,
          email: form.email,
          program: form.program,
          semester: Number(form.semester),
          isActive: form.isActive
        } as Omit<Student, '_id' | 'qrCodeValue'>);
        setMessage('Student created successfully.');
      }

      resetForm();
      await loadStudents();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(student: Student) {
    setEditingId(student._id);
    setForm({
      fullName: student.fullName,
      rollNumber: student.rollNumber,
      email: student.email,
      program: student.program,
      semester: String(student.semester),
      isActive: student.isActive
    });
  }

  async function handleDelete(studentId: string) {
    if (!canEdit) return;
    const confirmed = window.confirm('Delete this student?');
    if (!confirmed) return;

    try {
      await api.deleteStudent(studentId);
      setMessage('Student deleted successfully.');
      await loadStudents();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  if (loading) {
    return <LoadingScreen text="Loading students..." />;
  }

  return (
    <div className="page-stack">
      <div className="stats-grid">
        <div className="stat-card">
          <p className="stat-label">Total Students</p>
          <h3 className="stat-value">{students.length}</h3>
        </div>
        <div className="stat-card">
          <p className="stat-label">Active Students</p>
          <h3 className="stat-value">{activeCount}</h3>
        </div>
        <div className="stat-card">
          <p className="stat-label">Inactive Students</p>
          <h3 className="stat-value">{students.length - activeCount}</h3>
        </div>
      </div>

      <div className="card">
        <div className="card-header-row">
          <div>
            <h3>Student Management</h3>
            <p>Create, update, and maintain student records with unique QR values.</p>
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
            <span>Full Name</span>
            <input
              value={form.fullName}
              onChange={(e) => setForm((prev) => ({ ...prev, fullName: e.target.value }))}
              required
              disabled={!canEdit}
            />
          </label>

          <label className="form-field">
            <span>Roll Number</span>
            <input
              value={form.rollNumber}
              onChange={(e) => setForm((prev) => ({ ...prev, rollNumber: e.target.value }))}
              required
              disabled={!canEdit}
            />
          </label>

          <label className="form-field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
              required
              disabled={!canEdit}
            />
          </label>

          <label className="form-field">
            <span>Program</span>
            <input
              value={form.program}
              onChange={(e) => setForm((prev) => ({ ...prev, program: e.target.value }))}
              required
              disabled={!canEdit}
            />
          </label>

          <label className="form-field">
            <span>Semester</span>
            <input
              type="number"
              min="1"
              value={form.semester}
              onChange={(e) => setForm((prev) => ({ ...prev, semester: e.target.value }))}
              required
              disabled={!canEdit}
            />
          </label>

          <label className="form-field checkbox-field">
            <span>Active</span>
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
              disabled={!canEdit}
            />
          </label>

          {canEdit ? (
            <div className="form-actions">
              <button
                className="btn btn-primary"
                disabled={submitting}
                type="submit"
              >
                {submitting ? 'Saving...' : editingId ? 'Update Student' : 'Add Student'}
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

      {previewStudent ? (
        <div className="card qr-preview-card">
          <div className="card-header-row">
            <div>
              <h3>QR Preview</h3>
              <p>
                {previewStudent.fullName} ({previewStudent.rollNumber})
              </p>
            </div>
            <button
              className="btn btn-secondary"
              onClick={() => setPreviewStudent(null)}
            >
              Close
            </button>
          </div>

          <div className="qr-box">
            <QRCodeSVG
              value={previewStudent.qrCodeValue}
              size={220}
              includeMargin
            />
            <textarea
              className="mono-text"
              readOnly
              value={previewStudent.qrCodeValue}
            />
          </div>
        </div>
      ) : null}

      <div className="card">
        <h3>Students List</h3>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Roll</th>
                <th>Email</th>
                <th>Program</th>
                <th>Semester</th>
                <th>Status</th>
                <th>QR</th>
                {canEdit ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student._id}>
                  <td>{student.fullName}</td>
                  <td>{student.rollNumber}</td>
                  <td>{student.email}</td>
                  <td>{student.program}</td>
                  <td>{student.semester}</td>
                  <td>
                    <span className={student.isActive ? 'pill pill-active' : 'pill pill-completed'}>
                      {student.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setPreviewStudent(student)}
                    >
                      View QR
                    </button>
                  </td>
                  {canEdit ? (
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn btn-ghost"
                          onClick={() => handleEdit(student)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-danger"
                          onClick={() => void handleDelete(student._id)}
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