import { useEffect, useMemo, useState } from 'react';
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
  const [searchTerm, setSearchTerm] = useState('');

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

  const filteredHalls = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    if (!keyword) return halls;

    return halls.filter((hall) => {
      return (
        hall.name.toLowerCase().includes(keyword) ||
        hall.building.toLowerCase().includes(keyword) ||
        hall.floor.toLowerCase().includes(keyword) ||
        (hall.seatPrefix || '').toLowerCase().includes(keyword)
      );
    });
  }, [halls, searchTerm]);

  const totalCapacity = useMemo(
    () => halls.reduce((sum, hall) => sum + hall.capacity, 0),
    [halls]
  );

  const largestHallCapacity = useMemo(
    () => (halls.length ? Math.max(...halls.map((hall) => hall.capacity)) : 0),
    [halls]
  );

  const totalSeatGridCapacity = useMemo(
    () => halls.reduce((sum, hall) => sum + hall.rows * hall.columns, 0),
    [halls]
  );

  const layoutCapacity = useMemo(() => {
    const rows = Number(form.rows) || 0;
    const columns = Number(form.columns) || 0;
    return rows * columns;
  }, [form.rows, form.columns]);

  const requestedCapacity = Number(form.capacity) || 0;
  const capacityValid = layoutCapacity >= requestedCapacity && requestedCapacity > 0;

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

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
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

  if (loading) {
    return <LoadingScreen text="Loading halls..." />;
  }

  return (
    <div className="page-stack">
      <div className="stats-grid stats-grid-3">
        <div className="stat-card">
          <p className="stat-label">Total Halls</p>
          <h3 className="stat-value">{halls.length}</h3>
          <p className="stat-helper">All exam hall records</p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Total Capacity</p>
          <h3 className="stat-value">{totalCapacity}</h3>
          <p className="stat-helper">Combined hall seating capacity</p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Largest Hall</p>
          <h3 className="stat-value">{largestHallCapacity}</h3>
          <p className="stat-helper">Largest single hall capacity</p>
        </div>
      </div>

      <div className="card">
        <div className="card-header-row">
          <div>
            <h3>Hall Management</h3>
            <p>
              Create and maintain exam halls with capacity, rows, columns, floor,
              building, and seat prefix setup.
            </p>
          </div>

          {!canEdit ? (
            <span className="pill pill-completed">Read only for invigilator</span>
          ) : null}
        </div>

        {message ? <div className="alert alert-success">{message}</div> : null}
        {error ? <div className="alert alert-error">{error}</div> : null}

        {!capacityValid && canEdit ? (
          <div className="alert alert-info">
            Rows × columns should be equal to or greater than capacity.
          </div>
        ) : null}

        <form className="form-grid" onSubmit={handleSubmit}>
          <div className="form-grid form-grid-2">
            <label className="form-field">
              <span>Hall Name</span>
              <input
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Hall A"
                required
                disabled={!canEdit}
              />
            </label>

            <label className="form-field">
              <span>Building</span>
              <input
                value={form.building}
                onChange={(e) => setForm((prev) => ({ ...prev, building: e.target.value }))}
                placeholder="Block 1"
                required
                disabled={!canEdit}
              />
            </label>

            <label className="form-field">
              <span>Floor</span>
              <input
                value={form.floor}
                onChange={(e) => setForm((prev) => ({ ...prev, floor: e.target.value }))}
                placeholder="Ground Floor"
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
          </div>

          <div className="stats-grid stats-grid-3">
            <div className="stat-card">
              <p className="stat-label">Requested Capacity</p>
              <h3 className="stat-value">{requestedCapacity || 0}</h3>
              <p className="stat-helper">Seats you want to allow</p>
            </div>

            <div className="stat-card">
              <p className="stat-label">Rows × Columns</p>
              <h3 className="stat-value">{layoutCapacity || 0}</h3>
              <p className="stat-helper">Possible physical seat grid</p>
            </div>

            <div className="stat-card">
              <p className="stat-label">Capacity Check</p>
              <h3 className="stat-value">{capacityValid ? 'OK' : 'Low'}</h3>
              <p className="stat-helper">
                {layoutCapacity || 0} layout seats vs {requestedCapacity || 0} capacity
              </p>
            </div>
          </div>

          {canEdit ? (
            <div className="form-actions">
              <button
                className="btn btn-primary"
                disabled={submitting || !capacityValid}
                type="submit"
              >
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
        <div className="card-header-row">
          <div>
            <h3>Hall List</h3>
            <p>Search and manage exam halls with seating layout information.</p>
          </div>

          <div className="inline-filter">
            <label className="form-field">
              <span>Search Hall</span>
              <input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search hall / building / floor / prefix"
              />
            </label>
          </div>
        </div>

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
                <th>Grid Seats</th>
                <th>Prefix</th>
                {canEdit ? <th>Actions</th> : null}
              </tr>
            </thead>

            <tbody>
              {filteredHalls.map((hall) => (
                <tr key={hall._id}>
                  <td>{hall.name}</td>
                  <td>{hall.building}</td>
                  <td>{hall.floor}</td>
                  <td>{hall.capacity}</td>
                  <td>{hall.rows}</td>
                  <td>{hall.columns}</td>
                  <td>{hall.rows * hall.columns}</td>
                  <td>{hall.seatPrefix || '-'}</td>

                  {canEdit ? (
                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => handleEdit(hall)}
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          className="btn btn-danger"
                          onClick={() => void handleDelete(hall._id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}

              {filteredHalls.length === 0 ? (
                <tr>
                  <td colSpan={canEdit ? 9 : 8}>
                    <div className="empty-state">No hall matched your search.</div>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="stats-grid stats-grid-3">
        <div className="stat-card">
          <p className="stat-label">Combined Layout Seats</p>
          <h3 className="stat-value">{totalSeatGridCapacity}</h3>
          <p className="stat-helper">Sum of all rows × columns</p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Usable Capacity</p>
          <h3 className="stat-value">{totalCapacity}</h3>
          <p className="stat-helper">Configured allowed seat capacity</p>
        </div>

        <div className="stat-card">
          <p className="stat-label">Hall Setup Status</p>
          <h3 className="stat-value">
            {totalSeatGridCapacity >= totalCapacity ? 'OK' : 'Check'}
          </h3>
          <p className="stat-helper">Verify hall layout and capacity settings</p>
        </div>
      </div>
    </div>
  );
}