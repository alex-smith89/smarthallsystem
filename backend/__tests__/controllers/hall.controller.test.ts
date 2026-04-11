import { createHall, updateHall, deleteHall } from '../../src/controllers/hallController.js';
import { Hall } from '../../src/models/Hall.js';

jest.mock('express-async-handler', () => ({
  __esModule: true,
  default: (fn: any) => (req: any, res: any, next: any) =>
    Promise.resolve(fn(req, res, next)).catch(next)
}));

jest.mock('../../src/models/Hall.js', () => ({
  Hall: {
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn()
  }
}));

const mockedHall = Hall as jest.Mocked<typeof Hall>;

const createRes = () => {
  const res: any = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('hallController', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 400 when required fields are missing', async () => {
    const req: any = {
      body: {
        name: '   ',
        building: 'Block A',
        floor: '',
        capacity: 30,
        rows: 5,
        columns: 6
      }
    };
    const res = createRes();
    const next = jest.fn();

    await createHall(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'Hall name, building, and floor are required'
      })
    );
    expect(res.json).not.toHaveBeenCalled();
  });

  test('returns 409 when a duplicate hall name exists', async () => {
    mockedHall.findOne.mockResolvedValue({ _id: 'existing_hall' } as any);

    const req: any = {
      body: {
        name: ' Hall 101 ',
        building: 'Block A',
        floor: '2',
        capacity: 30,
        rows: 5,
        columns: 6,
        seatPrefix: ' H1 '
      }
    };
    const res = createRes();
    const next = jest.fn();

    await createHall(req, res, next);

    expect(mockedHall.findOne).toHaveBeenCalledWith({ name: 'Hall 101' });
    expect(res.status).toHaveBeenCalledWith(409);
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        message: 'A hall with the same name already exists'
      })
    );
    expect(res.json).not.toHaveBeenCalled();
  });

  test('creates a hall with normalized values', async () => {
    mockedHall.findOne.mockResolvedValue(null as any);
    mockedHall.create.mockResolvedValue({ _id: 'hall_1', name: 'Hall 101' } as any);

    const req: any = {
      body: {
        name: ' Hall 101 ',
        building: ' Block A ',
        floor: ' 2 ',
        capacity: 30,
        rows: 5,
        columns: 6,
        seatPrefix: ' H1 '
      }
    };
    const res = createRes();
    const next = jest.fn();

    await createHall(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mockedHall.create).toHaveBeenCalledWith({
      name: 'Hall 101',
      building: 'Block A',
      floor: '2',
      capacity: 30,
      rows: 5,
      columns: 6,
      seatPrefix: 'H1'
    });
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({ _id: 'hall_1' })
    });
  });

  test('updates and deletes a hall successfully', async () => {
    const hallDoc: any = {
      _id: 'hall_1',
      name: 'Hall 101',
      building: 'Block A',
      floor: '2',
      capacity: 30,
      rows: 5,
      columns: 6,
      seatPrefix: 'H1',
      toObject: jest.fn(function () {
        return {
          _id: this._id,
          name: this.name,
          building: this.building,
          floor: this.floor,
          capacity: this.capacity,
          rows: this.rows,
          columns: this.columns,
          seatPrefix: this.seatPrefix
        };
      }),
      save: jest.fn().mockResolvedValue(undefined),
      deleteOne: jest.fn().mockResolvedValue(undefined)
    };

    mockedHall.findById
      .mockResolvedValueOnce(hallDoc)
      .mockResolvedValueOnce(hallDoc);

    mockedHall.findOne.mockResolvedValue(null as any);

    const updateReq: any = {
      params: { id: 'hall_1' },
      body: {
        name: ' Hall 201 ',
        building: ' Block B ',
        floor: ' 3 ',
        capacity: 40,
        rows: 5,
        columns: 8,
        seatPrefix: ' H2 '
      }
    };
    const updateRes = createRes();
    const updateNext = jest.fn();

    await updateHall(updateReq, updateRes, updateNext);

    expect(updateNext).not.toHaveBeenCalled();
    expect(hallDoc.name).toBe('Hall 201');
    expect(hallDoc.building).toBe('Block B');
    expect(hallDoc.floor).toBe('3');
    expect(hallDoc.capacity).toBe(40);
    expect(hallDoc.rows).toBe(5);
    expect(hallDoc.columns).toBe(8);
    expect(hallDoc.seatPrefix).toBe('H2');
    expect(hallDoc.toObject).toHaveBeenCalledTimes(1);
    expect(hallDoc.save).toHaveBeenCalledTimes(1);
    expect(updateRes.json).toHaveBeenCalledWith({
      success: true,
      data: expect.objectContaining({
        _id: 'hall_1',
        name: 'Hall 201',
        building: 'Block B',
        floor: '3',
        capacity: 40,
        rows: 5,
        columns: 8,
        seatPrefix: 'H2'
      })
    });

    const deleteReq: any = {
      params: { id: 'hall_1' }
    };
    const deleteRes = createRes();
    const deleteNext = jest.fn();

    await deleteHall(deleteReq, deleteRes, deleteNext);

    expect(deleteNext).not.toHaveBeenCalled();
    expect(hallDoc.deleteOne).toHaveBeenCalledTimes(1);
    expect(deleteRes.json).toHaveBeenCalledWith({
      success: true,
      message: 'Hall deleted successfully'
    });
  });
});