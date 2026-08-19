import express from "express";
import protectRoute from "../middlewares/auth.middleware.js";
import { signUpload, getUploadLimits, getAttachmentUrl } from "../controllers/upload.controller.js";

const router = express.Router();

// Both routes are authenticated: an open presign endpoint would let anyone
// write objects into the bucket.
router.get("/limits", protectRoute, getUploadLimits);
router.post("/sign", protectRoute, signUpload);
// The bucket is private, so this is the only route to its contents. It checks that
// the caller belongs to the conversation before signing anything.
router.get("/url", protectRoute, getAttachmentUrl);

export default router;
