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

    // Validate rating only if provided
    let validatedRating = null;
    if (rating !== undefined && rating !== null) {
      if (typeof rating !== "number" || rating < 1 || rating > 5) {
        return res.status(400).json({
          success: false,
          message: "Rating must be a number between 1 and 5",
        });
      }
      validatedRating = rating;
    }

    const feedback = await FeedbackModel.create({
      message: message.trim(),
      rating: validatedRating,
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

// Get all feedback (GET)
export const getAllFeedback = async (req, res) => {
  try {
    const feedbacks = await FeedbackModel.find({})
      .sort({ createdAt: -1 })
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
