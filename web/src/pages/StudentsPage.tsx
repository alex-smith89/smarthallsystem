import { useEffect, useMemo, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { renderToStaticMarkup } from 'react-dom/server';
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

function sanitizeFilename(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'student-qr'
  );
}

function triggerBlobDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

function buildQrSvgMarkup(qrCodeValue: string, size = 240): string {
  return renderToStaticMarkup(
    <QRCodeSVG value={qrCodeValue} size={size} includeMargin level="M" />
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function buildStudentCardMarkup(student: Student, qrSize = 190): string {
  const qrSvg = buildQrSvgMarkup(student.qrCodeValue, qrSize);

  return `
    <div class="student-print-card">
      <div class="student-print-header">
        <h2>Smart Exam Hall Attendance Card</h2>
        <p>Student QR Attendance Slip</p>
      </div>

      <div class="student-print-body">
        <div class="student-print-details">
          <div><strong>Name:</strong> ${escapeHtml(student.fullName)}</div>
          <div><strong>Roll Number:</strong> ${escapeHtml(student.rollNumber)}</div>
          <div><strong>Email:</strong> ${escapeHtml(student.email)}</div>
          <div><strong>Program:</strong> ${escapeHtml(student.program)}</div>
          <div><strong>Semester:</strong> ${student.semester}</div>
          <div><strong>Status:</strong> ${student.isActive ? 'Active' : 'Inactive'}</div>
        </div>

        <div class="student-print-qr">
          ${qrSvg}
          <p class="small-muted">Scan or upload this QR to mark student attendance</p>
        </div>
      </div>
    </div>
  `;
}

async function svgMarkupToPngBlob(svgMarkup: string, size: number): Promise<Blob> {
  const svgBlob = new Blob([svgMarkup], {
    type: 'image/svg+xml;charset=utf-8'
  });

  const svgUrl = URL.createObjectURL(svgBlob);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Unable to render QR image for download'));
      img.src = svgUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;

    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Canvas is not available in this browser');
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, size, size);
    context.drawImage(image, 0, 0, size, size);

    const pngBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Unable to generate PNG download'));
        }
      }, 'image/png');
    });

    return pngBlob;
  } finally {
    URL.revokeObjectURL(svgUrl);
  }
}

function openPreviewWindow(title: string, bodyMarkup: string): void {
  const previewWindow = window.open('', '_blank', 'width=1100,height=850');

  if (!previewWindow) {
    throw new Error('Popup was blocked. Please allow popups to open PDF preview.');
  }

  previewWindow.document.open();
  previewWindow.document.write(`
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${escapeHtml(title)}</title>
        <style>
          :root {
            color-scheme: light;
            font-family: Inter, Arial, sans-serif;
          }

          * {
            box-sizing: border-box;
          }

          body {
            margin: 0;
            padding: 24px;
            background: #f8fafc;
            color: #0f172a;
          }

          .page-title {
            margin: 0 0 18px;
          }

          .print-actions {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            margin-bottom: 22px;
          }

          .print-btn {
            border: none;
            border-radius: 12px;
            background: #2563eb;
            color: #fff;
            padding: 12px 16px;
            font-weight: 700;
            cursor: pointer;
          }

          .print-btn.secondary {
            background: #e2e8f0;
            color: #0f172a;
          }

          .print-card-grid,
          .batch-print-grid {
            display: grid;
            gap: 18px;
          }

          .batch-print-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .student-print-card {
            border: 2px solid #0f172a;
            border-radius: 18px;
            background: #ffffff;
            padding: 18px;
            break-inside: avoid;
            page-break-inside: avoid;
            box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
          }

          .student-print-header {
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 12px;
            margin-bottom: 16px;
          }

          .student-print-header h2 {
            margin: 0 0 4px;
            font-size: 1.25rem;
          }

          .student-print-header p,
          .small-muted {
            margin: 0;
            color: #64748b;
          }

          .student-print-body {
            display: grid;
            grid-template-columns: 1.4fr 1fr;
            gap: 20px;
            align-items: center;
          }

          .student-print-details {
            display: grid;
            gap: 8px;
            font-size: 0.98rem;
          }

          .student-print-qr {
            display: grid;
            justify-items: center;
            gap: 10px;
            text-align: center;
          }

          @media (max-width: 980px) {
            body {
              padding: 16px;
            }

            .batch-print-grid,
            .student-print-body {
              grid-template-columns: 1fr;
            }
          }

          @media print {
            body {
              background: #fff;
              padding: 0;
            }

            .print-actions {
              display: none !important;
            }

            .student-print-card {
              box-shadow: none;
            }
          }
        </style>
      </head>
      <body>
        <h1 class="page-title">${escapeHtml(title)}</h1>
        <div class="print-actions">
          <button class="print-btn" onclick="window.print()">Save as PDF / Print</button>
          <button class="print-btn secondary" onclick="window.close()">Close</button>
        </div>
        ${bodyMarkup}
      </body>
    </html>
  `);
  previewWindow.document.close();
  previewWindow.focus();
}

