import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const examSchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    subjectCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true
    },
    examDate: {
      type: String,
      required: true
    },
    startTime: {
      type: String,
      required: true
    },
    endTime: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['scheduled', 'active', 'completed'],
      default: 'scheduled'
    },
    hallIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Hall',
        required: true
      }
    ],
    studentIds: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Student',
        required: true
      }
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

export type ExamType = InferSchemaType<typeof examSchema>;
export const Exam = mongoose.model<ExamType>('Exam', examSchema);