import express from "express";
import protectRoute from "../middlewares/auth.middleware.js";
import { 
  getMessages, 
  getUsersForSidebar, 
  sendMessage, 
  setDisappearingTimer, 
  toggleMessageReaction,
  toggleContactAction,
  deleteMessage,
  clearChatHistory
} from "../controllers/message.controller.js";

const router=express.Router();

router.get('/users',protectRoute,getUsersForSidebar)
router.get('/:id',protectRoute,getMessages)
router.post('/send/:id',protectRoute,sendMessage)
router.post('/disappearing/:id',protectRoute,setDisappearingTimer)
router.post('/reaction/:id',protectRoute,toggleMessageReaction)
router.post('/action/:id',protectRoute,toggleContactAction)
router.delete('/:id',protectRoute,deleteMessage)
router.delete('/clear/:id',protectRoute,clearChatHistory)

export default router;