async function downloadStudentQrPng(student: Student): Promise<void> {
  const svgMarkup = buildQrSvgMarkup(student.qrCodeValue, 512);
  const pngBlob = await svgMarkupToPngBlob(svgMarkup, 512);
  triggerBlobDownload(pngBlob, `${sanitizeFilename(student.rollNumber)}-qr.png`);
}

function downloadStudentQrSvg(student: Student): void {
  const svgMarkup = buildQrSvgMarkup(student.qrCodeValue, 512);
  const svgBlob = new Blob([svgMarkup], {
    type: 'image/svg+xml;charset=utf-8'
  });

  triggerBlobDownload(svgBlob, `${sanitizeFilename(student.rollNumber)}-qr.svg`);
}

function openStudentCardPdfPreview(student: Student): void {
  openPreviewWindow(
    `${student.rollNumber} - ${student.fullName} QR Card`,
    `<div class="print-card-grid">${buildStudentCardMarkup(student)}</div>`
  );
}

function openAllStudentCardsPdfPreview(students: Student[]): void {
  const cards = students.map((student) => buildStudentCardMarkup(student, 150)).join('');

  openPreviewWindow(
    'All Student QR Cards',
    `<div class="batch-print-grid">${cards}</div>`
  );
}

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

  async function handleDownloadQr(student: Student, format: 'png' | 'svg') {
    setError('');
    setMessage('');

    try {
      if (format === 'png') {
        await downloadStudentQrPng(student);
        setMessage(`PNG QR downloaded for ${student.rollNumber}.`);
        return;
      }

      downloadStudentQrSvg(student);
      setMessage(`SVG QR downloaded for ${student.rollNumber}.`);
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function handleSinglePdfPreview(student: Student) {
    setError('');
    setMessage('');

    try {
      openStudentCardPdfPreview(student);
      setMessage(
        'QR card preview opened. Use Save as PDF in the print dialog to download the PDF card.'
      );
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  function handleAllPdfPreview() {
    setError('');
    setMessage('');

    try {
      openAllStudentCardsPdfPreview(students);
      setMessage(
        'All student QR cards preview opened. Use Save as PDF in the print dialog to download the PDF cards.'
      );
    } catch (err) {
      setError(getErrorMessage(err));
    }
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
              Create, update, search, preview QR, download unique QR files, and print
              student admit slip style QR cards.
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

            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleAllPdfPreview}
              disabled={students.length === 0}
            >
              Save All as PDF
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
              Search by name, roll number, email, or program. Preview, download, or
              print each student QR card.
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
                <th>Download QR</th>
                <th>Print / PDF</th>
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
                    <div className="table-actions compact-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => void handleDownloadQr(student, 'png')}
                      >
                        PNG
                      </button>

                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => void handleDownloadQr(student, 'svg')}
                      >
                        SVG
                      </button>
                    </div>
                  </td>
                  <td>
                    <div className="table-actions compact-actions">
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => openSinglePrint(student)}
                      >
                        Print Card
                      </button>

                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => handleSinglePdfPreview(student)}
                      >
                        PDF
                      </button>
                    </div>
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
                  <td colSpan={canEdit ? 10 : 9}>
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
                className="btn btn-secondary"
                onClick={() => void handleDownloadQr(previewStudent, 'png')}
              >
                Download PNG
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => void handleDownloadQr(previewStudent, 'svg')}
              >
                Download SVG
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleSinglePdfPreview(previewStudent)}
              >
                Save as PDF
              </button>

              <button
                type="button"
                className="btn btn-ghost"
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
            <div className="qr-preview-visual">
              <QRCodeSVG value={previewStudent.qrCodeValue} size={220} includeMargin />
              <p className="small-muted qr-upload-note">
                Download this QR as PNG and upload it in the Scanner page to test live
                student verification and attendance.
              </p>
            </div>

            <div className="form-grid">
              <div><strong>Name:</strong> {previewStudent.fullName}</div>
              <div><strong>Roll Number:</strong> {previewStudent.rollNumber}</div>
              <div><strong>Email:</strong> {previewStudent.email}</div>
              <div><strong>Program:</strong> {previewStudent.program}</div>
              <div><strong>Semester:</strong> {previewStudent.semester}</div>
              <div><strong>Status:</strong> {previewStudent.isActive ? 'Active' : 'Inactive'}</div>

              <textarea className="mono-text" readOnly value={previewStudent.qrCodeValue} />
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
                Use this as admit slip style QR card for attendance scanning at exam
                entry.
              </p>
            </div>

            <div className="inline-actions">
              <button type="button" className="btn btn-primary" onClick={handlePrint}>
                Print Now
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => handleSinglePdfPreview(previewStudent)}
              >
                Save as PDF
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
                  <QRCodeSVG value={previewStudent.qrCodeValue} size={180} includeMargin />
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

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleAllPdfPreview}
              >
                Save All as PDF
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
                    <QRCodeSVG value={student.qrCodeValue} size={130} includeMargin />
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