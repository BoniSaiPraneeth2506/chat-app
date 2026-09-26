import express from "express";
import protectRoute from "../middlewares/auth.middleware.js";
import {
  createStatus,
  getStatuses,
  getUserStatuses,
  viewStatus,
  deleteStatus,
  updateStatus,
  getStatusViewers,
  getStatusMediaUrl,
  reactToStatus,
  likeStatus,
  replyToStatus,
  voteStatusPoll,
  answerStatusQuestion,
  getStatusAnswers,
  getStatusAnalytics,
  getScheduledStatuses,
  getArchivedStatuses,
  restoreStatus,
  getStatusPrivacy,
  updateStatusPrivacy,
  getCloseFriends,
  updateCloseFriends,
} from "../controllers/status.controller.js";

const router = express.Router();

// Settings and lists that must be declared before "/:statusId" so they are not
// swallowed by a parameter route.
router.get("/scheduled", protectRoute, getScheduledStatuses);
router.get("/archive", protectRoute, getArchivedStatuses);
router.get("/privacy", protectRoute, getStatusPrivacy);
router.put("/privacy", protectRoute, updateStatusPrivacy);
router.get("/close-friends", protectRoute, getCloseFriends);
router.put("/close-friends", protectRoute, updateCloseFriends);

router.post("/", protectRoute, createStatus);
router.get("/", protectRoute, getStatuses);

router.get("/media/:statusId", protectRoute, getStatusMediaUrl);
router.get("/viewers/:statusId", protectRoute, getStatusViewers);
router.get("/analytics/:statusId", protectRoute, getStatusAnalytics);
router.get("/answers/:statusId", protectRoute, getStatusAnswers);

router.post("/view/:statusId", protectRoute, viewStatus);
router.post("/react/:statusId", protectRoute, reactToStatus);
router.post("/like/:statusId", protectRoute, likeStatus);
router.post("/reply/:statusId", protectRoute, replyToStatus);
router.post("/poll/:statusId/vote", protectRoute, voteStatusPoll);
router.post("/question/:statusId/answer", protectRoute, answerStatusQuestion);
router.post("/:statusId/restore", protectRoute, restoreStatus);

router.get("/:userId", protectRoute, getUserStatuses);
router.put("/:statusId", protectRoute, updateStatus);
router.delete("/:statusId", protectRoute, deleteStatus);

export default router;
