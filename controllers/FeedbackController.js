import { FeedbackModel } from "../models/FeedbackModel.js";

// Submit feedback (POST)
export const submitFeedback = async (req, res) => {
  try {
    const { message, rating } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Feedback message is required",
      });
    }

    // Optional: validate rating if provided
    if (rating !== undefined && (rating < 1 || rating > 5)) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    const feedback = await FeedbackModel.create({
      message: message.trim(),
      rating: rating || null,
      userAgent: req.headers["user-agent"] || null,
    });

    return res.status(201).json({
      success: true,
      message: "Thank you for your feedback!",
      feedbackId: feedback._id,
    });
  } catch (error) {
    console.error("Error submitting feedback:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to submit feedback",
    });
  }
};

// Get all feedback (GET) - for admin use via Postman
export const getAllFeedback = async (req, res) => {
  try {
    const feedbacks = await FeedbackModel.find({})
      .sort({ createdAt: -1 }) // newest first
      .lean();

    return res.status(200).json({
      success: true,
      count: feedbacks.length,
      feedbacks,
    });
  } catch (error) {
    console.error("Error fetching feedback:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch feedback",
    });
  }
};
