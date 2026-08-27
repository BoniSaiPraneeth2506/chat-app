import express from "express";
import protectRoute from "../middlewares/auth.middleware.js";
import {
  registerDeviceToken,
  removeDeviceToken,
  listDeviceTokens,
  setConversationMute,
  setNotificationPreferences,
} from "../controllers/deviceToken.controller.js";

const router = express.Router();

// All device-token endpoints require auth: a token is always registered or
// removed against the authenticated user, never against someone else's.
router.post("/device-token", protectRoute, registerDeviceToken);
router.delete("/device-token/:token", protectRoute, removeDeviceToken);
router.get("/device-tokens", protectRoute, listDeviceTokens);

router.put("/mute/:conversationType/:id", protectRoute, setConversationMute);
router.put("/preferences", protectRoute, setNotificationPreferences);

export default router;
