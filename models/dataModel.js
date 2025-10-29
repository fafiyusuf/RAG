import mongoose from "mongoose";

// Data model
const dataSchema = new mongoose.Schema({
  text: String,
  embedding: Array,
  metadata: Object,
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // --- New fields for versioning/deduplication ---
  is_superseded: { type: Boolean, default: false, index: true }, // Mark as superseded, default to false
  new_version_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Data', default: null }, // Link to the document that superseded this one
  // ---------------------------------------------
});
export const DataModel = mongoose.model("Data", dataSchema);

// Cache model with TTL (24 hours)
const cacheSchema = new mongoose.Schema(
  {
    query: { type: String, required: true },
    embedding: { type: [Number], required: true },
    answer: { type: String, required: true },
    lastAccessed: { type: Date, default: Date.now },
    createdAt: { type: Date, default: Date.now, expires: 86400 }, // TTL: 24 hours (86400 seconds)
  },
  { timestamps: true }
);

export const CacheModel = mongoose.model("Cache", cacheSchema);