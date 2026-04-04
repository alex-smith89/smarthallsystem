export type StudentForAllocation = {
  _id: string;
  rollNumber: string;
};

export type HallForAllocation = {
  _id: string;
  name: string;
  capacity: number;
  rows: number;
  columns: number;
  seatPrefix?: string;
};

export type SeatPlanItem = {
  studentId: string;
  hallId: string;
  hallName: string;
  seatNumber: string;
  row: number;
  column: number;
};

function naturalRollSort(a: string, b: string): number {
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: 'base'
  });
}

function buildSeatMap(hall: HallForAllocation): Omit<SeatPlanItem, 'studentId'>[] {
  const maxRows = Math.max(hall.rows, 1);
  const maxColumns = Math.max(hall.columns, 1);
  const maximumSeats = Math.min(hall.capacity, maxRows * maxColumns);

  const seats: Omit<SeatPlanItem, 'studentId'>[] = [];
  let count = 0;

  for (let row = 1; row <= maxRows; row += 1) {
    for (let column = 1; column <= maxColumns; column += 1) {
      if (count >= maximumSeats) {
        return seats;
      }

      const seatLabel = `${hall.seatPrefix || hall.name}-R${row}C${column}`;

      seats.push({
        hallId: hall._id,
        hallName: hall.name,
        seatNumber: seatLabel,
        row,
        column
      });

      count += 1;
    }
  }

  return seats;
}

export function generateSeatAllocations(
  students: StudentForAllocation[],
  halls: HallForAllocation[]
): SeatPlanItem[] {
  const orderedStudents = [...students].sort(
    (a: StudentForAllocation, b: StudentForAllocation) =>
      naturalRollSort(a.rollNumber, b.rollNumber)
  );

  const allSeats: Omit<SeatPlanItem, 'studentId'>[] = halls.flatMap(
    (hall: HallForAllocation) => buildSeatMap(hall)
  );

  if (allSeats.length < orderedStudents.length) {
    throw new Error('Not enough hall capacity to allocate all students');
  }

  return orderedStudents.map((student: StudentForAllocation, index: number) => ({
    studentId: student._id,
    ...allSeats[index]
  }));
}