import express from "express";
import protectRoute from "../middlewares/auth.middleware.js";
import { getGiphy } from "../controllers/giphy.controller.js";

const router = express.Router();

// One route: trending when q is absent, a search when it is present, for either
// gifs or stickers. Behind protectRoute so the account's free-tier quota is not
// available to the open internet.
router.get("/", protectRoute, getGiphy);

export default router;
