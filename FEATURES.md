# Chatty — Complete Feature List (MERN Chat App)

A full-featured, WhatsApp-style real-time chat application built with **MongoDB, Express, React, Node.js (MERN)**, using **Socket.IO** for real-time communication and **Cloudinary** for media storage.

---

## 1. Authentication & User Management

| Feature | Details |
|---|---|
| **Signup** | Email/password registration with bcrypt password hashing (salt rounds = 10) |
| **Login** | Email/password login with specific error messages ("Email not found" / "Incorrect password") |
| **Logout** | Clears JWT cookie and localStorage token |
| **JWT Authentication** | 7-day expiry token stored in HTTP-only cookie + localStorage fallback (`Authorization: Bearer` header) |
| **Session Persistence** | `checkAuth` on app load restores session and reconnects socket |
| **Profile Update** | Edit full name, email, bio, website link, profile picture (Cloudinary upload with type/size validation) |
| **Online Privacy Toggle** | Hide/show online status from other users (`onlinePrivacy` field) |
| **User Sanitization** | Server returns whitelisted user fields only (never exposes password/hash) |
| **Socket JWT Auth** | Socket.IO connections verified via JWT token (not client-supplied userId) |

---

## 2. 1-on-1 Messaging

| Feature | Details |
|---|---|
| **Text Messages** | Real-time delivery via Socket.IO |
| **Image Messages** | Single image upload to Cloudinary (JPEG/PNG/GIF/WebP, max 6 MB) |
| **Multi-Image Messages** | Send up to 5 images per message (grid layout in chat) |
| **Voice Messages** | Record via `MediaRecorder`, upload as Cloudinary video resource (max 11 MB) |
| **Message Replies** | Quote another message with reply banner and click-to-scroll |
| **Message Editing** | Edit own messages within 15 minutes (shows "edited" indicator) |
| **Message Deletion** | "Delete for me" (soft-delete via `deletedFor` array) / "Delete for everyone" (sender only) |
| **Bulk Message Deletion** | Selection mode with checkboxes → delete multiple messages at once |
| **Message Forwarding** | Forward text/image/voice messages to multiple recipients with "Forwarded" flag |
| **Message Reactions** | Emoji reactions (👍❤️😂😮😢🙏), one per user, toggle by re-clicking, double-click ❤️ |
| **Message Pinning** | Pin one message per conversation (sticky banner at top, auto-unpins previous) |
| **Disappearing Messages** | Off / 1h / 24h / 7d timers via MongoDB TTL index (`deleteAt`) |
| **View-Once Messages** | Self-destructing photos with "Opened" state, viewed tracking, chime sound |
| **Scheduled Messages** | Schedule messages for future delivery (datetime picker, background scheduler polls every 10s) |
| **Message Drafts** | Per-conversation draft auto-save/restore in localStorage |
| **Optimistic UI** | Instant message send with temp ID, replaced by server response |
| **Upload Progress** | Simulated progress bar with cancel/abort for image uploads |
| **Typing Indicators** | Real-time typing status with 1.5s debounce |
| **Read Receipts** | Single/double checkmarks (sent/delivered/read), blue ticks with privacy toggle |
| **Infinite Scroll** | Paginated message loading (20 per page) with scroll-up loading |
| **Date Separators** | Today / Yesterday / Weekday / Full date labels between messages |
| **Personal Notes** | Self-chat with yourself for notes/drafts/links |
| **Message Search** | In-chat search with yellow highlight of matches |
| **Chat Calendar** | Calendar view to jump to messages by date |
| **Link Previews** | Rich link preview cards (via microlink.io), YouTube embeds, direct video playback |
| **Call Log Messages** | Auto-generated call summary messages (completed/missed/declined with duration) |
| **Scheduled Message Cancel** | Cancel pending scheduled messages |

---

## 3. Group Chats

