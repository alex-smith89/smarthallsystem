import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const attendanceSchema = new Schema(
  {
    examId: {
      type: Schema.Types.ObjectId,
      ref: 'Exam',
      required: true
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student',
      required: true
    },
    hallId: {
      type: Schema.Types.ObjectId,
      ref: 'Hall',
      required: true
    },
    seatAllocationId: {
      type: Schema.Types.ObjectId,
      ref: 'SeatAllocation',
      required: true
    },
    qrCodeValue: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['present', 'absent'],
      default: 'present'
    },
    scanMethod: {
      type: String,
      enum: ['qr', 'manual', 'offline-sync'],
      required: true
    },
    scannedAt: {
      type: Date,
      default: Date.now
    },
    scannedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    notes: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

attendanceSchema.index({ examId: 1, studentId: 1 }, { unique: true });

export type AttendanceType = InferSchemaType<typeof attendanceSchema>;
export const Attendance = mongoose.model<AttendanceType>('Attendance', attendanceSchema);