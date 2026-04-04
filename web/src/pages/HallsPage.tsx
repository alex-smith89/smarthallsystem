import { useEffect, useState } from 'react';
import LoadingScreen from '../components/LoadingScreen';
import { useAuth } from '../contexts/AuthContext';
import { api, getErrorMessage } from '../lib/api';
import type { Hall } from '../types';

type HallFormState = {
  name: string;
  building: string;
  floor: string;
  capacity: string;
  rows: string;
  columns: string;
  seatPrefix: string;
};

const initialForm: HallFormState = {
  name: '',
  building: '',
  floor: '',
  capacity: '1',
  rows: '1',
  columns: '1',
  seatPrefix: ''
};

export default function HallsPage() {
  const { user } = useAuth();
  const [halls, setHalls] = useState<Hall[]>([]);
  const [form, setForm] = useState<HallFormState>(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const canEdit = user?.role === 'admin';

  async function loadHalls() {
    setLoading(true);
    setError('');

    try {
      const response = await api.getHalls();
      setHalls(response.data);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadHalls();
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

    const payload = {
      name: form.name,
      building: form.building,
      floor: form.floor,
      capacity: Number(form.capacity),
      rows: Number(form.rows),
      columns: Number(form.columns),
      seatPrefix: form.seatPrefix || undefined
    };

    try {
      if (editingId) {
        await api.updateHall(editingId, payload);
        setMessage('Hall updated successfully.');
      } else {
        await api.createHall(payload as Omit<Hall, '_id'>);
        setMessage('Hall created successfully.');
      }

      resetForm();
      await loadHalls();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(hall: Hall) {
    setEditingId(hall._id);
    setForm({
      name: hall.name,
      building: hall.building,
      floor: hall.floor,
      capacity: String(hall.capacity),
      rows: String(hall.rows),
      columns: String(hall.columns),
      seatPrefix: hall.seatPrefix || ''
    });
  }

  async function handleDelete(hallId: string) {
    if (!canEdit) return;

    const confirmed = window.confirm('Delete this hall?');
    if (!confirmed) return;

    try {
      await api.deleteHall(hallId);
      setMessage('Hall deleted successfully.');
      await loadHalls();
    } catch (err) {
      setError(getErrorMessage(err));
    }
  }

  const totalCapacity = halls.reduce((sum, hall) => sum + hall.capacity, 0);

  if (loading) {
    return <LoadingScreen text="Loading halls..." />;
  }

  return (
    <div className="page-stack">
      <div className="stats-grid stats-grid-3">
        <div className="stat-card">
          <p className="stat-label">Total Halls</p>
          <h3 className="stat-value">{halls.length}</h3>
        </div>
        <div className="stat-card">
          <p className="stat-label">Total Capacity</p>
          <h3 className="stat-value">{totalCapacity}</h3>
        </div>
        <div className="stat-card">
          <p className="stat-label">Largest Hall</p>
          <h3 className="stat-value">
            {halls.length ? Math.max(...halls.map((hall) => hall.capacity)) : 0}
          </h3>
        </div>
      </div>

      <div className="card">
        <div className="card-header-row">
          <div>
            <h3>Hall Management</h3>
            <p>Create and maintain exam halls with capacity, row, and column setup.</p>
          </div>
          {!canEdit ? <span className="pill pill-completed">Read only for invigilator</span> : null}
        </div>

        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-error">{error}</div> : null}

        <form className="form-grid form-grid-2" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Hall Name</span>
            <input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
              disabled={!canEdit}
            />
          </label>

          <label className="form-field">
            <span>Building</span>
            <input
              value={form.building}
              onChange={(e) => setForm((prev) => ({ ...prev, building: e.target.value }))}
              required
              disabled={!canEdit}
            />
          </label>

          <label className="form-field">
            <span>Floor</span>
            <input
              value={form.floor}
              onChange={(e) => setForm((prev) => ({ ...prev, floor: e.target.value }))}
              required
              disabled={!canEdit}
            />
          </label>

          <label className="form-field">
            <span>Seat Prefix</span>
            <input
              value={form.seatPrefix}
              onChange={(e) => setForm((prev) => ({ ...prev, seatPrefix: e.target.value }))}
              placeholder="A / B / H1"
              disabled={!canEdit}
            />
          </label>

          <label className="form-field">
            <span>Capacity</span>
            <input
              type="number"
              min="1"
              value={form.capacity}
              onChange={(e) => setForm((prev) => ({ ...prev, capacity: e.target.value }))}
              required
              disabled={!canEdit}
            />
          </label>

          <label className="form-field">
            <span>Rows</span>
            <input
              type="number"
              min="1"
              value={form.rows}
              onChange={(e) => setForm((prev) => ({ ...prev, rows: e.target.value }))}
              required
              disabled={!canEdit}
            />
          </label>

          <label className="form-field">
            <span>Columns</span>
            <input
              type="number"
              min="1"
              value={form.columns}
              onChange={(e) => setForm((prev) => ({ ...prev, columns: e.target.value }))}
              required
              disabled={!canEdit}
            />
          </label>

          {canEdit ? (
            <div className="form-actions form-actions-full">
              <button className="btn btn-primary" disabled={submitting} type="submit">
                {submitting ? 'Saving...' : editingId ? 'Update Hall' : 'Add Hall'}
              </button>
              <button type="button" className="btn btn-secondary" onClick={resetForm}>
                Reset
              </button>
            </div>
          ) : null}
        </form>
      </div>

      <div className="card">
        <h3>Hall List</h3>
        <div className="responsive-table">
          <table>
            <thead>
              <tr>
                <th>Hall</th>
                <th>Building</th>
                <th>Floor</th>
                <th>Capacity</th>
                <th>Rows</th>
                <th>Columns</th>
                <th>Prefix</th>
                {canEdit ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {halls.map((hall) => (
                <tr key={hall._id}>
                  <td>{hall.name}</td>
                  <td>{hall.building}</td>
                  <td>{hall.floor}</td>
                  <td>{hall.capacity}</td>
                  <td>{hall.rows}</td>
                  <td>{hall.columns}</td>
                  <td>{hall.seatPrefix || '-'}</td>
                  {canEdit ? (
                    <td>
                      <div className="table-actions">
                        <button className="btn btn-ghost" onClick={() => handleEdit(hall)}>
                          Edit
                        </button>
                        <button className="btn btn-danger" onClick={() => void handleDelete(hall._id)}>
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