| Feature | Details |
|---|---|
| **Create Group** | Name, description, group picture (Cloudinary), select members |
| **Group Roles** | Admin / Moderator / Member |
| **Group Settings** | Update name, description, avatar, read-only mode (admin/moderator only) |
| **Add Members** | Admin/moderator can add new members |
| **Remove Member / Leave** | Self-leave or admin/moderator removal |
| **Role Management** | Admin can promote/demote members |
| **Group Messages** | Text, images (up to 5), voice, replies |
| **Group Typing Indicators** | Per-user typing status in groups |
| **Group Read-Only Mode** | Only admins/moderators can send messages |
| **Group Unread Counts** | Per-group unread badges |
| **Group Latest Message** | Shows sender name + message preview |
| **Group Member Count** | Badge showing number of members |
| **Group Call Logs** | Auto-generated call summary in group chat |

---

## 4. Real-Time Calling (WebRTC)

### 1-on-1 Calls
| Feature | Details |
|---|---|
| **Voice Calls** | Peer-to-peer audio calls via `RTCPeerConnection` |
| **Video Calls** | Video + audio calls with PiP local video |
| **Screen Sharing** | Share screen during video calls (replaceTrack) |
| **Mute Toggle** | Mute/unmute microphone during call |
| **Call States** | Ringing / Incoming / Connected / Ended |
| **Call Minimize** | Minimize/maximize call UI overlay |
| **STUN/TURN Servers** | Google STUN + Metered.ca open relay TURN for NAT traversal |
| **ICE Candidate Queueing** | Pending candidates queued until remote description set |
| **Camera Fallback** | Auto-downgrade to audio-only if camera busy |
| **Call Logs** | Completed/missed/declined call messages saved to chat |

### Group Calls (Mesh WebRTC)
| Feature | Details |
|---|---|
| **Group Voice/Video Calls** | Multi-peer mesh WebRTC calls |
| **Group Call Signaling** | Offer/answer/ICE relayed via Socket.IO |
| **Participant Management** | Join/leave notifications, participant list |
| **Call Duration** | Tracked and saved to call log |
| **Host Controls** | Starter can end call for everyone |

---

## 5. Contact Management

| Feature | Details |
|---|---|
| **User Search** | Server-side regex search by full name (with regex escaping) |
| **Favorites** | Star contacts (localStorage) |
| **Archive Chats** | Archive/unarchive chats (localStorage) |
| **Pin Chats** | Pin up to 2 chats to top (localStorage) |
| **Block/Unblock** | Server-side blocking; blocked users cannot exchange messages |
| **Context Menu** | Right-click (desktop) / long-press (mobile) for pin/star/archive/delete chat |
| **Filter Chips** | All / Groups / Unread / Favorites / Online |
| **Archived Chats View** | Dedicated archived chats section |
| **Clear Chat History** | Soft-delete entire conversation |
| **Profile Preview Modal** | WhatsApp-style profile popup with message/call/info actions |
| **QR Code Deep Link** | `/chat-with/:userId` shareable link |
| **Online Status** | Green dot indicator, online/offline states |
| **Last Seen** | Timestamp tracking on disconnect |
| **Unread Badges** | Per-contact unread message counts |

---

## 6. Customization & Settings

| Feature | Details |
|---|---|
| **32 Color Themes** | light, dark, cupcake, bumblebee, emerald, corporate, synthwave, retro, cyberpunk, valentine, halloween, garden, forest, aqua, lofi, pastel, fantasy, wireframe, black, luxury, dracula, cmyk, autumn, business, acid, lemonade, night, coffee, winter, dim, nord, sunset |
| **Chat Wallpapers** | Per-conversation wallpapers (color/gradient presets or custom uploaded image) |
| **Wallpaper Dimming** | Adjustable dim/brightness level (`#dim=0-80` suffix) |
| **Wallpaper Sync** | Wallpaper synced to both participants in real-time |
| **Notification Sound** | Toggle message notification sound |
| **Read Receipt Privacy** | Toggle blue read ticks on/off |
| **Online Privacy** | Toggle online status visibility |

---

## 7. Security Features

