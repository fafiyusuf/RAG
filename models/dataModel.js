import mongoose from "mongoose";

// Data model
const dataSchema = new mongoose.Schema(
  {
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },
  },
  { timestamps: true }
);
export const DataModel = mongoose.model("Data", dataSchema);

// Cache model
const cacheSchema = new mongoose.Schema(
  {
    query: { type: String, required: true, unique: true, index: true },
    answer: { type: String, required: true },
  },
  { timestamps: true }
);
export const CacheModel = mongoose.model("Cache", cacheSchema);
