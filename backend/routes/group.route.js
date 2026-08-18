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
  createGroupInvite,
  revokeGroupInvite,
  previewGroupInvite,
  joinGroupByInvite,
  markGroupWelcomeSeen,
  setMemberNote,
} from "../controllers/group.controller.js";

const router = express.Router();

router.post("/", protectRoute, createGroup);
router.get("/", protectRoute, getUserGroups);
router.get("/invite/:code", protectRoute, previewGroupInvite);
router.post("/invite/:code/join", protectRoute, joinGroupByInvite);
router.get("/:groupId", protectRoute, getGroupDetails);
router.put("/:groupId", protectRoute, updateGroup);
router.post("/:groupId/members", protectRoute, addGroupMembers);
router.post("/:groupId/invite", protectRoute, createGroupInvite);
router.delete("/:groupId/invite", protectRoute, revokeGroupInvite);
router.delete("/:groupId/members/:memberId", protectRoute, removeGroupMember);
router.put("/:groupId/roles", protectRoute, updateMemberRole);
router.get("/:groupId/messages", protectRoute, getGroupMessages);
router.post("/:groupId/welcome-seen", protectRoute, markGroupWelcomeSeen);
router.post("/:groupId/members/:memberId/note", protectRoute, setMemberNote);
router.post("/:groupId/send", protectRoute, sendGroupMessage);
router.post("/:groupId/polls", protectRoute, createGroupPoll);
router.post("/:groupId/polls/:messageId/vote", protectRoute, voteGroupPoll);
router.post("/:groupId/polls/:messageId/close", protectRoute, closeGroupPoll);

export default router;