| Feature | Details |
|---|---|
| **Helmet** | HTTP security headers (CSP, X-Frame-Options, etc.) |
| **HTML Sanitization** | `sanitize-html` strips all HTML/JS from message text |
| **Input Validation** | Image/voice type whitelists + size caps |
| **Regex Escaping** | Prevents ReDoS / NoSQL injection in search |
| **JWT Socket Auth** | Socket connections verified via JWT |
| **Spoofing Protection** | Server validates `from`/`receiverId` against authenticated user |
| **CORS** | Restricted origins in production |
| **Block Enforcement** | Server-side block check before message delivery |
| **Rate Limiting** | Rate limit middleware exists (`rateLimit.middleware.js`) |
| **User Sanitization** | Whitelisted fields only in API responses |

---

## 8. Keyboard Shortcuts (Desktop)

| Shortcut | Action |
|---|---|
| `Ctrl/Cmd + K` | Focus global search |
| `Ctrl/Cmd + Enter` | Send message |
| `/` | Focus search |
| `Escape` | Close open modal |
| `ArrowUp` (empty input) | Edit last message |

---

## 9. Mobile Support

| Feature | Details |
|---|---|
| **Responsive Layout** | Mobile-first design with collapsible sidebar |
| **Long-press Context Menu** | 600ms long-press for contact actions |
| **Tap Message Actions** | Tap message → action bar (reply/forward/edit/pin/delete) |
| **Long-press Emoji Picker** | 450ms long-press → emoji reaction bar |
| **Mobile Back Button** | History pushState for back navigation |

---

## 10. Real-Time Events (Socket.IO)

### Client → Server
| Event | Payload | Purpose |
|---|---|---|
| `markAsRead` | `{ senderId, receiverId }` | Read receipt notification |
| `typing` | `{ receiverId, isTyping }` | Typing indicator |
| `callUser` | `{ userToCall, signalData, from, type }` | Initiate WebRTC call |
| `answerCall` | `{ signal, to }` | Answer call |
| `endCall` | `{ to }` | End call |
| `iceCandidate` | `{ candidate, to }` | ICE candidate relay |
| `joinGroupRoom` | `groupId` | Join group socket room |
| `leaveGroupRoom` | `groupId` | Leave group socket room |
| `groupTyping` | `{ groupId, isTyping }` | Group typing indicator |
| `startGroupCall` | `{ groupId, type, groupName }` | Start group call |
| `joinGroupCall` | `{ groupId, user }` | Join group call |
| `sendGroupSignal` | `{ toSocketId, signal, fromUser }` | Group call signaling |
| `endGroupCall` | `{ groupId }` | End group call |
| `leaveGroupCall` | `{ groupId }` | Leave group call |

### Server → Client
| Event | Payload | Purpose |
|---|---|---|
| `getOnlineUsers` | `string[]` | Online user IDs |
| `newMessage` | `Message` | New message |
| `messagesRead` | `{ userId }` | Read confirmation |
| `disappearingTimerUpdate` | `{ userId, timer }` | Timer changed |
| `typing` | `{ senderId, isTyping }` | Typing indicator |
| `messageReaction` | `{ messageId, reactions }` | Reaction update |
| `messageDeleted` | `{ messageId, isDeletedForEveryone }` | Message deleted |
| `messageEdited` | `Message` | Message edited |
| `messagePinned` | `Message` | Message pinned |
| `chatWallpaperUpdate` | `{ updatedBy, wallpaper }` | Wallpaper changed |
| `messageViewed` | `{ messageId, viewedBy }` | View-once message viewed |
| `callUser` | `{ signal, from, type }` | Incoming call |
| `callAccepted` | `{ signal }` | Call accepted |
| `callEnded` | — | Call ended |
| `iceCandidate` | `{ candidate }` | ICE candidate |
| `newGroupMessage` | `Message` | New group message |
| `groupCreated` | `Group` | Group created |
| `groupUpdated` | `Group` | Group updated |
| `groupTyping` | `{ groupId, userId, isTyping }` | Group typing |
| `removedFromGroup` | `{ groupId }` | Removed from group |
| `groupCallStarted` | `{ groupId, type, groupName, startedBy }` | Group call started |
| `allGroupCallParticipants` | `[{ socketId, userId }]` | Group call participants |
| `groupCallUserJoined` | `{ socketId, user }` | User joined group call |
| `groupCallSignalReceived` | `{ fromSocketId, signal, fromUser }` | Group call signal |
| `groupUserLeftCall` | `{ socketId, userId }` | User left group call |
| `groupCallEnded` | `{ groupId, duration, endedBy, startedBy, type }` | Group call ended |

