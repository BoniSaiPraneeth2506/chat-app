# Chatty — Real-Time MERN Chat Application

A full-featured, WhatsApp-style real-time chat application built with **MongoDB, Express, React, and Node.js (MERN)**, using **Socket.IO** for real-time communication, **Cloudflare R2 / Cloudinary** for media storage, and **Capacitor** for native Android.

---

## Table of Contents

1. [Overview](#1-overview)
2. [Tech Stack](#2-tech-stack)
3. [Project Structure](#3-project-structure)
4. [Architecture](#4-architecture)
5. [Feature Set](#5-feature-set)
6. [Data Models](#6-data-models)
7. [REST API Reference](#7-rest-api-reference)
8. [Real-Time Events (Socket.IO)](#8-real-time-events-socketio)
9. [Frontend State Management (Zustand Stores)](#9-frontend-state-management-zustand-stores)
10. [Frontend Pages & Components](#10-frontend-pages--components)
11. [Frontend Utilities & Libraries](#11-frontend-utilities--libraries)
12. [Authentication & Security](#12-authentication--security)
13. [Environment Variables](#13-environment-variables)
14. [Setup & Installation](#14-setup--installation)
15. [Build & Deployment](#15-build--deployment)
16. [Known Issues / Notes](#16-known-issues--notes)
17. [Mobile App (Capacitor / Android)](#17-mobile-app-capacitor--android)

---

## 1. Overview

**Chatty** is a WhatsApp-inspired real-time messaging application supporting one-to-one and group chats, voice/video calling (WebRTC), scheduled and disappearing messages, polls, voice transcription, GIPHY integration, linked contact cards, chat lock (password/biometric), multi-account switching, and an offline-first IndexedDB cache. It runs as both a web SPA and a native Android app via Capacitor.

The repository is a monorepo with two main folders:
- `backend/` — Express REST API + Socket.IO server
- `frontend/` — React (Vite) single-page application + Capacitor Android project

A root `package.json` provides convenience scripts to install both apps and build the frontend for production serving via the backend.

---

## 2. Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express 5 | HTTP server & REST API |
| MongoDB + Mongoose | Database & ODM |
| Socket.IO | Real-time bi-directional communication (messaging, calls, presence, groups) |
| JWT (`jsonwebtoken`) | Stateless authentication with device session tracking |
| bcryptjs | Password hashing |
| Cloudinary | Profile pictures, chat images, voice notes |
| Cloudflare R2 | Large file attachments (video, documents) via presigned URLs |
| Helmet | HTTP security headers (CSP, etc.) |
| sanitize-html | HTML/JS stripping from message text |
| cookie-parser | Reading JWT from HTTP-only cookies |
| cors | Cross-origin request handling |
| dotenv | Environment variable loading |
| nodemon | Dev-time auto-restart |
| AssemblyAI | Voice note transcription (optional) |
| GIPHY API | GIF/sticker search proxy (optional) |
| Brevo / Resend / SMTP | Password-reset email delivery (cascading fallback) |

### Frontend
| Technology | Purpose |
|---|---|
| React 19 | UI library |
| Vite 7 | Build tool / dev server |
| React Router DOM 7 | Client-side routing |
| Zustand 5 | Lightweight global state management |
| Axios | HTTP client (with JWT interceptor) |
| Socket.IO-client | Real-time client |
| TailwindCSS 3 + DaisyUI 5 | Styling & themed UI components |
| Lucide-react | Icon library |
| React-hot-toast | Toast notifications |
| Native WebRTC APIs | Peer-to-peer audio/video calling (1-on-1 and group mesh) |
| Dexie (IndexedDB) | Offline-first local message cache |
| qrcode / jsqr | QR code generation and scanning |
| react-oauth/google | Google Sign-In (web) |
| Capacitor 8 | Native Android wrapper |
| @capgo/capacitor-social-login | Native Android Google Sign-In |
| @aparajita/capacitor-biometric-auth | Fingerprint/face unlock for chat lock |
| @capawesome/capacitor-badge | Android launcher badge count |
| @capacitor/app | Android back button handling |
| @capacitor/filesystem | Native file save/share |
| @capacitor/share | Native share sheet |

---

## 3. Project Structure

```
chat-app/
├── package.json                  # Root scripts (build/start for combined deployment)
├── DOCUMENTATION.md
├── FEATURES.md
├── backend/
│   ├── index.js                  # App entry point (Express + Socket.IO + Helmet + CORS)
│   ├── controllers/
│   │   ├── auth.controller.js    # Signup, login, logout, Google auth, profile update,
│   │   │                         #   checkAuth, deleteAccount, forgotPassword, resetPassword,
│   │   │                         #   session management (list/revoke)
│   │   ├── message.controller.js # DMs: send, edit, delete, reactions, pin, block, call-log,
│   │   │                         #   wallpaper, view-once, bulk delete, transcript, scheduled,
│   │   │                         #   nickname, contact lookup, message info, export, shared media
│   │   ├── group.controller.js   # Groups: CRUD, members, roles, messages, polls, invites,
│   │   │                         #   welcome/rules, member notes
│   │   ├── upload.controller.js  # R2 presigned upload/download URLs (video, image, document)
│   │   ├── chatLock.controller.js # Chat lock: setup, unlock, password change, recovery, toggle
│   │   └── giphy.controller.js   # GIPHY search/trending proxy
│   ├── lib/
│   │   ├── db.js                 # MongoDB connection
│   │   ├── socket.js             # Socket.IO server, presence, signaling, group calls, blocking
│   │   ├── cloudinary.js         # Cloudinary SDK config
│   │   ├── origins.js            # CORS origin allowlist logic
│   │   ├── utils.js              # JWT helper (generateToken) with session ID
│   │   └── groupPermissions.js   # Group permission helpers (canDo, canManagePermissions, etc.)
│   ├── middlewares/
│   │   └── auth.middleware.js    # protectRoute — JWT verification + session validation
│   ├── models/
│   │   ├── user.model.js         # User schema (sessions, socialLinks, chatLock, nicknames, etc.)
│   │   └── message.model.js      # Message schema (attachments[], poll, transcript, isOneView, etc.)
│   │   (Group model is in models/group.model.js)
│   ├── routes/
│   │   ├── auth.route.js         # /api/auth/* (signup, login, google, sessions, chat-lock, etc.)
│   │   ├── message.route.js      # /api/messages/* (25+ endpoints)
│   │   ├── group.route.js        # /api/groups/* (18 endpoints)
│   │   ├── upload.route.js       # /api/uploads/* (limits, sign, url)
│   │   └── giphy.route.js        # /api/giphy/*
│   ├── jobs/
│   │   ├── scheduler.js          # Scheduled message dispatcher + media purge for expired messages
│   │   └── emailDigest.js        # Weekly summary and inactivity nudge emails
│   └── seeds/
│       ├── user.seed.js          # Seeds ~15 dummy users with @example.com emails
│       ├── insert_7_dummy.js     # Insert 3 additional dummy users
│       └── delete_dummy.js       # Delete all @example.com dummy users
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js / postcss.config.js
    ├── capacitor.config.json     # Capacitor config (com.chatapp.mobile, SocialLogin providers)
    ├── .env.production
    └── src/
        ├── main.jsx              # ReactDOM root + BrowserRouter
        ├── App.jsx               # Route table, theming, global modals, Capacitor back button,
        │                         #   account chooser, lightbox, keyboard shortcuts
        ├── index.css
        ├── constants/
        │   └── index.js          # THEME_COLORS (32 themes) + THEMES list
        ├── lib/
        │   ├── axios.js          # Pre-configured Axios instance (JWT header + session-revoked interceptor)
        │   ├── utils.js          # formatMessageTime, buildChatLink, buildInviteLink, parseChatLink
        │   ├── db.js             # Dexie IndexedDB cache (messages, conversationsMeta, outbox)
        │   ├── network.js        # isNetworkError, subscribeOnlineStatus
        │   ├── attachments.js    # File upload: sign, put-to-bucket, poster capture, local URLs
        │   ├── accounts.js       # Multi-account localStorage (remember/forget/switch)
        │   ├── badge.js          # Android launcher badge (Capacitor Badge plugin)
        │   ├── biometrics.js     # Fingerprint/face auth for chat lock (Capacitor BiometricAuth)
        │   ├── clipboard.js      # Copy text + multi-message clipboard formatting
        │   ├── contacts.js       # Private per-contact nicknames (displayNameOf, hasNickname)
        │   ├── download.js       # File save (web <a download> or native Filesystem + Share)
        │   ├── groupPermissions.js # Client-side mirror of group permission logic
        │   ├── haptics.js        # Haptic feedback patterns for touch devices
        │   ├── members.js        # Group member presentation (join dates, activity labels, filters)
        │   ├── secureScreen.js   # FLAG_SECURE for view-once media (Android native plugin)
        │   ├── social.js         # Social link definitions (GitHub, Twitter, LinkedIn, YouTube, Portfolio)
        │   └── attachments.js    # R2 presigned upload flow
        ├── store/
        │   ├── useAuthStore.js   # Auth state, socket connection, multi-account, session management
        │   ├── useChatStore.js   # DMs, messages, calling (WebRTC), reactions, forwarding, etc.
        │   ├── useGroupStore.js  # Groups, group messages, group calls (mesh WebRTC), polls
        │   ├── useThemeStore.js  # Theme, wallpaper, sound & privacy prefs (localStorage)
        │   └── useChatLockStore.js # Chat lock: unlock, setup, recovery, toggle
        ├── pages/
        │   ├── HomePage.jsx      # Main layout (SideBar + ChatContainer/NoChatSelected)
        │   ├── LoginPage.jsx     # Login form + Google Sign-In + native SocialLogin
        │   ├── SignUpPage.jsx    # Signup form + Google Sign-In + native SocialLogin
        │   ├── SettingsPage.jsx  # Theme picker, wallpaper picker, sound/privacy toggles
        │   ├── ProfilePage.jsx   # Profile editor, QR code, social links, banner upload
        │   ├── LinkedDevicesPage.jsx  # Device session list + revoke
        │   ├── BlockedUsersPage.jsx   # Blocked users list + unblock
        │   ├── JoinGroupPage.jsx      # Group invite link handler
        │   └── AboutPage.jsx          # App info page
        └── components/
            ├── NavBar.jsx                # Top nav with settings/profile/linked-devices/about links
            ├── SideBar.jsx               # Contact list, search, filters, context menu, unread badges
            ├── ChatHeader.jsx            # Recipient info, call buttons, search, wallpaper, more menu
            ├── ChatContainer.jsx         # Message list, reactions, pinned banner, contact info panel
            ├── MessageInput.jsx          # Text/image/voice composer, typing indicator, reply/edit banners
            ├── MessageAttachment.jsx     # Renders file attachments (video, image, document) from R2
            ├── CallModal.jsx             # WebRTC 1-on-1 audio/video call UI
            ├── GroupCallModal.jsx        # Multi-peer group call UI (mesh WebRTC)
            ├── CreateGroupModal.jsx      # Create group: name, description, pic, members
            ├── GroupDetailsModal.jsx     # Group info, members, settings, polls, invite links
            ├── GroupMemberSheet.jsx      # Full member list with search/filter
            ├── GroupWelcomeSheet.jsx     # Welcome/rules shown once per member
            ├── LockedChatsModal.jsx      # Locked chats: password gate, locked conversation list
            ├── ChatLockSettings.jsx      # Enable/disable/change password/recover chat lock
            ├── LockPasswordPrompt.jsx    # Password entry prompt for chat lock
            ├── ForwardModal.jsx          # Forward message(s) to contacts
            ├── MessageInfoSheet.jsx      # Per-message read receipt / delivery info
            ├── MediaGallerySheet.jsx     # Shared media grid for a conversation
            ├── ImageEditorModal.jsx      # Crop/annotate image before sending
            ├── AttachMenu.jsx            # Attachment type picker (image, video, document, GIF, poll)
            ├── GifPicker.jsx             # GIPHY GIF/sticker search and selection
            ├── PollMessage.jsx           # Renders poll messages (vote, close, results)
            ├── CreatePollModal.jsx       # Create poll: question, options (2-12)
            ├── VoiceNote.jsx             # Voice message player with waveform
            ├── VoiceTranscript.jsx       # Displays AssemblyAI transcription for voice notes
            ├── SchedulePicker.jsx        # Date/time picker for scheduled messages
            ├── ProfileQrCard.jsx         # QR code card for profile/chat link sharing
            ├── QrScannerModal.jsx        # Camera QR scanner for chat links
            ├── ContactPickerSheet.jsx    # Contact selection sheet (for forwarding, sharing)
            ├── SocialLinksRow.jsx        # Renders social link icons for a user
            ├── OfflineBanner.jsx         # "You're offline" banner
            ├── NoChatSelected.jsx        # Placeholder/welcome screen
            ├── AuthImagePattern.jsx      # Decorative side panel for login/signup
            └── skeletons/
                ├── SidebarSkeleton.jsx
                └── MessageSkeleton.jsx
```

---

## 4. Architecture

```
┌─────────────────┐        HTTPS/REST (JWT via cookie or Bearer)      ┌───────────────────────┐
│                 │ ───────────────────────────────────────────────▶ │                       │
│  React Frontend │                                                   │   Express REST API    │
│   (Vite SPA)    │ ◀─────────────────────────────────────────────── │  (auth + messages +   │
│                 │                                                   │   groups + uploads)   │
│                 │        WebSocket (Socket.IO, transport=websocket) │                       │
│                 │ ◀───────────────────────────────────────────────▶│   Socket.IO Server     │
└─────────────────┘        (messages, presence, typing, calls,       └──────────┬────────────┘
                            group events, read receipts)                        │
                                                                         Mongoose ODM
                                                                               │
                                                                         ┌─────▼──────┐
                                                                         │  MongoDB   │
                                                                         │(Users,Msgs,│
                                                                         │  Groups)   │
                                                                         └────────────┘
Media Upload:
  Cloudinary ← profile pics, chat images, voice notes
  Cloudflare R2 ← large file attachments (video, documents) via presigned PUT URLs
```

- `backend/lib/socket.js` creates its own `http.createServer(app)` and Socket.IO instance; `backend/index.js` imports `{ app, server }` from it and mounts REST routes onto the same Express `app`, then calls `server.listen()`. One HTTP server handles both REST and WebSocket.
- In production, the Express app serves the built frontend (`frontend/dist`) as static files and handles SPA fallback routing (`app.get("/{*splat}", ...)`).
- WebRTC signaling (`offer`/`answer`/ICE candidates) is relayed through Socket.IO events; actual media flows directly between browsers (or via STUN/TURN for NAT traversal).
- **Multi-device support**: `userSocketMap` is `userId -> Set<socketId>`. `getReceiverSocketId` returns a room name (`user_<id>`) that fans out to all of a user's connected devices.
- **Group calls** use a mesh WebRTC topology: each participant connects to every other, with signaling relayed through Socket.IO group call rooms (`group_call_<id>`).
- **File attachments** use a three-step flow: server signs a presigned PUT URL → browser uploads directly to R2 → message is sent with attachment metadata only.

---

## 5. Feature Set

### Authentication & Account Management
- Email/password signup & login with bcrypt hashing
- Google Sign-In (web via `@react-oauth/google`, Android via `@capgo/capacitor-social-login` native Credential Manager)
- JWT stored in HTTP-only cookie + localStorage fallback (`Authorization: Bearer` header)
- **Device session tracking**: each login creates a session with IP, user-agent, device info; sessions are listed, individually revocable, and revoking from another device kicks the session live via socket
- **Multi-account switching**: up to 5 accounts saved on a device; switch without re-entering password; account chooser on logout
- **Password reset**: 6-digit OTP sent via Brevo HTTPS API → Resend HTTPS API → SMTP fallback → dev console log
- **Account deletion**: requires password or typed "DELETE" confirmation; cleans up sent messages, media, groups, blocked lists, nicknames

### 1-on-1 Messaging
- Real-time text delivery via Socket.IO with optimistic UI
- **Image messages**: single or up to 5 per message (grid layout), client-side canvas compression before upload
- **Voice messages**: recorded via `MediaRecorder`, uploaded to Cloudinary, with optional AssemblyAI transcription
- **File attachments**: video, images, documents uploaded to Cloudflare R2 via presigned URLs with progress tracking and cancel support
- **Linked contact cards**: share a user's profile as a tappable card
- Message replies (quote with click-to-scroll)
- Message editing (within 15 minutes, shows "edited" indicator)
- Message deletion ("Delete for me" / "Delete for everyone")
- **Bulk message deletion**: selection mode with checkboxes
- **Message forwarding**: single or multi-select forward to multiple contacts with "Forwarded" flag
- **Message reactions**: emoji picker (👍❤️😂😮😢🙏), one per user, toggle by re-clicking, double-click ❤️
- **Message pinning**: one pinned message per conversation, sticky banner, auto-unpins previous
- **Disappearing messages**: off / 1h / 24h / 7d via MongoDB TTL index (`deleteAt`, `expires: 600`); media purged by background job
- **View-once messages**: self-destructing photos with "Opened" state, viewed tracking, `FLAG_SECURE` screenshot blocking on Android
- **Scheduled messages**: schedule for future delivery, background scheduler polls every 10s, cancel pending
- **Message drafts**: per-conversation auto-save/restore
- **Link previews**: rich preview cards via microlink.io, YouTube embeds, direct video playback
- In-chat message search with yellow highlight
- Infinite scroll / paginated message loading (20 per page, `limit` & `skip`)
- Jump-to-message by date (calendar view)
- Date separators (Today / Yesterday / Weekday / Full date)
- **Personal Notes**: self-chat for notes/drafts/links
- Typing indicators (real-time, 1.5s debounce)
- Read receipts (single/double checkmarks, blue ticks, privacy toggle)
- Call log messages (completed/missed/declined with duration)
- **Private contact nicknames**: rename contacts for yourself only, synced across devices

### Group Chats
- Create groups with name, description, group picture (Cloudinary)
- **Group roles**: Admin, Moderator, Member
- **Configurable permissions**: sendMessages, addMembers, editInfo, startCalls — each set to "everyone" or "admins"
- Read-only mode (admin/moderator only can send)
- Add/remove members, promote/demote roles
- Group typing indicators
- **Group polls**: create polls (2-12 options), vote, close, results display
- **Anonymous questions**: post as anonymous in groups that allow it
- **@mentions**: notify mentioned members, surface unread groups where you're mentioned
- **Invite links**: generate/revoke shareable invite codes, preview before joining
- **Welcome message & rules**: shown once per member, dismissible
- **Member notes**: private notes about other group members (max 500 chars)
- Group call logs
- Group message search, infinite scroll, date separators

### Calling (WebRTC)

#### 1-on-1 Calls
- Voice and video calling via native `RTCPeerConnection`
- Signaling relayed through Socket.IO (`offer`/`answer`/ICE candidates)
- STUN/TURN servers: Google STUN + Metered.ca open relay TURN
- **Screen sharing**: `getDisplayMedia` → `replaceTrack` (video calls only, not on Android)
- Call states: ringing, incoming, connected, ended
- Minimizable/maximizable call UI overlay
- Auto-downgrade to audio-only if camera busy
- Call logs saved to chat history

#### Group Calls (Mesh WebRTC)
- Multi-peer voice/video calls
- Signaling via Socket.IO (`startGroupCall`, `joinGroupCall`, `sendGroupSignal`, `leaveGroupCall`)
- **Raise hand**: toggle flag, broadcast to all participants
- **Mute all**: host can request everyone to mute (each client mutes itself)
- Host can end call for everyone
- Call duration tracking and call log messages
- Permission-gated: `startCalls` permission controls who can initiate

### Contact Management
- User search (server-side, regex with escaping)
- **Favorites**: star contacts (server-synced via `toggleContactAction`)
- **Archive chats**: archive/unarchive (server-synced)
- **Pin chats**: pin up to 2 to top (server-synced)
- Block / unblock users (server-side, enforced on message delivery AND socket relay)
- Right-click / long-press context menu for contact quick actions
- Filter chips: All / Groups / Unread / Favorites / Online
- Clear chat history (soft-delete per-user via `deletedFor` array)
- **QR code profile/chat-link sharing** (`/chat-with/:userId` deep link)
- **QR code scanner**: scan chat links from camera
- Online status with green dot, last-seen timestamp tracking
- Unread badges per contact

### Chat Lock
- Password-protected hidden conversations (DMs and groups)
- Setup with password + security question for recovery
- Unlock with password or **biometric authentication** (fingerprint/face on Android)
- Toggle individual chats in/out of the locked set
- Locked conversations hidden from sidebar until unlocked
- Change password, recover via security question, disable entirely

### Customization
- **32 color themes** (light, dark, cupcake, bumblebee, emerald, corporate, synthwave, retro, cyberpunk, valentine, halloween, garden, forest, aqua, lofi, pastel, fantasy, wireframe, black, luxury, dracula, cmyk, autumn, business, acid, lemonade, night, coffee, winter, dim, nord, sunset) with live CSS variable injection
- **Chat wallpapers** per-conversation (color/gradient presets or custom uploaded image with adjustable dim/brightness level), synced to both participants in real-time
- Notification sound toggle
- Profile customization: full name, email, bio, website link, social links (GitHub, Twitter, LinkedIn, YouTube, Portfolio), profile picture, banner/cover image

### Offline Support
- **IndexedDB cache** via Dexie: messages, sidebar previews, conversation metadata
- Cache-first rendering: conversations paint instantly from last sync while network confirms
- **Outbox queue**: messages composed while offline are queued and auto-sent on reconnect
- Per-user cache isolation: each account keeps its own Dexie database (`chatty_cache_<userId>`)
- Cache wiped on logout for shared device safety
- **Offline banner** shown when network is unreachable
- Periodic re-probe: polls `checkAuth` every 10s while offline

### Background Jobs
- **Scheduled message dispatcher**: polls every 10s for due scheduled messages, delivers via Socket.IO
- **Media purge**: polls every 20s for expired disappearing messages, frees Cloudinary/R2 assets before DB deletion (batch of 200)
- **Email digest**: weekly summary + inactivity nudge, allowlisted to named email addresses

---

## 6. Data Models

### `User` (backend/models/user.model.js)

| Field | Type | Notes |
|---|---|---|
| fullName | String | required |
| email | String | required, unique |
| password | String | hashed (bcrypt), minlength 6 — optional for Google-only accounts |
| googleId | String | unique, sparse — present only for Google-signed-in accounts |
| profilePic | String | Cloudinary URL |
| bannerCover | String | Profile banner image URL |
| bio | String | |
| link | String | Personal website/social link |
| socialLinks | `{ github, twitter, linkedin, youtube, portfolio }` | Social profile URLs |
| onlinePrivacy | Boolean | default true — hides online status |
| typingPrivacy | Boolean | default true — hides typing indicator |
| disappearingTimers | Map\<String, String\> | Per-conversation timer ("off"/"1h"/"24h"/"7d"), keyed by other user's ID |
| lastSeen | Date | Updated on socket disconnect |
| contactNicknames | Map\<String, String\> | Private per-contact renames, keyed by contact user ID |
| lastReadAt | Map\<String, Date\> | Per-conversation read timestamp |
| favorites | [ObjectId ref User] | Server-synced favorite contacts |
| archived | [ObjectId ref User] | Server-synced archived chats |
| pinnedChats | [ObjectId ref User] | Server-synced pinned chats (max 2) |
| favoriteGroups | [ObjectId ref Group] | Server-synced favorite groups |
| archivedGroups | [ObjectId ref Group] | Server-synced archived groups |
| pinnedGroups | [ObjectId ref Group] | Server-synced pinned groups |
| memberNotes | Map\<String, String\> | Private notes about group members |
| chatLock | `{ enabled, passwordHash, securityQuestion, securityAnswerHash, updatedAt }` | Chat lock configuration |
| lockedChats | [ObjectId ref User] | Users hidden behind chat lock |
| lockedGroups | [ObjectId ref Group] | Groups hidden behind chat lock |
| clearedChats | [ObjectId ref User] | Deleted DM conversation markers |
| blockedUsers | [ObjectId ref User] | Users this account has blocked |
| chatWallpapers | Map\<String, String\> | Per-conversation wallpaper, keyed by other user's ID |
| resetPasswordOtp | String | Hashed OTP for password reset |
| resetPasswordExpires | Date | OTP expiry |
| lastDigestAt | Date | Last email digest sent |
| lastNudgeAt | Date | Last inactivity nudge sent |
| sessions | [sessionSchema] | Device sessions: `{ sid, ip, userAgent, browser, os, device, createdAt, lastActive }` |
| timestamps | createdAt / updatedAt | auto |

### `Message` (backend/models/message.model.js)

| Field | Type | Notes |
|---|---|---|
| senderId | ObjectId (ref User) | required |
| receiverId | ObjectId (ref User) | null for group messages |
| groupId | ObjectId (ref Group) | null for DMs |
| text | String | Sanitized (sanitize-html) |
| image | String | Cloudinary URL (single image) |
| images | [String] | Cloudinary URLs (multi-image, up to 5) |
| voice | String | Cloudinary URL (audio, uploaded as `resource_type: video`) |
| attachments | [attachmentSchema] | R2 files: `{ kind, key, url, name, mime, size, duration, width, height, posterUrl }` |
| contact | `{ user, name, email, profilePic }` | Shared contact card |
| isEdited | Boolean | default false |
| isCallLog | Boolean | default false — marks a call-summary message |
| callType | String | "voice" \| "video" |
| callDuration | Number | seconds |
| callStatus | String | "completed" \| "missed" \| "declined" |
| deleteAt | Date | TTL index (`expires: 600`) — disappearing message expiry |
| replyTo | ObjectId (ref Message) | nullable, populated on fetch |
| reactions | [{ userId, emoji }] | One entry per reacting user |
| deletedFor | [ObjectId (ref User)] | Soft-delete list ("delete for me") |
| isDeletedForEveryone | Boolean | default false |
| isPinned | Boolean | default false — only one true per conversation at a time |
| mentions | [ObjectId (ref User)] | @mentioned users (group messages) |
| voiceTranscript | String | Client-side captured transcript |
| transcript | `{ text, status, language, assemblyTranscriptId, error, requestedAt }` | AssemblyAI transcription result |
| isForwarded | Boolean | "Forwarded" flag |
| isAnonymous | Boolean | Anonymous group question |
| isOneView | Boolean | View-once self-destructing media |
| viewedBy | [ObjectId (ref User)] | Users who viewed a one-view message |
| scheduledAt | Date | Future delivery time |
| scheduledStatus | String enum | "scheduled" \| "queued" \| "sent" \| "failed" |
| scheduledBy | ObjectId (ref User) | User who scheduled it |
| poll | pollSchema | `{ question, options: [{ text, votes: [userId] }], allowMultiple, isClosed }` |
| timestamps | createdAt / updatedAt | auto |

### Group (backend/models/group.model.js)

| Field | Type | Notes |
|---|---|---|
| name | String | required |
| description | String | |
| groupPic | String | Cloudinary URL |
| createdBy | ObjectId (ref User) | |
| members | [{ user, role, joinedAt }] | role: "admin" \| "moderator" \| "member" |
| isReadOnly | Boolean | legacy read-only flag |
| permissions | `{ sendMessages, addMembers, editInfo, startCalls }` | "everyone" \| "admins" per action |
| activeCall | `{ isActive, type, startedBy, participants }` | Runtime call state |
| inviteCode | String | Shareable invite code |
| welcomeMessage | String | Shown once per new member |
| rules | String | Shown once per new member |
| welcomeSeenBy | [ObjectId] | Members who dismissed the welcome sheet |
| allowAnonymousQuestions | Boolean | |
| timestamps | createdAt / updatedAt | auto |

---

## 7. REST API Reference

Base URL: `/api` (e.g., `http://localhost:5001/api`)

### Auth Routes — `/api/auth` (`backend/routes/auth.route.js`)

| Method | Path | Auth? | Description |
|---|---|---|---|
| POST | `/signup` | No | Create account. Body: `{ fullName, email, password }`. Returns user + JWT. |
| POST | `/login` | No | Log in. Body: `{ email, password }`. Returns user + JWT. |
| POST | `/google` | No | Google Sign-In. Body: `{ idToken }`. Verifies token, finds-or-links-or-creates account. |
| POST | `/logout` | No | Clears JWT cookie, removes current session from user. |
| POST | `/forgot-password` | No | Body: `{ email }`. Sends 6-digit OTP via Brevo → Resend → SMTP. Dev mode returns OTP. |
| POST | `/reset-password` | No | Body: `{ email, otp, newPassword }`. Validates OTP, updates password. |
| PUT | `/update-profile` | Yes | Update fullName, email, bio, link, socialLinks, profilePic, bannerPic, onlinePrivacy, typingPrivacy, messageTimer. Images uploaded to Cloudinary. |
| GET | `/check` | Yes | Returns currently authenticated user. |
| DELETE | `/account` | Yes | Delete account. Body: `{ password }` or `{ confirm: "DELETE" }`. Cleans up messages, media, groups, blocks, nicknames. |
| GET | `/sessions` | Yes | Lists all device sessions with `isCurrent` flag. |
| POST | `/sessions/logout-others` | Yes | Revokes all sessions except the current one. |
| DELETE | `/sessions/:sid` | Yes | Revokes a specific device session by session ID. |
| GET | `/chat-lock` | Yes | Returns chat lock status (enabled, securityQuestion, lockedChats, lockedGroups). |
| POST | `/chat-lock/setup` | Yes | Enable chat lock. Body: `{ password, securityQuestion, securityAnswer }`. |
| POST | `/chat-lock/unlock` | Yes | Verify password, returns locked DMs and groups with previews. |
| POST | `/chat-lock/password` | Yes | Change lock password. Body: `{ currentPassword, newPassword }`. |
| POST | `/chat-lock/recover` | Yes | Reset via security answer. Body: `{ securityAnswer, newPassword }`. |
| POST | `/chat-lock/disable` | Yes | Disable lock. Body: `{ password }`. |
| POST | `/chat-lock/toggle/:id` | Yes | Add/remove a conversation from the lock. Body: `{ type: "user" \| "group" }`. |

### Message Routes — `/api/messages` (`backend/routes/message.route.js`)

| Method | Path | Description |
|---|---|---|
| GET | `/users` | List sidebar contacts. Supports `?search=<name>`. Returns chatted users + seed users, with unread counts, latest messages, read ticks. Excludes locked/cleared chats. |
| GET | `/blocked` | Returns populated list of blocked users. |
| GET | `/export/:id` | Export entire conversation with user `:id` as JSON. |
| GET | `/info/:id` | Per-message delivery/read info. |
| GET | `/contact/:id` | Single contact lookup by id (for QR deep links). |
| GET | `/media/:id` | Shared media list for conversation with user `:id`. |
| GET | `/dates/:id` | Days with messages for the chat calendar. Accepts `?tz=` offset. |
| GET | `/:id` | Get messages with user `:id`. Supports `?limit=&skip=` pagination, `?around=<messageId>` window. Response header `X-Pinned-Message` has pinned message. |
| POST | `/send/:id` | Send DM. Body: `{ text?, image?, images?, voice?, attachments?, replyTo?, isForwarded?, isOneView?, scheduledAt?, clientId?, contact? }`. Validates blocks, uploads media, sets `deleteAt`, emits `newMessage`. |
| POST | `/disappearing/:id` | Set disappearing timer. Body: `{ timer }` ("off"/"1h"/"24h"/"7d"). Updates both users, emits `disappearingTimerUpdate`. |
| POST | `/reaction/:id` | Toggle emoji reaction. Body: `{ emoji }`. Emits `messageReaction`. |
| POST | `/action/:id` | Toggle favorite/archive/pin. Body: `{ action, scope }`. Enforces max 2 pins. Emits `accountListsUpdated`. |
| PUT | `/edit/:id` | Edit message text (sender only, within 15 min). Body: `{ text }`. Emits `messageEdited`. |
| POST | `/block/:id` | Toggle block status. Returns `{ user, blockedUsers, isBlocked }`. |
| POST | `/call-log` | Persist call summary. Body: `{ receiverId, callType, callDuration, callStatus }`. |
| PUT | `/pin/:id` | Toggle pin (auto-unpins previous). Emits `messagePinned`. |
| POST | `/wallpaper/:id` | Set shared wallpaper. Body: `{ wallpaper }`. Uploads base64 to Cloudinary if needed. Emits `chatWallpaperUpdate`. |
| POST | `/view-once/:id` | Mark one-view message as viewed. Emits `messageViewed`. |
| POST | `/:id/transcribe` | Request AssemblyAI transcription. Atomic claim prevents double-billing. |
| POST | `/delete-bulk` | Bulk delete. Body: `{ messageIds, type }` ("me" or "everyone"). |
| DELETE | `/:id` | Delete message. Body: `{ type }` ("me" or "everyone"). |
| DELETE | `/clear/:id` | Clear entire chat history (adds to `deletedFor` on all matching messages). |
| POST | `/schedule/cancel/:id` | Cancel a pending scheduled message. |
| POST | `/nickname/:id` | Set private nickname for a contact. Body: `{ nickname }`. |

### Group Routes — `/api/groups` (`backend/routes/group.route.js`)

| Method | Path | Description |
|---|---|---|
| POST | `/` | Create group. Body: `{ name, description?, groupPic?, members }`. Creator becomes admin. |
| GET | `/` | List user's groups with last message previews. Excludes locked groups. |
| GET | `/invite/:code` | Public preview of group invite (name, description, pic, member count). |
| POST | `/invite/:code/join` | Join group via invite code. |
| GET | `/:groupId` | Full group details with populated members. |
| PUT | `/:groupId` | Update group (name, description, groupPic, isReadOnly, permissions, welcomeMessage, rules, allowAnonymousQuestions). |
| POST | `/:groupId/members` | Add members. Body: `{ members: [userId] }`. |
| POST | `/:groupId/invite` | Generate invite code. |
| DELETE | `/:groupId/invite` | Revoke invite code. |
| DELETE | `/:groupId/members/:memberId` | Remove member or self-leave. |
| PUT | `/:groupId/roles` | Update member role. Body: `{ memberId, role }`. |
| GET | `/:groupId/messages` | Paginated group messages. Supports `limit`, `skip`, `around`. |
| POST | `/:groupId/welcome-seen` | Mark welcome/rules as seen by current user. |
| POST | `/:groupId/members/:memberId/note` | Set private note about a member. Body: `{ note }`. |
| POST | `/:groupId/send` | Send group message. Body: `{ text?, image?, images?, voice?, attachments?, replyTo?, clientId?, isAnonymous?, mentions? }`. |
| POST | `/:groupId/polls` | Create poll. Body: `{ question, options, allowMultiple? }`. 2-12 options. |
| POST | `/:groupId/polls/:messageId/vote` | Vote on poll. Body: `{ optionIndex }`. Toggles vote. |
| POST | `/:groupId/polls/:messageId/close` | Close poll (creator, admin, or moderator). |

### Upload Routes — `/api/uploads` (`backend/routes/upload.route.js`)

| Method | Path | Description |
|---|---|---|
| GET | `/limits` | Returns attachment rules (maxBytes, types, label per kind). |
| POST | `/sign` | Validates file, returns presigned PUT URL for R2. Body: `{ kind, mime, size, fileName }`. |
| GET | `/url` | Returns signed GET URL for an attachment. Params: `messageId`, `key`. |

### GIPHY Routes — `/api/giphy` (`backend/routes/giphy.route.js`)

| Method | Path | Description |
|---|---|---|
| GET | `/` | Search/trending GIPHY. Params: `?q=<query>` or `?type=stickers`. Returns 503 if not configured. |

---

## 8. Real-Time Events (Socket.IO)

Socket connection URL: same origin as backend, established with `auth: { token }` and `transports: ["websocket"]`.

### Client → Server

| Event | Payload | Purpose |
|---|---|---|
| `markAsRead` | `{ senderId, receiverId }` | Read receipt — receiverId must match authenticated user |
| `markGroupAsRead` | `{ groupId }` | Record that group was read (updates `lastReadAt`) |
| `typing` | `{ receiverId, isTyping }` | Typing indicator (suppressed if `typingPrivacy` is off) |
| `callUser` | `{ userToCall, signalData, from, type }` | Initiate 1-on-1 WebRTC call (from must match auth user) |
| `answerCall` | `{ signal, to }` | Answer a 1-on-1 call |
| `endCall` | `{ to }` | Terminate 1-on-1 call |
| `iceCandidate` | `{ candidate, to }` | Relay ICE candidates |
| `joinGroupRoom` | `groupId` | Join Socket.IO room `group_<id>` |
| `leaveGroupRoom` | `groupId` | Leave group room |
| `groupTyping` | `{ groupId, isTyping }` | Group typing indicator |
| `startGroupCall` | `{ groupId, type, groupName }` | Start group call (permission-checked) |
| `joinGroupCall` | `{ groupId, user }` | Join group call room `group_call_<id>` |
| `sendGroupSignal` | `{ toSocketId, signal, fromUser }` | Relay group call WebRTC signal |
| `endGroupCall` | `{ groupId }` | Host ends group call for everyone |
| `leaveGroupCall` | `{ groupId }` | Leave group call |
| `groupRaiseHand` | `{ groupId, raised }` | Toggle raise hand in group call |
| `groupMuteAll` | `{ groupId }` | Host requests all participants to mute |

### Server → Client

| Event | Payload | Purpose |
|---|---|---|
| `getOnlineUsers` | `string[]` (user IDs) | Broadcast online users (respects `onlinePrivacy`) |
| `newMessage` | `Message` | New DM delivered in real time |
| `messagesRead` | `{ userId, readAt }` | Sender's messages were read (readAt is server timestamp) |
| `disappearingTimerUpdate` | `{ userId, timer }` | Timer changed by other party |
| `userOffline` | `{ userId, lastSeen }` | User went offline |
| `typing` | `{ senderId, isTyping }` | Relayed typing indicator |
| `messageReaction` | `{ messageId, reactions }` | Reaction updated |
| `messageDeleted` | `{ messageId, isDeletedForEveryone }` | Message deleted |
| `messageEdited` | `Message` | Message content edited |
| `messagePinned` | `Message` | Pin state changed |
| `messageTranscript` | `{ messageId, transcript }` | Voice note transcription result |
| `messageViewed` | `{ messageId, viewedBy }` | View-once message was viewed |
| `chatWallpaperUpdate` | `{ updatedBy, wallpaper }` | Wallpaper changed |
| `accountListsUpdated` | `{ favorites, archived, pinnedChats, lockedChats, ... }` | Cross-device sync of lists |
| `sessionRevoked` | — | This device's session was revoked elsewhere |
| `callUser` | `{ signal, from, type }` | Incoming 1-on-1 call |
| `callAccepted` | `{ signal }` | Call accepted |
| `callEnded` | — | Call ended |
| `callFailed` | `{ reason }` | Call could not reach recipient |
| `iceCandidate` | `{ candidate }` | Relayed ICE candidate |
| `newGroupMessage` | `Message` | New group message |
| `groupCreated` | `Group` | New group created |
| `groupUpdated` | `Group` | Group settings changed |
| `groupTyping` | `{ groupId, userId, isTyping }` | Group typing indicator |
| `groupMessageReaction` | `{ messageId, reactions }` | Group message reaction |
| `groupMessageEdited` | `Message` | Group message edited |
| `removedFromGroup` | `{ groupId }` | You were removed from a group |
| `groupCallStarted` | `{ groupId, type, groupName, startedBy }` | Group call started |
| `allGroupCallParticipants` | `[{ socketId, userId }]` | Existing call participants (sent to joiner) |
| `groupCallUserJoined` | `{ socketId, user }` | New peer joined group call |
| `groupCallSignalReceived` | `{ fromSocketId, signal, fromUser }` | WebRTC signal from another peer |
| `groupUserLeftCall` | `{ socketId, userId }` | Peer left group call |
| `groupCallEnded` | `{ groupId, duration, endedBy, startedBy, type }` | Group call ended |
| `groupHandRaised` | `{ userId, socketId, raised }` | Raise/lower hand in call |
| `groupMuteAllRequested` | `{ by }` | Host requested all to mute |
| `rateLimited` | `{ action, message }` | Socket action was throttled |

---

## 9. Frontend State Management (Zustand Stores)

### `useAuthStore` (`frontend/src/store/useAuthStore.js`)
Manages authentication state, socket connection, multi-account, and session lifecycle.
- **State**: `authUser`, `isSigningUp`, `isLoggingIn`, `isUpdatingProfile`, `isCheckingAuth`, `isOffline`, `onlineUsers`, `socket`, `sessions`, `savedAccounts`, `accountChooserOpen`, `switchingTo`
- **Actions**: `checkAuth`, `signUp`, `login`, `loginWithGoogle`, `logOut`, `updateProfile`, `deleteAccount`, `forgotPassword`, `resetPassword`, `connectSocket`, `disconnectSocket`, `getSessions`, `revokeSession`, `revokeOtherSessions`, `switchAccount`, `forgetSavedAccount`
- On successful auth, stores JWT in localStorage, opens Socket.IO connection.
- On connect, flushes outbox (offline-queued messages).
- `subscribeOnlineStatus` keeps `isOffline` in sync; periodic 10s re-probe while offline.

### `useChatStore` (`frontend/src/store/useChatStore.js`) — ~2088 lines
The largest store — manages DMs, messages, calling, reactions, forwarding, and chat UI state.
- **Core state**: `messages`, `users`, `selectedUser`, `latestMessages`, `unreadCounts`, `lastReadTimestamps`, `hasMoreMessages`, `pinnedMessage`
- **UI state**: `isRecipientProfileOpen`, `messageSearchQuery`, `replyingToMessage`, `editingMessage`, `forwardingMessage`, `showArchivedOnly`, `profilePreviewUser`, `lightboxImage`, `lightboxSecure`, `isSelectionMode`, `selectedMessageIds`, `drafts`, `isViewingHistory`, `pendingScrollId`
- **Calling state**: `callState`, `callType`, `callPartner`, `isCaller`, `isCallMinimized`, `localStream`, `remoteStream`, `peerConnection`, `incomingSignal`, `isScreenSharing`, `screenStream`
- **Key actions**: `getUsers`, `getMessages`, `loadMoreMessages`, `sendMessage`, `sendAttachmentMessage`, `sendMessageWithProgress`, `editMessage`, `deleteMessage`, `deleteMessagesBulk`, `clearChatHistory`, `toggleReaction`, `togglePinMessage`, `toggleBlockUser`, `toggleContactAction`, `setDisappearingTimer`, `sendTypingStatus`, `setConversationWallpaper`, `setContactNickname`, `forwardMessage`, `forwardMessages`, `startCall`, `acceptCall`, `rejectCall`, `endCall`, `startScreenShare`, `stopScreenShare`, `subscribeToMessages`, `unsubscribeFromMessages`, `flushOutbox`, `jumpToMessage`, `getMessageDates`, `viewOneViewMessage`, `requestTranscript`, `getMessageInfo`, `cancelScheduledMessage`

### `useGroupStore` (`frontend/src/store/useGroupStore.js`) — ~1094 lines
Groups, group messages, group calls, polls.
- **State**: `groups`, `selectedGroup`, `groupMessages`, `latestGroupMessages`, `unreadGroupCounts`, `mentionedGroups`, `groupTypingUsers`, `groupPreview`, modals, group call state (`activeGroupCall`, `groupRemoteStreams`, `raisedHands`, `peerConnectionsRef`)
- **Key actions**: `getGroups`, `getGroupMessages`, `sendGroupMessage`, `createGroup`, `updateGroup`, `addGroupMembers`, `removeGroupMember`, `updateMemberRole`, `createGroupPoll`, `voteGroupPoll`, `closeGroupPoll`, `createGroupInvite`, `revokeGroupInvite`, `joinGroupByInvite`, `startOrJoinGroupCall`, `endGroupCall`, `leaveGroupCall`, `toggleRaiseHand`, `muteAllParticipants`, `subscribeToGroupEvents`, `unsubscribeFromGroupEvents`, `flushOutbox`

### `useThemeStore` (`frontend/src/store/useThemeStore.js`)
Persists UI preferences to localStorage:
- `theme` (one of 32 named themes)
- `wallpaper` (chat background preset)
- `soundEnabled` (message notification sound)
- `privacyReadReceipts` (show/hide blue read ticks)

### `useChatLockStore` (`frontend/src/store/useChatLockStore.js`)
Chat lock session state (not persisted across reloads):
- **State**: `isModalOpen`, `view` ("locked"/"open"/"recover"), `isUnlocked`, `lockedUsers`, `lockedGroups`, `returnToLocked`
- **Actions**: `openModal`, `closeModal`, `unlock`, `setup`, `changePassword`, `recover`, `disable`, `toggleChat`, `releaseChat`, `enterLockedChat`, `resumeLockedList`

---

## 10. Frontend Pages & Components

### Pages
- **LoginPage / SignUpPage** — Auth forms with `AuthImagePattern` decorative panel, Google Sign-In button (hidden on native platform), native `SocialLogin` button for Android, forgot-password flow
- **HomePage** — Main chat layout combining `SideBar` + `ChatContainer`/`NoChatSelected`; manages mobile back-button behavior via `history.pushState`; handles locked chat return flow
- **SettingsPage** — Theme picker grid (32 themes), wallpaper picker, sound toggle, privacy toggles, live chat preview
- **ProfilePage** — Avatar upload, banner upload, editable profile fields, social links editor, online-privacy toggle, typing-privacy toggle, QR code deep-link sharing, chat lock settings
- **LinkedDevicesPage** — Device session list with IP, browser, OS, device info; revoke individual or all other sessions
- **BlockedUsersPage** — List of blocked users with unblock button
- **JoinGroupPage** — Handles `/join/:code` invite links, previews group, joins
- **AboutPage** — App info

### Key Components
- **NavBar** — Top navigation with links to Settings, Profile, Linked Devices, About, and Logout (with confirmation modal)
- **SideBar** — Contact list with search, filter chips (All/Groups/Unread/Favorites/Online), pinned/favorite/archived indicators, "Personal Notes" self-chat, group entries, right-click/long-press context menu, unread badges, draft indicator
- **ChatHeader** — Recipient info (avatar/name/online/last-seen/typing), voice/video call buttons, in-chat search, "more options" dropdown (wallpaper picker with custom upload + dim slider, block/unblock, shared media, chat lock toggle)
- **ChatContainer** — Scrollable message list with infinite-scroll-up pagination, pinned-message banner, per-message hover action bar (react/reply/forward/edit/pin/delete), reaction pills, call-log entries, date separators, recipient contact-info side panel, mention highlighting, message selection mode
- **MessageInput** — Text input, image picker (client-side canvas compression), voice recording (`MediaRecorder`), typing-indicator debounce, reply/edit banners, attachment menu (image/video/document/GIF/poll/contact), schedule picker, send button
- **MessageAttachment** — Renders file attachments: video player with poster, image viewer, document download button; uses presigned R2 URLs
- **CallModal** — Full-screen and minimized 1-on-1 WebRTC call UI (mute/camera toggle, ringtone, timer, PiP local video, screen share)
- **GroupCallModal** — Multi-peer group call UI with participant grid, raise hand, mute-all (host), end call (host), leave call
- **CreateGroupModal** — Group creation: name, description, picture, member picker
- **GroupDetailsModal** — Group info, member list, settings (permissions, read-only), polls, invite link management, welcome/rules editor
- **LockedChatsModal** — Password gate → locked conversation list → open locked chats; biometric prompt on Android
- **ForwardModal** — Multi-contact picker for forwarding messages
- **MessageInfoSheet** — Per-message delivery/read receipt details
- **MediaGallerySheet** — Grid of shared images/videos in a conversation
- **ImageEditorModal** — Pre-send image cropping and annotation
- **AttachMenu** — Bottom sheet: image, video, document, GIF, poll, contact card
- **GifPicker** — GIPHY search/browse for GIFs and stickers
- **PollMessage** — Renders poll with vote buttons, results bar, close button
- **CreatePollModal** — Create poll form: question, options (2-12), multiple-choice toggle
- **VoiceNote** — Audio player with waveform visualization for voice messages
- **VoiceTranscript** — Displays request/display transcript for voice notes
- **SchedulePicker** — Date/time picker for scheduling message delivery
- **ProfileQrCard** — QR code card for profile sharing
- **QrScannerModal** — Camera viewfinder for scanning chat link QR codes
- **NoChatSelected** — Placeholder/welcome screen
- **OfflineBanner** — Fixed banner when network is unreachable

### Global UI in `App.jsx`
- Route table (`/`, `/login`, `/signup`, `/settings`, `/profile`, `/linked-devices`, `/blocked`, `/about`, `/join/:code`, `/chat-with/:userId`, wildcard redirect)
- `LoginRoute` — Supports `?add=1` for adding a second account without logging out
- `ChatRedirectHandler` — Resolves `/chat-with/:userId` deep links into open conversations
- `PendingChatRedirect` — Remembers QR link target for post-login redirect
- Theme CSS variables applied to `:root` from `THEME_COLORS`
- Global modals: profile picture preview popup, group avatar preview popup, full-screen image lightbox, account chooser, account switch transition overlay
- Capacitor back button handler (dismiss modals → close chat → navigate back → exit app)
- Global keyboard shortcuts (Ctrl/Cmd+K search, Ctrl/Cmd+Enter send, / search, Escape close modal)
- Launcher badge count (Android, updated from unread counts)
- FLAG_SECURE management for view-once media
- Group welcome sheet

---

## 11. Frontend Utilities & Libraries

### `lib/axios.js`
Pre-configured Axios instance with JWT `Authorization` header injection and a response interceptor that detects session revocation (`401` + "Session has been logged out") and triggers `handleSessionRevoked()`.

### `lib/db.js`
IndexedDB cache via Dexie. One database per user (`chatty_cache_<userId>`). Tables: `messages`, `conversationsMeta`, `outbox`. All functions are non-throwing (silent fallback on unavailable storage).

### `lib/network.js`
`isNetworkError(error)` — true when `error.response` is missing (DNS/timeout/offline). `subscribeOnlineStatus(callback)` — listens to browser online/offline events.

### `lib/attachments.js`
Three-step R2 upload: `signUpload` (presigned PUT) → `putToBucket` (XHR with progress) → return metadata. `captureVideoPoster` extracts a JPEG thumbnail for video bubbles. Object URL lifecycle management (`createLocalUrl`/`releaseLocalUrl`).

### `lib/accounts.js`
Multi-account localStorage manager. Max 5 saved accounts. `rememberAccount`, `forgetAccount`, `getAccountToken`, `listAccounts`.

### `lib/biometrics.js`
Android biometric auth for chat lock. Stores lock password in localStorage keyed by user ID, gated behind `BiometricAuth.authenticate()`. Falls back to device PIN.

### `lib/clipboard.js`
Clipboard write with legacy `execCommand` fallback. `messagesToClipboardText` formats single or multi-message copy (with sender prefix).

### `lib/contacts.js`
`useNicknames` hook and `displayNameOf(user, nicknames)` for private per-contact renames.

### `lib/download.js`
Web: `<a download>` click. Android: `Filesystem.writeFile` + `Share.share()` system sheet.

### `lib/groupPermissions.js`
Client-side mirror of server group permission logic. `canDo(group, role, action)`, `levelFor(group, action)`.

### `lib/haptics.js`
`haptic(pattern)` — vibration patterns (tap, longPress, impact, double, success, reject) on touch devices only.

### `lib/members.js`
Group member helpers: `formatJoinDate`, `activityLabel`, `isOnlineNow`, `filterMembers` (search + filter chips).

### `lib/secureScreen.js`
Android `FLAG_SECURE` toggle via native plugin. Blocks screenshots while view-once media is open.

### `lib/social.js`
Social platform definitions (GitHub, Twitter, LinkedIn, YouTube, Portfolio) with icons, colors, placeholders, and `getFilledSocialLinks(user)`.

### `lib/utils.js`
`formatMessageTime`, `getPublicAppUrl`, `buildChatLink`, `buildInviteLink`, `parseChatLink`.

---

## 12. Authentication & Security

- Passwords hashed with `bcryptjs` (salt rounds = 10); plaintext never persisted.
- JWT signed with `process.env.JWT_SECRET`, 7-day expiry, includes `sid` (session ID). Delivered via:
  - `httpOnly` cookie named `jwt` (`sameSite`/`secure` per `NODE_ENV`)
  - Response body + localStorage, sent as `Authorization: Bearer <token>` header
- `protectRoute` middleware validates token (header first, then cookie), loads user, validates session if `sid` present, throttles `lastActive` refresh to once per 60s.
- CORS (`backend/lib/origins.js`): wide open in development. In production: `localhost:5173`/`localhost:5001`, any origin in `ALLOWED_ORIGIN`/`FRONTEND_URL` env vars, any `https://*.onrender.com` origin.
- **Helmet**: Content-Security-Policy with directives for Cloudinary, R2, and allowed origins.
- **Google Sign-In**: ID token verified server-side via `google-auth-library`. On Android, native Credential Manager (`@capgo/capacitor-social-login`) instead of browser redirect (Google blocks OAuth from WebViews).
- **Blocking**: enforced server-side in `sendMessage` AND on socket relay (typing, calls, read receipts). Block list cached in-memory for 30s.
- **HTML sanitization**: `sanitize-html` strips all HTML/JS from message text.
- **Input validation**: image/voice type whitelists + size caps, regex escaping for search (ReDoS prevention), R2 attachment verification after upload.
- **Spoofing protection**: server validates `from`/`receiverId` against authenticated user on socket events.
- **Session management**: each login creates a device session; sessions can be listed and individually revoked; revoking sends `sessionRevoked` event to kick the device live.

---

## 13. Environment Variables

### Backend (`backend/.env`)
```env
PORT=5001
MONGO_URI=<your MongoDB connection string>
JWT_SECRET=<random secret string>
NODE_ENV=development|production
CLOUDINARY_CLOUD_NAME=<cloudinary cloud name>
CLOUDINARY_API_KEY=<cloudinary api key>
CLOUDINARY_API_SECRET=<cloudinary api secret>

# Google Sign-In
GOOGLE_CLIENT_ID=<google web oauth client id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<google web oauth client secret>

# CORS origins (comma-separated)
ALLOWED_ORIGIN=https://localhost,capacitor://localhost,<your deployed frontend URL>

# Password reset email (cascading: Brevo → Resend → SMTP → console)
BREVO_API_KEY=<brevo api key>
EMAIL_FROM=<verified sender, e.g. Chatty <you@gmail.com>>
RESEND_API_KEY=<resend api key>
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<smtp user>
SMTP_PASS=<smtp app password>

# Optional: Cloudflare R2 for file attachments
R2_ACCOUNT_ID=<r2 account id>
R2_ACCESS_KEY_ID=<r2 access key>
R2_SECRET_ACCESS_KEY=<r2 secret key>
R2_BUCKET_NAME=<r2 bucket name>
R2_PUBLIC_URL=<r2 public url>

# Optional: GIPHY
GIPHY_API_KEY=<giphy api key>

# Optional: AssemblyAI for voice transcription
ASSEMBLYAI_API_KEY=<assemblyai api key>

# Optional: Email digest recipients (comma-separated)
DIGEST_RECIPIENTS=email1@example.com,email2@example.com
```

### Frontend (`frontend/.env.production`)
```env
VITE_API_URL=https://your-backend-domain.com/api
VITE_GOOGLE_CLIENT_ID=<google web oauth client id>.apps.googleusercontent.com
VITE_PUBLIC_APP_URL=https://your-domain.com
```
If `VITE_API_URL` is not set, the frontend defaults to `http://localhost:5001/api` in dev mode, or `/api` (same-origin) in production.

---

## 14. Setup & Installation

### Prerequisites
- Node.js (v18+ recommended)
- A MongoDB database (local or Atlas)
- A Cloudinary account (for images/voice)
- (Optional) Cloudflare R2 for file attachments
- (Optional) GIPHY API key for GIF/sticker support
- (Optional) AssemblyAI API key for voice transcription

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/BoniSaiPraneeth2506/chat-app.git
cd chat-app

# 2. Install backend dependencies
cd backend
npm install

# 3. Configure environment variables
# create backend/.env with the variables listed in section 13

# 4. Install frontend dependencies
cd ../frontend
npm install

# 5. (Optional) Seed the database with dummy users
cd ../backend
node seeds/user.seed.js

# 6. Run backend (dev, with nodemon)
npm run dev
# Server starts on http://localhost:5001

# 7. Run frontend (in a separate terminal)
cd ../frontend
npm run dev
# Vite dev server starts, typically on http://localhost:5173
```

The frontend dev server proxies API calls to `http://localhost:5001/api` (configured in `axios.js`), and the Socket.IO client connects to `http://localhost:5001`.

---

## 15. Build & Deployment

The root `package.json` provides a combined build/start flow suitable for single-service hosts (e.g., Render):

```bash
npm run build   # installs backend + frontend deps, builds frontend into frontend/dist
npm run start   # starts the backend, which serves frontend/dist in production
```

In production (`NODE_ENV=production`), `backend/index.js` serves the compiled React app and handles SPA client-side routing fallback, while `/api/*` routes remain handled by Express.

---

## 16. Known Issues / Notes

- Rate limiting infrastructure exists (`socketAllow` in `socket.js`) but is currently **disabled** (always returns `true`). The `rateLimit.middleware.js` file exists but is not applied to any route.
- `useChatStore` (~2088 lines) and `useGroupStore` (~1094 lines) are large stores that could benefit from splitting. Cross-store circular dependencies are handled via dynamic `import()` at call time.
- The backend's `backend/package.json` and the frontend's `frontend/package.json` both list `"chat-app": "file:.."` as a dependency — a local self-reference from monorepo scaffolding with no functional effect.
- Disappearing messages rely on a MongoDB TTL index (`deleteAt`, `expires: 600`). The background media purge job runs every 20s to free Cloudinary/R2 assets before DB deletion.
- WebRTC calling requires camera/microphone permissions. The configured TURN server (`openrelay.metered.ca`) is a free shared service suitable for testing, not guaranteed for production-scale reliability.
- Screen sharing (`getDisplayMedia`) is not available in the Android WebView; the UI hides the control on mobile.
- The offline IndexedDB cache (`lib/db.js`) is non-throwing — if IndexedDB is unavailable (Safari private browsing, quota exceeded), the app degrades gracefully to network-only.

---

## 17. Mobile App (Capacitor / Android)

The Android app is **not a separate codebase** — it's the same React frontend (`frontend/`), wrapped by Capacitor and running inside a native WebView. `frontend/android/` is the native Android project; it's committed to the repo, so it doesn't need to be regenerated from scratch, just kept in sync.

### 17.1 Prerequisites

- **Node.js** (same as the web app).
- **Android Studio** (for the SDK, platform tools, and an emulator if you want one).
- **A JDK compatible with Gradle 8.11** — point `JAVA_HOME` at Android Studio's bundled JBR:
  ```powershell
  $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
  $env:Path = "$env:JAVA_HOME\bin;$env:Path"
  ```
  (macOS/Linux: `Android Studio.app/Contents/jbr/Contents/Home`, or `/opt/android-studio/jbr`.)
- `adb` on your `PATH` (comes with the SDK's `platform-tools`).
- A device or emulator with USB debugging enabled.

### 17.2 First-time setup

```bash
cd frontend
npm install                  # installs @capacitor/core, @capacitor/android,
                              # @capgo/capacitor-social-login, etc.
npm run build                 # builds dist/ from the current source
npx cap sync android          # copies dist/ into the native project,
                              # (re)registers plugins
```

### 17.3 The edit → rebuild → run loop

Every time you change frontend source and want to see it in the Android app:

```bash
cd frontend
npm run build          # 1. rebuild the web bundle into dist/
npx cap sync android   # 2. copy dist/ + plugin config into android/

cd android
# Windows (PowerShell), pointing at the JBR JDK:
.\gradlew.bat assembleDebug --console=plain

# APK lands at android/app/build/outputs/apk/debug/app-debug.apk
adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am force-stop com.chatapp.mobile
adb shell monkey -p com.chatapp.mobile -c android.intent.category.LAUNCHER 1
```

If you only changed `frontend/android/*` (native config, manifest, gradle files) and not the web source, skip `npm run build`/`cap sync` and just re-run Gradle.

### 17.4 Capacitor Plugins

| Plugin | Purpose |
|---|---|
| `@capacitor/core` | Core Capacitor runtime |
| `@capacitor/android` | Android platform |
| `@capacitor/app` | App lifecycle, back button listener |
| `@capacitor/filesystem` | Native file save for exports |
| `@capacitor/share` | Native share sheet for file sharing |
| `@capgo/capacitor-social-login` | Native Android Google Sign-In (Credential Manager) |
| `@aparajita/capacitor-biometric-auth` | Fingerprint/face unlock for chat lock |
| `@capawesome/capacitor-badge` | Android launcher badge count |
| Native `SecureScreen` plugin | FLAG_SECURE for view-once media (custom, in `android/app/src/...`) |

`frontend/capacitor.config.json` controls the app ID (`com.chatapp.mobile`), display name, and which plugin providers are bundled (`SocialLogin.providers` — only `google` enabled; `facebook`/`apple`/`twitter` disabled).

### 17.5 Google Sign-In on Android

The app uses Android's native Credential Manager (via `@capgo/capacitor-social-login`) instead of a browser-redirect OAuth flow, because **Google blocks OAuth sign-in from embedded WebViews** (`Error 403: disallowed_useragent`).

Setup:
1. In the same Google Cloud project as your Web OAuth client, create a second OAuth client of type **Android**.
2. Package name: `com.chatapp.mobile`.
3. SHA-1 fingerprint of the signing keystore:
   ```bash
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   ```
4. The Android client isn't referenced in code — its existence (tied to package name + SHA-1) authorizes the app. The ID token is requested against the **Web** Client ID (`VITE_GOOGLE_CLIENT_ID`), verified by the same `/auth/google` backend endpoint.
5. Do **not** pass a `scopes` option to `SocialLogin.login()` — the plugin throws `"You CANNOT use scopes without modifying the main activity"`.

### 17.6 Native Android Features

- **Back button handling**: `CapacitorApp.addListener('backButton', ...)` in `App.jsx` — dismisses modals → closes open chat → navigates back → exits app
- **Launcher badge**: `@capawesome/capacitor-badge` updates the unread count on the app icon (Android only)
- **Secure screen**: Custom `SecureScreen` plugin sets `FLAG_SECURE` when view-once media is open
- **Biometric auth**: `@aparajita/capacitor-biometric-auth` for chat lock unlock with fingerprint/face (with device PIN fallback)
- **File sharing**: `@capacitor/filesystem` + `@capacitor/share` for saving/sharing exported chats

### 17.7 Offline Behavior

The frontend has an offline-first cache (`frontend/src/lib/db.js`, IndexedDB via Dexie) that applies on both the web and the Android app equally — chats/messages paint instantly from the last sync while the network confirms in the background, sends made while offline queue and auto-flush on reconnect, and the whole cache for an account is wiped on logout. This is app code, not Capacitor-specific, so there's nothing extra to configure for it.

### 17.8 Troubleshooting

- **`Unsupported class file major version 70`** → `JAVA_HOME` is pointing at too new a JDK. Use Android Studio's bundled JBR (§17.1).
- **`Duplicate class kotlin.collections.jdk8.CollectionsJDK8Kt`** → Kotlin stdlib version conflicts. Fixed via `configurations.all { exclude }` in `android/app/build.gradle`.
- **`Dependency 'androidx.browser:browser:...' requires compileSdk 36`** → Bump `compileSdkVersion` in `android/variables.gradle`.
- **CORS errors from the app** → Backend `ALLOWED_ORIGIN` doesn't include `https://localhost`. Add it and **redeploy** (not just restart on Render).
- **`Developer console is not set up correctly`** (native Google Sign-In) → APK's SHA-1, package name, or `webClientId` doesn't match Google Cloud Console. Check Logcat for `GoogleProvider` logs.
- **Phone shows as `unauthorized` in `adb devices`** → Accept the "Allow USB debugging?" prompt on the phone.
- **App doesn't reflect code changes** → Skipped `npm run build` and/or `npx cap sync android` before Gradle rebuild.
