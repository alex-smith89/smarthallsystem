import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const seatAllocationSchema = new Schema(
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
    seatNumber: {
      type: String,
      required: true,
      trim: true
    },
    row: {
      type: Number,
      required: true
    },
    column: {
      type: Number,
      required: true
    },
    qrCodeValue: {
      type: String,
      required: true
    },
    allocatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

seatAllocationSchema.index({ examId: 1, studentId: 1 }, { unique: true });
seatAllocationSchema.index({ examId: 1, hallId: 1, seatNumber: 1 }, { unique: true });

export type SeatAllocationType = InferSchemaType<typeof seatAllocationSchema>;
export const SeatAllocation = mongoose.model<SeatAllocationType>('SeatAllocation', seatAllocationSchema);