---

## 11. Data Models

### User
- `fullName`, `email` (unique), `password` (hashed), `profilePic`, `bio`, `link`
- `onlinePrivacy` (Boolean), `disappearingTimers` (Map), `lastSeen` (Date)
- `favorites`, `archived`, `blockedUsers` (ObjectId arrays)
- `chatWallpapers` (Map), `messageTimer`

### Message
- `senderId`, `receiverId`, `groupId` (for group messages)
- `text`, `image`, `images[]` (up to 5), `voice`
- `isEdited`, `isCallLog`, `callType`, `callDuration`, `callStatus`
- `deleteAt` (TTL for disappearing), `replyTo`, `reactions[]`
- `deletedFor[]`, `isDeletedForEveryone`, `isPinned`
- `isForwarded`, `isOneView`, `viewedBy[]`
- `scheduledAt`, `scheduledStatus` (scheduled/queued/sent/failed), `scheduledBy`

### Group
- `name`, `description`, `groupPic`, `createdBy`
- `members[]` (with roles: admin/moderator/member, joinedAt)
- `isReadOnly`, `activeCall` (isActive, type, startedBy, participants)

---


## 12. REST API Endpoints

### Auth (`/api/auth`)
| Method | Path | Description |
|---|---|---|
| POST | `/signup` | Create account |
| POST | `/login` | Log in |
| POST | `/logout` | Log out |
| PUT | `/update-profile` | Update profile |
| GET | `/check` | Check auth status |

### Messages (`/api/messages`)
| Method | Path | Description |
|---|---|---|
| GET | `/users?search=` | Get contacts |
| GET | `/:id?limit=&skip=` | Get messages (paginated) |
| POST | `/send/:id` | Send message (text/image/images/voice/replyTo/isForwarded/isOneView/scheduledAt) |
| POST | `/disappearing/:id` | Set disappearing timer |
| POST | `/reaction/:id` | Toggle reaction |
| POST | `/action/:id` | Toggle favorite/archive |
| PUT | `/edit/:id` | Edit message |
| POST | `/block/:id` | Toggle block |
| POST | `/call-log` | Create call log |
| PUT | `/pin/:id` | Toggle pin |
| POST | `/wallpaper/:id` | Set chat wallpaper |
| POST | `/view-once/:id` | Mark view-once message as viewed |
| POST | `/delete-bulk` | Bulk delete messages |
| DELETE | `/:id` | Delete message (me/everyone) |
| DELETE | `/clear/:id` | Clear chat history |
| POST | `/schedule/cancel/:id` | Cancel scheduled message |

### Groups (`/api/groups`)
| Method | Path | Description |
|---|---|---|
| POST | `/` | Create group |
| GET | `/` | Get user groups |
| GET | `/:groupId` | Get group details |
| PUT | `/:groupId` | Update group |
| POST | `/:groupId/members` | Add members |
| DELETE | `/:groupId/members/:memberId` | Remove member/leave |
| PUT | `/:groupId/roles` | Update member role |
| GET | `/:groupId/messages` | Get group messages |
| POST | `/:groupId/send` | Send group message |

---

## 13. Background Jobs

| Job | Description |
|---|---|
| **Scheduled Message Dispatcher** | Polls every 10 seconds for due scheduled messages and delivers them via Socket.IO |

---

## 14. Tech Stack

### Backend
- Node.js + Express 5
- MongoDB + Mongoose
- Socket.IO (websocket transport)
- JWT (jsonwebtoken)
- bcryptjs
- Cloudinary
- Helmet (security headers)
- sanitize-html
- cookie-parser, cors, dotenv, nodemon

### Frontend
- React 19 + Vite 7
- React Router DOM 7
- Zustand 5 (state management)
- Axios
- Socket.IO-client
- TailwindCSS 3 + DaisyUI 5
- Lucide-react (icons)
- React-hot-toast
- Native WebRTC APIs
- MediaRecorder API