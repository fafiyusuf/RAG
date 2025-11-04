import express from "express";
import { submitFeedback, getAllFeedback } from "../controllers/FeedbackController.js";

const router = express.Router();

// POST /api/feedback - Submit feedback
router.post("/", submitFeedback);

// GET /api/feedback - Get all feedback (admin only, use via Postman)
router.get("/", getAllFeedback);

export default router;
