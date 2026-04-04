import mongoose, { Schema, type InferSchemaType } from 'mongoose';

const hallSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true
    },
    building: {
      type: String,
      required: true,
      trim: true
    },
    floor: {
      type: String,
      required: true,
      trim: true
    },
    capacity: {
      type: Number,
      required: true,
      min: 1
    },
    rows: {
      type: Number,
      required: true,
      min: 1
    },
    columns: {
      type: Number,
      required: true,
      min: 1
    },
    seatPrefix: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

export type HallType = InferSchemaType<typeof hallSchema>;
export const Hall = mongoose.model<HallType>('Hall', hallSchema);