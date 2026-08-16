import express from "express";
import protectRoute from "../middlewares/auth.middleware.js";
import { signUpload, getUploadLimits } from "../controllers/upload.controller.js";

const router = express.Router();

// Both routes are authenticated: an open presign endpoint would let anyone
// write objects into the bucket.
router.get("/limits", protectRoute, getUploadLimits);
router.post("/sign", protectRoute, signUpload);

export default router;
