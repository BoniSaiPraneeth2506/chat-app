import express from "express";
import { checkAuth, login, logout, signup, updateProfile, forgotPassword, resetPassword, getSessions, revokeSession, revokeOtherSessions } from "../controllers/auth.controller.js";
import protectRoute from "../middlewares/auth.middleware.js";
const router=express.Router();

router.post('/signup',signup)

router.post('/login',login)

router.post('/logout',logout)

router.post('/forgot-password', forgotPassword)

router.post('/reset-password', resetPassword)

router.put('/update-profile',protectRoute,updateProfile)

router.get('/check',protectRoute,checkAuth)

router.get('/sessions',protectRoute,getSessions)

router.post('/sessions/logout-others',protectRoute,revokeOtherSessions)

router.delete('/sessions/:sid',protectRoute,revokeSession)

export default router