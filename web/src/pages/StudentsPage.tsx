import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import LoadingScreen from '../components/LoadingScreen';
import { useAuth } from '../contexts/AuthContext';
import { api, getErrorMessage } from '../lib/api';
import type { Student } from '../types';

type StudentFormState = {
  fullName: string;
  rollNumber: string;
  email: string;
  program: string;
  semester: string;
  isActive: boolean;
};

type PrintMode = 'single' | 'all' | null;

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
  const [printMode, setPrintMode] = useState<PrintMode>(null);

  const [searchTerm, setSearchTerm] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canEdit = user?.role === 'admin';

  async function loadStudents() {
    setLoading(true);
    setError('');

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

  const filteredStudents = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    if (!keyword) return students;

    return students.filter((student) => {
      return (
        student.fullName.toLowerCase().includes(keyword) ||
        student.rollNumber.toLowerCase().includes(keyword) ||
        student.email.toLowerCase().includes(keyword) ||
        student.program.toLowerCase().includes(keyword)
      );
    });
  }, [students, searchTerm]);

  const activeCount = useMemo(
    () => students.filter((student) => student.isActive).length,
    [students]
  );

  const inactiveCount = students.length - activeCount;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit) return;

    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const payload = {
        fullName: form.fullName,
        rollNumber: form.rollNumber,
        email: form.email,
        program: form.program,
        semester: Number(form.semester),
        isActive: form.isActive
      };

      if (editingId) {
        await api.updateStudent(editingId, payload);
        setMessage('Student updated successfully.');
      } else {
        await api.createStudent(payload as Omit<Student, '_id' | 'qrCodeValue'>);
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

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
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

  function openSinglePrint(student: Student) {
    setPreviewStudent(student);
    setPrintMode('single');
  }

  function openAllPrint() {
    setPreviewStudent(null);
    setPrintMode('all');
  }

  function closePrintView() {
    setPrintMode(null);
    setPreviewStudent(null);
  }

  function handlePrint() {
    window.print();
  }

  if (loading) {
    return <LoadingScreen text="Loading students..." />;
  }

  return (
    <div className="page-stack">
      <div className="stats-grid stats-grid-3">
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
          <h3 className="stat-value">{inactiveCount}</h3>
        </div>
      </div>

      <div className="card">
        <div className="card-header-row">
          <div>
            <h3>Student Management</h3>
            <p>
              Create, update, search, preview QR, and print student admit slip style QR cards.
            </p>
          </div>

          <div className="inline-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={openAllPrint}
              disabled={students.length === 0}
            >
              Print All QR Cards
            </button>

            {!canEdit ? (
              <span className="pill pill-completed">Read only for invigilator</span>
            ) : null}
          </div>
        </div>

        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-error">{error}</div> : null}

        <form className="form-grid form-grid-2" onSubmit={handleSubmit}>
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
            <div className="form-actions form-actions-full">
              <button className="btn btn-primary" disabled={submitting} type="submit">
                {submitting ? 'Saving...' : editingId ? 'Update Student' : 'Add Student'}
              </button>

              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Reset
              </button>
            </div>
          ) : null}
        </form>
      </div>

      <div className="card">
        <div className="card-header-row">
          <div>
            <h3>Students List</h3>
            <p>
              Search by name, roll number, email, or program. Preview QR or print a student card.
            </p>
          </div>

          <div className="inline-filter">
            <label className="form-field">
              <span>Search Student</span>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search name / roll / email / program"
              />
            </label>
          </div>
        </div>

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
                <th>QR Preview</th>
                <th>Print</th>
                {canEdit ? <th>Actions</th> : null}
              </tr>
            </thead>

            <tbody>
              {filteredStudents.map((student) => (
                <tr key={student._id}>
                  <td>{student.fullName}</td>
                  <td>{student.rollNumber}</td>
                  <td>{student.email}</td>
                  <td>{student.program}</td>
                  <td>{student.semester}</td>
                  <td>
                    <span className={`pill ${student.isActive ? 'pill-active' : 'pill-warning'}`}>
                      {student.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => setPreviewStudent(student)}
                    >
                      Preview QR
                    </button>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => openSinglePrint(student)}
                    >
                      Print Card
                    </button>
                  </td>
                  {canEdit ? (
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => handleEdit(student)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
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

              {filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 9 : 8}>
                    <div className="empty-state">No student matched your search.</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
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

            <div className="inline-actions">
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => openSinglePrint(previewStudent)}
              >
                Print This Card
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPreviewStudent(null)}
              >
                Close
              </button>
            </div>
          </div>

          <div className="qr-box">
            <QRCodeSVG
              value={previewStudent.qrCodeValue}
              size={220}
              includeMargin
            />

            <div className="form-grid">
              <div><strong>Name:</strong> {previewStudent.fullName}</div>
              <div><strong>Roll Number:</strong> {previewStudent.rollNumber}</div>
              <div><strong>Email:</strong> {previewStudent.email}</div>
              <div><strong>Program:</strong> {previewStudent.program}</div>
              <div><strong>Semester:</strong> {previewStudent.semester}</div>

              <textarea
                className="mono-text"
                readOnly
                value={previewStudent.qrCodeValue}
              />
            </div>
          </div>
        </div>
      ) : null}

      {printMode === 'single' && previewStudent ? (
        <div className="card">
          <div className="card-header-row no-print">
            <div>
              <h3>Print Student QR Card</h3>
              <p>
                Use this as admit slip style QR card for attendance scanning at exam entry.
              </p>
            </div>

            <div className="inline-actions">
              <button type="button" className="btn btn-primary" onClick={handlePrint}>
                Print Now
              </button>

              <button type="button" className="btn btn-secondary" onClick={closePrintView}>
                Close
              </button>
            </div>
          </div>

          <div className="print-card-grid">
            <div className="student-print-card">
              <div className="student-print-header">
                <h2>Smart Exam Hall Attendance Card</h2>
                <p>Student QR Attendance Slip</p>
              </div>

              <div className="student-print-body">
                <div className="student-print-details">
                  <div><strong>Name:</strong> {previewStudent.fullName}</div>
                  <div><strong>Roll Number:</strong> {previewStudent.rollNumber}</div>
                  <div><strong>Email:</strong> {previewStudent.email}</div>
                  <div><strong>Program:</strong> {previewStudent.program}</div>
                  <div><strong>Semester:</strong> {previewStudent.semester}</div>
                  <div><strong>Status:</strong> {previewStudent.isActive ? 'Active' : 'Inactive'}</div>
                </div>

                <div className="student-print-qr">
                  <QRCodeSVG
                    value={previewStudent.qrCodeValue}
                    size={180}
                    includeMargin
                  />
                  <p className="small-muted">Scan this QR at exam hall entrance</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {printMode === 'all' ? (
        <div className="card">
          <div className="card-header-row no-print">
            <div>
              <h3>Print All Student QR Cards</h3>
              <p>
                Print all student admit slip style QR attendance cards in one batch.
              </p>
            </div>

            <div className="inline-actions">
              <button type="button" className="btn btn-primary" onClick={handlePrint}>
                Print All
              </button>

              <button type="button" className="btn btn-secondary" onClick={closePrintView}>
                Close
              </button>
            </div>
          </div>

          <div className="batch-print-grid">
            {students.map((student) => (
              <div key={student._id} className="student-print-card batch-card">
                <div className="student-print-header">
                  <h2>Smart Exam Hall Attendance Card</h2>
                  <p>Student QR Attendance Slip</p>
                </div>

                <div className="student-print-body batch-body">
                  <div className="student-print-details">
                    <div><strong>Name:</strong> {student.fullName}</div>
                    <div><strong>Roll Number:</strong> {student.rollNumber}</div>
                    <div><strong>Program:</strong> {student.program}</div>
                    <div><strong>Semester:</strong> {student.semester}</div>
                  </div>

                  <div className="student-print-qr">
                    <QRCodeSVG
                      value={student.qrCodeValue}
                      size={130}
                      includeMargin
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}