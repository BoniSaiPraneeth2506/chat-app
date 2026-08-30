import express from "express";
import protectRoute from "../middlewares/auth.middleware.js";
import {
  createChannel,
  getChannel,
  getMyChannels,
  exploreChannels,
  searchChannels,
  updateChannel,
  deleteChannel,
  followChannel,
  unfollowChannel,
  generateInvite,
  revokeInvite,
  joinByInvite,
  getInviteInfo,
  addAdmin,
  removeAdmin,
  muteChannel,
  reportChannel,
  createPost,
  getChannelPosts,
  deletePost,
  pinPost,
  reactToPost,
  viewPost,
  getPostMediaUrl,
  getPostViewers,
} from "../controllers/channel.controller.js";

const router = express.Router();

// Top-level (must be declared before /:channelId routes where a bare id would
// collide with a fixed segment).
router.get("/explore", protectRoute, exploreChannels);
router.get("/search", protectRoute, searchChannels);
router.get("/joined", protectRoute, getMyChannels);
router.post("/invite/join", protectRoute, joinByInvite);
router.get("/invite/:inviteCode", protectRoute, getInviteInfo);
router.post("/", protectRoute, createChannel);

router.route("/:channelId")
  .get(protectRoute, getChannel)
  .put(protectRoute, updateChannel)
  .delete(protectRoute, deleteChannel);

router.post("/:channelId/follow", protectRoute, followChannel);
router.post("/:channelId/unfollow", protectRoute, unfollowChannel);
router.post("/:channelId/mute", protectRoute, muteChannel);
router.post("/:channelId/report", protectRoute, reportChannel);
router.post("/:channelId/invite", protectRoute, generateInvite);
router.post("/:channelId/invite/revoke", protectRoute, revokeInvite);
router.post("/:channelId/admins", protectRoute, addAdmin);
router.delete("/:channelId/admins", protectRoute, removeAdmin);

// Posts.
router.get("/:channelId/posts", protectRoute, getChannelPosts);
router.post("/:channelId/posts", protectRoute, createPost);
router.get("/:channelId/posts/media/:postId", protectRoute, getPostMediaUrl);
router.get("/:channelId/posts/:postId/viewers", protectRoute, getPostViewers);
router.post("/:channelId/posts/:postId/view", protectRoute, viewPost);
router.post("/:channelId/posts/:postId/react", protectRoute, reactToPost);
router.post("/:channelId/posts/:postId/pin", protectRoute, pinPost);
router.delete("/:channelId/posts/:postId", protectRoute, deletePost);

export default router;
