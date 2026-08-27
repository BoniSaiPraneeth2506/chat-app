import express from "express";
import protectRoute from "../middlewares/auth.middleware.js";
import {
  createStatus,
  getStatuses,
  getUserStatuses,
  viewStatus,
  deleteStatus,
  getStatusViewers,
  getStatusMediaUrl,
} from "../controllers/status.controller.js";

const router = express.Router();

router.post("/", protectRoute, createStatus);
router.get("/", protectRoute, getStatuses);
router.get("/media/:statusId", protectRoute, getStatusMediaUrl);
router.get("/viewers/:statusId", protectRoute, getStatusViewers);
router.get("/:userId", protectRoute, getUserStatuses);
router.post("/view/:statusId", protectRoute, viewStatus);
router.delete("/:statusId", protectRoute, deleteStatus);

export default router;
