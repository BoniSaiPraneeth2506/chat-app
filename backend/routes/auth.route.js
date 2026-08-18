import express from "express";
import { checkAuth, login, logout, signup, googleAuth, updateProfile, deleteAccount, forgotPassword, resetPassword, getSessions, revokeSession, revokeOtherSessions } from "../controllers/auth.controller.js";
import protectRoute from "../middlewares/auth.middleware.js";
import {
  setupChatLock,
  unlockChats,
  changeChatLockPassword,
  recoverChatLock,
  disableChatLock,
  toggleChatLocked,
  getChatLockStatus,
} from "../controllers/chatLock.controller.js";
const router=express.Router();

router.post('/signup',signup)

router.post('/login',login)

router.post('/google',googleAuth)

router.post('/logout',logout)

router.post('/forgot-password', forgotPassword)

router.post('/reset-password', resetPassword)

router.put('/update-profile',protectRoute,updateProfile)

router.get('/check',protectRoute,checkAuth)

router.delete('/account',protectRoute,deleteAccount)

router.get('/sessions',protectRoute,getSessions)

router.post('/sessions/logout-others',protectRoute,revokeOtherSessions)

router.delete('/sessions/:sid',protectRoute,revokeSession)

// ── Chat lock ───────────────────────────────────────────────────────────────
router.get('/chat-lock',protectRoute,getChatLockStatus)
router.post('/chat-lock/setup',protectRoute,setupChatLock)
router.post('/chat-lock/unlock',protectRoute,unlockChats)
router.post('/chat-lock/password',protectRoute,changeChatLockPassword)
router.post('/chat-lock/recover',protectRoute,recoverChatLock)
router.post('/chat-lock/disable',protectRoute,disableChatLock)
router.post('/chat-lock/toggle/:id',protectRoute,toggleChatLocked)

export default router