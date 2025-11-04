import mongoose from "mongoose";

// Feedback model for collecting user feedback
const feedbackSchema = new mongoose.Schema(
  {
    message: { type: String, required: true },
    rating: { type: Number, min: 1, max: 5 }, // optional rating 1-5
    userAgent: { type: String }, // browser/device info (optional)
    createdAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const FeedbackModel = mongoose.model("Feedback", feedbackSchema);
