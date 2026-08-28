import express from "express";
import protectRoute from "../middlewares/auth.middleware.js";
import {
  getAiLanguages,
  translate,
  transliterate,
  textToSpeech,
} from "../controllers/ai.controller.js";

const router = express.Router();

// Sarvam AI endpoints. All are behind protectRoute so the account's free-tier
// quota is not available to the open internet, and the API key stays server-side.
router.get("/languages", protectRoute, getAiLanguages);
router.post("/translate", protectRoute, translate);
router.post("/transliterate", protectRoute, transliterate);
router.post("/text-to-speech", protectRoute, textToSpeech);

export default router;
