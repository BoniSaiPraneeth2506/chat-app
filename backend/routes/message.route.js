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
  clearChatHistory,
  editMessage,
  toggleBlockUser,
  createCallLog,
  togglePinMessage,
  updateChatWallpaper,
  viewOneViewMessage,
  deleteMessagesBulk,
  cancelScheduledMessage,
  setContactNickname,
  getBlockedUsers,
  exportChat,
  getMessageInfo,
  requestTranscript
} from "../controllers/message.controller.js";
// rate limiting removed: middleware import intentionally omitted

const router=express.Router();

router.get('/users',protectRoute,getUsersForSidebar)
router.get('/blocked',protectRoute,getBlockedUsers)
router.get('/export/:id',protectRoute,exportChat)
router.get('/info/:id',protectRoute,getMessageInfo)
router.get('/:id',protectRoute,getMessages)
// per-user message send limiter: 20 messages per 10 seconds (cost=1)
router.post('/send/:id', protectRoute, sendMessage)
router.post('/disappearing/:id',protectRoute,setDisappearingTimer)
router.post('/reaction/:id',protectRoute,toggleMessageReaction)
router.post('/action/:id',protectRoute,toggleContactAction)
router.put('/edit/:id',protectRoute,editMessage)
router.post('/block/:id',protectRoute,toggleBlockUser)
// protect call-log creation (prevent spamming call logs)
router.post('/call-log', protectRoute, createCallLog)
router.put('/pin/:id',protectRoute,togglePinMessage)
router.post('/wallpaper/:id',protectRoute,updateChatWallpaper)
router.post('/view-once/:id',protectRoute,viewOneViewMessage)
router.post('/:id/transcribe',protectRoute,requestTranscript)
router.post('/delete-bulk',protectRoute,deleteMessagesBulk)
router.delete('/:id',protectRoute,deleteMessage)
router.delete('/clear/:id',protectRoute,clearChatHistory)
router.post('/schedule/cancel/:id', protectRoute, cancelScheduledMessage);
router.post('/nickname/:id', protectRoute, setContactNickname);

export default router;