import mongoose from "mongoose";

const dataSchema = new mongoose.Schema(
  {
    text: { type: String,
         required: true },
    embedding: { type: [Number],
         required: true },
  },
  { timestamps: true }
);

const DataModel = mongoose.model("Data", dataSchema);

export default DataModel;
