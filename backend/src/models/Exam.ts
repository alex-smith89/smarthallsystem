import mongoose, { Schema, type InferSchemaType, type HydratedDocument, type Model } from 'mongoose';

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
      required: true,
      trim: true
    },
    startTime: {
      type: String,
      required: true,
      trim: true
    },
    endTime: {
      type: String,
      required: true,
      trim: true
    },
    durationMinutes: {
      type: Number,
      required: true,
      min: 1
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
    status: {
      type: String,
      enum: ['scheduled', 'active', 'completed'],
      default: 'scheduled'
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: false
    }
  },
  {
    timestamps: true
  }
);

export type ExamType = InferSchemaType<typeof examSchema>;
export type ExamDocument = HydratedDocument<ExamType>;
export type ExamModel = Model<ExamType>;

export const Exam =
  (mongoose.models.Exam as ExamModel) ||
  mongoose.model<ExamType>('Exam', examSchema);