import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const studentSchema = new Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    rollNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    program: {
      type: String,
      required: true,
      trim: true
    },
    semester: {
      type: Number,
      required: true,
      min: 1
    },
    qrCodeValue: {
      type: String,
      required: true,
      unique: true
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

export type StudentType = InferSchemaType<typeof studentSchema>;
export const Student = mongoose.model<StudentType>('Student', studentSchema);