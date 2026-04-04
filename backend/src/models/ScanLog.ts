import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const scanLogSchema = new Schema(
  {
    examId: {
      type: Schema.Types.ObjectId,
      ref: 'Exam',
      required: true
    },
    studentId: {
      type: Schema.Types.ObjectId,
      ref: 'Student'
    },
    hallId: {
      type: Schema.Types.ObjectId,
      ref: 'Hall'
    },
    qrCodeValue: {
      type: String,
      required: true
    },
    result: {
      type: String,
      enum: ['valid', 'duplicate', 'invalid', 'manual'],
      required: true
    },
    message: {
      type: String,
      required: true
    },
    scannedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

export type ScanLogType = InferSchemaType<typeof scanLogSchema>;
export const ScanLog = mongoose.model<ScanLogType>('ScanLog', scanLogSchema);