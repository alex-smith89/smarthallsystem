import { generateSeatAllocations } from '../../src/utils/seatAllocator.js';

describe('seatAllocator', () => {
  test('sorts students naturally and assigns seats in hall order', () => {
    const students = [
      { _id: 's2', rollNumber: 'SEC-10' },
      { _id: 's1', rollNumber: 'SEC-2' },
      { _id: 's3', rollNumber: 'SEC-1' }
    ];

    const halls = [
      {
        _id: 'h1',
        name: 'Alpha',
        capacity: 4,
        rows: 2,
        columns: 2,
        seatPrefix: 'A'
      }
    ];

    const allocations = generateSeatAllocations(students, halls);

    expect(allocations).toEqual([
      {
        studentId: 's3',
        hallId: 'h1',
        hallName: 'Alpha',
        seatNumber: 'A-R1C1',
        row: 1,
        column: 1
      },
      {
        studentId: 's1',
        hallId: 'h1',
        hallName: 'Alpha',
        seatNumber: 'A-R1C2',
        row: 1,
        column: 2
      },
      {
        studentId: 's2',
        hallId: 'h1',
        hallName: 'Alpha',
        seatNumber: 'A-R2C1',
        row: 2,
        column: 1
      }
    ]);
  });

  test('falls back to hall name for seat prefix and respects capacity', () => {
    const students = [
      { _id: 's1', rollNumber: 'R-1' },
      { _id: 's2', rollNumber: 'R-2' }
    ];

    const halls = [
      {
        _id: 'h1',
        name: 'BetaHall',
        capacity: 2,
        rows: 3,
        columns: 3
      }
    ];

    const allocations = generateSeatAllocations(students, halls);

    expect(allocations.map((item) => item.seatNumber)).toEqual([
      'BetaHall-R1C1',
      'BetaHall-R1C2'
    ]);
  });

});