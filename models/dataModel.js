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

// Cache model
const cacheSchema = new mongoose.Schema(
  {
    query: { type: String, required: true, unique: true, index: true },
    answer: { type: String, required: true },
  },
  { timestamps: true }
);
export const CacheModel = mongoose.model("Cache", cacheSchema);