import express from "express";
import protectRoute from "../middlewares/auth.middleware.js";
import {
  createGroup,
  getUserGroups,
  getGroupDetails,
  updateGroup,
  addGroupMembers,
  removeGroupMember,
  updateMemberRole,
  getGroupMessages,
  sendGroupMessage,
  createGroupPoll,
  voteGroupPoll,
  closeGroupPoll,
} from "../controllers/group.controller.js";

const router = express.Router();

router.post("/", protectRoute, createGroup);
router.get("/", protectRoute, getUserGroups);
router.get("/:groupId", protectRoute, getGroupDetails);
router.put("/:groupId", protectRoute, updateGroup);
router.post("/:groupId/members", protectRoute, addGroupMembers);
router.delete("/:groupId/members/:memberId", protectRoute, removeGroupMember);
router.put("/:groupId/roles", protectRoute, updateMemberRole);
router.get("/:groupId/messages", protectRoute, getGroupMessages);
router.post("/:groupId/send", protectRoute, sendGroupMessage);
router.post("/:groupId/polls", protectRoute, createGroupPoll);
router.post("/:groupId/polls/:messageId/vote", protectRoute, voteGroupPoll);
router.post("/:groupId/polls/:messageId/close", protectRoute, closeGroupPoll);

export default router;
