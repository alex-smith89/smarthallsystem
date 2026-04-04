import dotenv from 'dotenv';
import { connectDB } from '../config/db.js';
import { Attendance } from '../models/Attendance.js';
import { Exam } from '../models/Exam.js';
import { Hall } from '../models/Hall.js';
import { ScanLog } from '../models/ScanLog.js';
import { SeatAllocation } from '../models/SeatAllocation.js';
import { Student } from '../models/Student.js';
import { User } from '../models/User.js';
import { buildQrPayload } from '../utils/qr.js';

dotenv.config();

async function seed() {
  await connectDB();

  await Promise.all([
    Attendance.deleteMany({}),
    ScanLog.deleteMany({}),
    SeatAllocation.deleteMany({}),
    Exam.deleteMany({}),
    Hall.deleteMany({}),
    Student.deleteMany({}),
    User.deleteMany({})
  ]);

  const [admin, invigilator] = await User.create([
    {
      name: 'System Admin',
      email: 'admin@example.com',
      password: 'Admin123!',
      role: 'admin'
    },
    {
      name: 'Main Invigilator',
      email: 'invigilator@example.com',
      password: 'Invigilator123!',
      role: 'invigilator'
    }
  ]);

  const studentsRaw = [
    ['Suraj Sah', 'BSC001', 'suraj@example.com', 'BSc CSIT', 8],
    ['Anisha Sharma', 'BSC002', 'anisha@example.com', 'BSc CSIT', 8],
    ['Bikash Khadka', 'BSC003', 'bikash@example.com', 'BSc CSIT', 8],
    ['Nabin Gautam', 'BSC004', 'nabin@example.com', 'BSc CSIT', 8],
    ['Pratima Rai', 'BSC005', 'pratima@example.com', 'BSc CSIT', 8],
    ['Roshan Yadav', 'BSC006', 'roshan@example.com', 'BSc CSIT', 8],
    ['Sita Lama', 'BSC007', 'sita@example.com', 'BSc CSIT', 8],
    ['Tenzin Tamang', 'BSC008', 'tenzin@example.com', 'BSc CSIT', 8],
    ['Usha Karki', 'BSC009', 'usha@example.com', 'BSc CSIT', 8],
    ['Yubraj Thapa', 'BSC010', 'yubraj@example.com', 'BSc CSIT', 8],
    ['Aakash Basnet', 'BSC011', 'aakash@example.com', 'BCA', 6],
    ['Binita Tharu', 'BSC012', 'binita@example.com', 'BCA', 6]
  ] as const;

  const students = await Student.insertMany(
    studentsRaw.map(([fullName, rollNumber, email, program, semester]) => ({
      fullName,
      rollNumber,
      email,
      program,
      semester,
      qrCodeValue: buildQrPayload({
        type: 'student-attendance',
        studentId: `pending-${rollNumber}`,
        rollNumber
      })
    }))
  );

  for (const student of students) {
    student.qrCodeValue = buildQrPayload({
      type: 'student-attendance',
      studentId: student._id.toString(),
      rollNumber: student.rollNumber
    });
    await student.save();
  }

  const halls = await Hall.insertMany([
    {
      name: 'Hall A',
      building: 'Block 1',
      floor: 'Ground Floor',
      capacity: 6,
      rows: 2,
      columns: 3,
      seatPrefix: 'A'
    },
    {
      name: 'Hall B',
      building: 'Block 1',
      floor: 'First Floor',
      capacity: 6,
      rows: 2,
      columns: 3,
      seatPrefix: 'B'
    }
  ]);

  await Exam.create({
    title: 'Distributed Systems Final Exam',
    subjectCode: 'CSC401',
    examDate: '2026-04-15',
    startTime: '10:00',
    endTime: '13:00',
    status: 'scheduled',
    hallIds: halls.map((hall) => hall._id),
    studentIds: students.map((student) => student._id),
    createdBy: admin._id
  });

  console.log('Seed complete');
  console.log('Admin login: admin@example.com / Admin123!');
  console.log('Invigilator login: invigilator@example.com / Invigilator123!');
  console.log(`Created ${students.length} students, ${halls.length} halls, 1 exam`);

  process.exit(0);
}

seed().catch((error) => {
  console.error('Seed failed', error);
  process.exit(1);
});