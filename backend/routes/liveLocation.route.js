import express from "express";
import protectRoute from "../middlewares/auth.middleware.js";
import { getActiveShare, stopShare } from "../controllers/liveLocation.controller.js";

const router = express.Router();

router.get("/active/:sharerId", protectRoute, getActiveShare);
router.post("/stop", protectRoute, stopShare);

export default router;