# Chatty — Real-Time MERN Chat Application

A full-featured, WhatsApp-style real-time chat application built with **MongoDB, Express, React, and Node.js (MERN)**, using **Socket.IO** for real-time communication and **Cloudinary** for media storage.

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
11. [Authentication & Security](#11-authentication--security)
12. [Environment Variables](#12-environment-variables)
13. [Setup & Installation](#13-setup--installation)
14. [Build & Deployment](#14-build--deployment)
15. [Known Issues / Notes](#15-known-issues--notes)
16. [Mobile App (Capacitor / Android)](#16-mobile-app-capacitor--android)

---

## 1. Overview

**Chatty** is a one-to-one real-time messaging application inspired by WhatsApp. It supports text, image, and voice messages, audio/video calling (WebRTC), message reactions, replies, edits, deletions, pinning, disappearing messages, contact management (favorites/archive/block), chat wallpapers, multiple UI themes, and read-receipt/online-status tracking.

The repository is a monorepo with two main folders:
- `backend/` — Express REST API + Socket.IO server
- `frontend/` — React (Vite) single-page application

A root `package.json` provides convenience scripts to install both apps and build the frontend for production serving via the backend.

---

## 2. Tech Stack

### Backend
| Technology | Purpose |
|---|---|
| Node.js + Express 5 | HTTP server & REST API |
| MongoDB + Mongoose | Database & ODM |
| Socket.IO | Real-time bi-directional communication (messaging, calls, presence) |
| JWT (`jsonwebtoken`) | Stateless authentication |
| bcryptjs | Password hashing |
| Cloudinary | Image/voice-note cloud storage |
| cookie-parser | Reading JWT from HTTP-only cookies |
| cors | Cross-origin request handling |
| dotenv | Environment variable loading |
| nodemon | Dev-time auto-restart |

### Frontend
| Technology | Purpose |
|---|---|
| React 19 | UI library |
| Vite 7 | Build tool / dev server |
| React Router DOM 7 | Client-side routing |
| Zustand 5 | Lightweight global state management |
| Axios | HTTP client |
| Socket.IO-client | Real-time client |
| TailwindCSS 3 + DaisyUI 5 | Styling & themed UI components |
| Lucide-react | Icon library |
| React-hot-toast | Toast notifications |
| Native WebRTC APIs | Peer-to-peer audio/video calling |

---

## 3. Project Structure

```
chat-app/
├── package.json                  # Root scripts (build/start for combined deployment)
├── backend/
│   ├── index.js                  # App entry point (Express + Socket.IO server bootstrap)
│   ├── controllers/
│   │   ├── auth.controller.js    # Signup, login, logout, profile update, checkAuth
│   │   └── message.controller.js # Messaging, reactions, calls, wallpapers, etc.
│   ├── lib/
│   │   ├── db.js                 # MongoDB connection
│   │   ├── socket.js             # Socket.IO server, presence & signaling logic
│   │   ├── cloudinary.js         # Cloudinary SDK config
│   │   └── utils.js              # JWT helper (generateToken)
│   ├── middlewares/
│   │   └── auth.middleware.js    # protectRoute — JWT verification middleware
│   ├── models/
│   │   ├── user.model.js         # User schema
│   │   └── message.model.js      # Message schema
│   ├── routes/
│   │   ├── auth.route.js         # /api/auth/*
│   │   └── message.route.js      # /api/messages/*
│   ├── seeds/
│   │   ├── user.seed.js          # Seeds ~15 dummy users
│   │   ├── insert_7_dummy.js
│   │   └── delete_dummy.js
│   └── .env                      # Backend secrets (not committed)
│
└── frontend/
    ├── index.html
    ├── vite.config.js
    ├── tailwind.config.js / postcss.config.js
    ├── .env.production
    └── src/
        ├── main.jsx               # ReactDOM root + BrowserRouter
        ├── App.jsx                # Route definitions, theming, global modals
        ├── index.css
        ├── constants/index.js     # THEME_COLORS + THEMES list (30+ themes)
        ├── lib/
        │   ├── axios.js           # Pre-configured Axios instance (JWT header injection)
        │   └── utils.js           # formatMessageTime helper
        ├── store/
        │   ├── useAuthStore.js    # Auth state + socket connection lifecycle
        │   ├── useChatStore.js    # Messaging, calling (WebRTC), reactions, etc.
        │   └── useThemeStore.js   # Theme, wallpaper, sound & privacy prefs (localStorage)
        ├── pages/
        │   ├── HomePage.jsx
        │   ├── LoginPage.jsx
        │   ├── SignUpPage.jsx
        │   ├── SettingsPage.jsx
        │   └── ProfilePage.jsx
        └── components/
            ├── NavBar.jsx
            ├── SideBar.jsx            # Contact list, search, filters, context menu
            ├── ChatHeader.jsx         # Header w/ call buttons, search, wallpaper menu
            ├── ChatContainer.jsx      # Message list, reactions, contact info panel
            ├── MessageInput.jsx       # Text/image/voice composer, typing indicator
            ├── CallModal.jsx          # WebRTC audio/video call UI
            ├── NoChatSelected.jsx
            ├── AuthImagePattern.jsx
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
│   (Vite SPA)    │ ◀─────────────────────────────────────────────── │  (auth + messages)    │
│                 │                                                   │                       │
│                 │        WebSocket (Socket.IO, transport=websocket) │                       │
│                 │ ◀───────────────────────────────────────────────▶│   Socket.IO Server     │
└─────────────────┘        (messages, presence, typing, calls, etc.)  └──────────┬────────────┘
                                                                                    │
                                                                          Mongoose ODM
                                                                                    │
                                                                          ┌─────────▼─────────┐
                                                                          │      MongoDB       │
                                                                          │ (Users, Messages)  │
                                                                          └─────────────────────┘
                            Media Upload (base64 → Cloudinary)
┌─────────────────┐ ───────────────────────────────────────────────▶ ┌───────────────────────┐
│  Express server  │                                                  │      Cloudinary        │
└─────────────────┘ ◀─────────────────────────────────────────────── └───────────────────────┘
```

- The `backend/lib/socket.js` module creates its own `http.createServer(app)` and Socket.IO instance; `backend/index.js` imports `{ app, server }` from it and mounts REST routes onto the same Express `app`, then calls `server.listen()`. This way, one HTTP server handles both REST calls and WebSocket upgrades.
- In production, the Express app also serves the built frontend (`frontend/dist`) as static files and handles SPA fallback routing (`app.get("/*", ...)`).
- WebRTC (peer-to-peer audio/video) signaling (`offer`/`answer`/ICE candidates) is relayed through Socket.IO events; actual media streams flow directly between browsers (or via STUN/TURN when needed).

---

## 5. Feature Set

### Messaging
- One-to-one text messaging with real-time delivery via Socket.IO
- Image messages (uploaded to Cloudinary, client-side compressed before upload)
- Voice messages (recorded via `MediaRecorder`, uploaded as Cloudinary video resource)
- Message replies (quote another message)
- Message editing (within 15 minutes of sending)
- Message deletion ("Delete for me" / "Delete for everyone")
- Message reactions (emoji, one reaction per user per message, toggled by re-clicking)
- Message pinning (one pinned message per conversation, shown as a sticky banner)
- Disappearing messages (off / 1h / 24h / 7d — implemented via Mongo `expires: 0` TTL field `deleteAt`)
- In-chat message search with highlight
- Infinite scroll / paginated message loading (`limit` & `skip` query params)
- "Personal Notes" self-chat (chat with yourself for notes/drafts)

### Presence & Read Status
- Real-time online/offline user tracking (`getOnlineUsers` broadcast)
- Per-user "online privacy" toggle to hide online status (`onlinePrivacy` field)
- Last-seen timestamp tracking
- Read receipts (single/double checkmarks), with optional privacy toggle to hide blue "read" ticks
- Typing indicators

### Calling (WebRTC)
- Voice and video calling using native WebRTC APIs (`RTCPeerConnection`)
- Signaling (offer/answer/ICE candidates) relayed through Socket.IO
- STUN/TURN servers configured (Google STUN + Metered.ca open relay TURN) for NAT traversal
- Call states: ringing, incoming, connected, ended
- Minimizable/maximizable call UI overlay
- Automatic call-log messages saved to the chat history (completed/missed/declined with duration)

### Contact Management
- User search (server-side, by full name regex)
- Favorites (star a contact) — stored client-side in `localStorage`
- Archive a chat — stored client-side in `localStorage`
- Pin a chat to top (max 2 pinned) — stored client-side in `localStorage`
- Block / unblock users — stored server-side (`blockedUsers` array); blocked users cannot exchange messages
- Right-click / long-press context menu for contact quick actions
- Clear chat history (soft-delete per-user via `deletedFor` array)
- QR-code profile/chat-link sharing (`/chat-with/:userId` deep link)

### Customization
- 30+ DaisyUI-inspired color themes (light, dark, dracula, synthwave, forest, etc.) with live CSS variable injection
- Custom chat wallpapers per-conversation (color/gradient presets or custom uploaded image with adjustable dim/brightness level), synced to both participants
- Notification sound toggle
- Profile customization: full name, email, bio, website link, profile picture (Cloudinary upload)

### Auth
- Email/password signup & login
- JWT stored in both an HTTP-only cookie and `localStorage` (fallback `Authorization: Bearer` header support for cross-site/mobile scenarios)
- Protected routes via middleware
- Session persistence via `checkAuth` on app load

---

## 6. Data Models

### `User` (backend/models/user.model.js)
| Field | Type | Notes |
|---|---|---|
| fullName | String | required |
| email | String | required, unique |
| password | String | hashed (bcrypt), min length 6 — **not required**: absent for Google-only accounts |
| googleId | String | Google's `sub` claim, unique + sparse — present only for accounts that have signed in with Google |
| profilePic | String | Cloudinary URL, default `""` |
| bio | String | default `""` |
| link | String | personal website/social link |
| onlinePrivacy | Boolean | default `true` (visible online status) |
| disappearingTimers | Map<String,String> | per-conversation timer setting (`off`/`1h`/`24h`/`7d`), keyed by other user's ID |
| lastSeen | Date | updated on socket disconnect |
| favorites | [ObjectId] (ref User) | *(legacy — mostly superseded by localStorage today)* |
| archived | [ObjectId] (ref User) | *(legacy — mostly superseded by localStorage today)* |
| blockedUsers | [ObjectId] (ref User) | users this user has blocked |
| chatWallpapers | Map<String,String> | per-conversation wallpaper, keyed by other user's ID |
| timestamps | createdAt / updatedAt | auto |

### `Message` (backend/models/message.model.js)
| Field | Type | Notes |
|---|---|---|
| senderId | ObjectId (ref User) | required |
| receiverId | ObjectId (ref User) | required |
| text | String | optional |
| image | String | Cloudinary URL |
| voice | String | Cloudinary URL (audio, uploaded as `resource_type: video`) |
| isEdited | Boolean | default false |
| isCallLog | Boolean | default false — marks a call-summary message |
| callType | String | `"voice"` \| `"video"` |
| callDuration | Number | seconds |
| callStatus | String | `"completed"` \| `"missed"` \| `"declined"` |
| deleteAt | Date | TTL index (`expires: 0`) — used for disappearing messages |
| replyTo | ObjectId (ref Message) | nullable, populated on fetch |
| reactions | [{ userId, emoji }] | one entry per reacting user |
| deletedFor | [ObjectId] (ref User) | soft-delete list ("delete for me") |
| isDeletedForEveryone | Boolean | default false |
| isPinned | Boolean | default false — only one true per conversation at a time |
| timestamps | createdAt / updatedAt | auto |

---

## 7. REST API Reference

Base URL: `/api` (e.g., `http://localhost:5001/api`)

### Auth Routes — `/api/auth` (`backend/routes/auth.route.js`)

| Method | Path | Auth? | Description |
|---|---|---|---|
| POST | `/signup` | No | Create account. Body: `{ fullName, email, password }`. Returns user + sets JWT cookie + returns `token`. |
| POST | `/login` | No | Log in. Body: `{ email, password }`. Returns user + sets JWT cookie + returns `token`. Rejects with a clear message if the account has no password (Google-only). |
| POST | `/google` | No | Google Sign-In. Body: `{ idToken }` (a Google ID token from either the web GIS button or the native Android plugin). Verifies the token server-side, then finds by `googleId`, auto-links to an existing password account with the same verified email, or creates a new account — same session/JWT issuance as `/login`. |
| POST | `/logout` | No | Clears JWT cookie. |
| PUT | `/update-profile` | Yes | Update `fullName`, `email`, `bio`, `link`, `onlinePrivacy`, `messageTimer`, `profilePic` (base64 → Cloudinary upload). |
| GET | `/check` | Yes | Returns the currently authenticated user (`req.user`). Used on app load to restore session. |

### Message Routes — `/api/messages` (`backend/routes/message.route.js`)

| Method | Path | Auth? | Description |
|---|---|---|---|
| GET | `/users` | Yes | List sidebar contacts. Supports `?search=<name>` (regex search across all users) or returns chatted users + up to 4 seeded "discover" users. |
| GET | `/:id` | Yes | Get messages with user `:id`. Supports `?limit=&skip=` pagination (sorted ascending when no limit, descending+reversed when paginated). Response header `X-Pinned-Message` contains the currently pinned message (if any) as URI-encoded JSON. |
| POST | `/send/:id` | Yes | Send a message to user `:id`. Body: `{ text?, image?, voice?, replyTo? }`. Blocks send if either party has blocked the other. Applies `disappearingTimers` setting to compute `deleteAt`. Emits `newMessage` socket event to receiver. |
| POST | `/disappearing/:id` | Yes | Set disappearing-message timer for conversation with `:id`. Body: `{ timer }` (`off`/`1h`/`24h`/`7d`). Updates both users' maps; emits `disappearingTimerUpdate` to the other party. |
| POST | `/reaction/:id` | Yes | Toggle an emoji reaction on message `:id`. Body: `{ emoji }`. Emits `messageReaction` to the other party. |
| POST | `/action/:id` | Yes | Toggle `favorite` or `archive` state for contact `:id` (server-side legacy list). Body: `{ action }`. |
| PUT | `/edit/:id` | Yes | Edit message `:id` text (only by sender, within 15 minutes). Body: `{ text }`. Emits `messageEdited`. |
| POST | `/block/:id` | Yes | Toggle block status on user `:id`. Returns `{ user, isBlocked }`. |
| POST | `/call-log` | Yes | Persist a call-summary message. Body: `{ receiverId, callType, callDuration, callStatus }`. |
| PUT | `/pin/:id` | Yes | Toggle pin status of message `:id` (auto-unpins any previously pinned message in that conversation). Emits `messagePinned`. |
| POST | `/wallpaper/:id` | Yes | Set shared chat wallpaper with user `:id`. Body: `{ wallpaper }` (color id, image URL, or base64 image w/ optional `#dim=<0-80>` suffix). Uploads base64 images to Cloudinary. Emits `chatWallpaperUpdate`. |
| DELETE | `/:id` | Yes | Delete message `:id`. Body: `{ type: "me" | "everyone" }`. "everyone" only allowed by original sender; emits `messageDeleted`. |
| DELETE | `/clear/:id` | Yes | Clear entire chat history with user `:id` (adds current user to `deletedFor` on all matching messages). |

**Authentication for all protected routes** is handled by `protectRoute` middleware (`backend/middlewares/auth.middleware.js`), which reads the JWT from the `jwt` cookie or `Authorization: Bearer <token>` header, verifies it, loads the user (`req.user`), and calls `next()`.

---

## 8. Real-Time Events (Socket.IO)

Socket connection URL: same origin as backend, established with `query: { userId }` and `transports: ["websocket"]`.

### Client → Server
| Event | Payload | Purpose |
|---|---|---|
| `markAsRead` | `{ senderId, receiverId }` | Notify sender that receiver has read their messages |
| `typing` | `{ receiverId, isTyping }` | Broadcast typing indicator |
| `callUser` | `{ userToCall, signalData, from, type }` | Initiate WebRTC call (send SDP offer) |
| `answerCall` | `{ signal, to }` | Answer a call (send SDP answer) |
| `endCall` | `{ to }` | Terminate an active/ringing call |
| `iceCandidate` | `{ candidate, to }` | Relay ICE candidates for NAT traversal |

### Server → Client
| Event | Payload | Purpose |
|---|---|---|
| `getOnlineUsers` | `string[]` (user IDs) | Broadcast current online users (respecting `onlinePrivacy`) |
| `newMessage` | `Message` | New message delivered in real time |
| `messagesRead` | `{ userId }` | Confirms recipient read the sender's messages |
| `disappearingTimerUpdate` | `{ userId, timer }` | Notifies the other party the disappearing-message timer changed |
| `typing` | `{ senderId, isTyping }` | Relayed typing indicator |
| `messageReaction` | `{ messageId, reactions }` | Reaction added/removed/changed |
| `messageDeleted` | `{ messageId, isDeletedForEveryone }` | Message deleted for everyone |
| `messageEdited` | `Message` | Updated message content |
| `messagePinned` | `Message` | Pin/unpin state changed |
| `chatWallpaperUpdate` | `{ updatedBy, wallpaper }` | Wallpaper changed for shared conversation |
| `callUser` | `{ signal, from, type }` | Incoming call notification (with SDP offer) |
| `callAccepted` | `{ signal }` | Callee accepted (with SDP answer) |
| `callEnded` | — | Call was ended/rejected by the other party |
| `iceCandidate` | `{ candidate }` | Relayed ICE candidate |

Presence tracking is maintained in-memory on the server via `userSocketMap` (`{ userId: socketId }`) and `privateUsersSet` (users who opted out of visible online status). On disconnect, `lastSeen` is persisted to MongoDB and updated online-user list is broadcast.

---

## 9. Frontend State Management (Zustand Stores)

### `useAuthStore` (`frontend/src/store/useAuthStore.js`)
Manages authentication state and the Socket.IO connection lifecycle.
- State: `authUser`, `isSigningUp`, `isLoggingIn`, `isUpdatingProfile`, `isCheckingAuth`, `onlineUsers`, `socket`
- Actions: `checkAuth`, `signUp`, `login`, `logOut`, `updateProfile`, `connectSocket`, `disconnectSocket`
- On successful auth, stores JWT token in `localStorage` (backup to the HTTP-only cookie) and opens the Socket.IO connection.

### `useChatStore` (`frontend/src/store/useChatStore.js`)
The largest store — manages messages, contacts, reactions, calling (WebRTC), and UI-adjacent chat state.
- Core chat state: `messages`, `users`, `selectedUser`, `latestMessages`, `unreadCounts`, `lastReadTimestamps`, `hasMoreMessages`, `pinnedMessage`
- UI state: `isRecipientProfileOpen`, `messageSearchQuery`, `replyingToMessage`, `editingMessage`, `showArchivedOnly`, `profilePreviewUser`, `lightboxImage`
- Calling state: `callState` (`null`/`ringing`/`incoming`/`connected`), `callType`, `callPartner`, `isCaller`, `isCallMinimized`, `localStream`, `remoteStream`, `peerConnection`, `incomingSignal`
- Key actions:
  - `getUsers(search)` — fetch sidebar contacts + latest message per contact
  - `getMessages(userId)` / `loadMoreMessages(userId)` — paginated fetch, emits `markAsRead`
  - `sendMessage(data)`, `editMessage`, `deleteMessage`, `clearChatHistory`
  - `toggleReaction`, `togglePinMessage`, `toggleBlockUser`, `toggleContactAction`
  - `setDisappearingTimer`, `sendTypingStatus`, `setConversationWallpaper`
  - `subscribeToMessages()` / `unsubscribeFromMessages()` — registers/cleans up all Socket.IO listeners
  - `startCall`, `acceptCall`, `rejectCall`, `endCall` — full WebRTC negotiation using `RTCPeerConnection`, `getUserMedia`, STUN/TURN ICE servers, with pending ICE candidate queueing until remote description is set

### `useThemeStore` (`frontend/src/store/useThemeStore.js`)
Persists UI preferences to `localStorage`:
- `theme` (one of 30+ named themes)
- `wallpaper` (chat background preset/custom)
- `soundEnabled` (message notification sound)
- `privacyReadReceipts` (show/hide blue read ticks)

---

## 10. Frontend Pages & Components

### Pages
- **LoginPage / SignUpPage** — auth forms with `AuthImagePattern` decorative side panel
- **HomePage** — main chat layout combining `SideBar` + `ChatContainer`/`NoChatSelected`; manages mobile back-button behavior via `history.pushState`
- **SettingsPage** — theme picker grid, wallpaper picker, sound/privacy toggles, live chat preview
- **ProfilePage** — avatar upload, editable profile fields, online-privacy toggle, QR code deep-link sharing (`/chat-with/:userId`)

### Key Components
- **NavBar** — top navigation with links to Settings/Profile and Logout (with confirmation modal)
- **SideBar** — contact list with search, filter chips (All/Unread/Favorites/Online), pinned/favorite/archived indicators, "Personal Notes" self-chat entry, right-click/long-press context menu (pin/star/archive/delete chat), read-receipt ticks
- **ChatHeader** — recipient info (avatar/name/online/last-seen/typing), call buttons, in-chat search toggle, "more options" dropdown (wallpaper picker with custom upload + dim slider, block/unblock)
- **ChatContainer** — scrollable message list with infinite-scroll-up pagination, pinned-message banner, per-message hover action bar (react/reply/edit/pin/delete), reaction pills, call-log entries, recipient contact-info side panel (bio, link, disappearing-message selector, join date)
- **MessageInput** — text input, image picker (client-side canvas compression before upload), voice recording (`MediaRecorder`), typing-indicator debounce, reply/edit banners
- **CallModal** — full-screen and minimized WebRTC call UI (mute/camera toggle, ringtone playback, call duration timer, PiP local video for video calls)
- **NoChatSelected** — placeholder/welcome screen
- **Skeletons** (`SidebarSkeleton`, `MessageSkeleton`) — loading placeholders

### Global UI in `App.jsx`
- Route table (`/`, `/login`, `/signup`, `/settings`, `/profile`, `/chat-with/:userId`, wildcard redirect)
- `ChatRedirectHandler` — resolves a deep-linked `/chat-with/:userId` route into an open conversation
- Theme CSS variables applied to `:root` from `THEME_COLORS`
- Global modals: profile picture preview popup, full-screen image lightbox

---

## 11. Authentication & Security

- Passwords hashed with `bcryptjs` (salt rounds = 10) before storage; plaintext never persisted.
- JWT signed with `process.env.JWT_SECRET`, 7-day expiry, delivered via:
  - An `httpOnly` cookie named `jwt` (primary — `sameSite`/`secure` configured per `NODE_ENV`)
  - Also returned in the response body and stored in `localStorage`, sent as `Authorization: Bearer <token>` header on subsequent requests (fallback for cross-origin/mobile scenarios where cookies may be blocked)
- `protectRoute` middleware validates the token (cookie first, then header), loads the user, and rejects with 401 on failure.
- CORS (`backend/lib/origins.js`) is wide open in development. In production it allows: `localhost:5173`/`localhost:5001`, any origin listed in the `ALLOWED_ORIGIN`/`FRONTEND_URL` env vars (comma-separated), and any `https://*.onrender.com` origin. **The Capacitor Android app's origin (`https://localhost`) must be added to `ALLOWED_ORIGIN`** or the native app's API calls get rejected — see [§16](#16-mobile-app-capacitor--android).
- **Google Sign-In** (`googleAuth` in `auth.controller.js`) verifies the client-supplied ID token server-side via `google-auth-library` against `GOOGLE_CLIENT_ID`, then finds-or-links-or-creates the user and issues the same session/JWT as password login. No separate session type — a Google-authenticated user is indistinguishable from a password one once logged in, except `password` may be unset.
- Blocking logic is enforced server-side in `sendMessage` — checks both parties' `blockedUsers` arrays before allowing message delivery.

---

## 12. Environment Variables

### Backend (`backend/.env`)
```env
PORT=5001
MONGO_URI=<your MongoDB connection string>
JWT_SECRET=<random secret string>
NODE_ENV=development|production
CLOUDINARY_CLOUD_NAME=<cloudinary cloud name>
CLOUDINARY_API_KEY=<cloudinary api key>
CLOUDINARY_API_SECRET=<cloudinary api secret>

# Google Sign-In — same Web OAuth client the frontend uses (see below).
# GOOGLE_CLIENT_SECRET isn't actually used by the ID-token-verification flow
# this app uses, but keep it set alongside the Client ID regardless.
GOOGLE_CLIENT_ID=<google web oauth client id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<google web oauth client secret>

# Extra origins allowed by CORS in production, comma-separated — must include
# the Capacitor Android app's origin (https://localhost) once you build it,
# and your deployed frontend URL if it isn't on *.onrender.com.
ALLOWED_ORIGIN=https://localhost,capacitor://localhost,<your deployed frontend URL>

# Password reset email — Brevo HTTPS API (preferred; a single verified sender
# address is enough, no domain required)
BREVO_API_KEY=<brevo api key>
EMAIL_FROM=<verified sender, e.g. Chatty <you@gmail.com>>

# Password reset email — Resend HTTPS API (tried after Brevo; needs a verified domain
# to reach arbitrary recipients)
RESEND_API_KEY=<resend api key>

# Password reset email — SMTP fallback (blocked on Render's free tier)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=<smtp user>
SMTP_PASS=<smtp app password>
```
Reset codes are sent through the first configured provider — Brevo, then Resend — falling back to SMTP. Hosts such as Render's free tier block outbound SMTP ports 25/465/587, so an HTTP provider is required there. With none configured, the code is logged to the server console instead (dev only).

### Frontend (`frontend/.env.production` — and optionally `.env.development`)
```env
VITE_API_URL=https://your-backend-domain.com/api

# Google Sign-In — the Web OAuth client ID (not the secret; this is safe to
# ship in the client bundle). Same value the backend's GOOGLE_CLIENT_ID uses.
VITE_GOOGLE_CLIENT_ID=<google web oauth client id>.apps.googleusercontent.com
```
If `VITE_API_URL` is not set, the frontend defaults to `http://localhost:5001/api` in dev mode, or `/api` (same-origin) in production — supporting the combined single-server deployment model.

---

## 13. Setup & Installation

### Prerequisites
- Node.js (v18+ recommended)
- A MongoDB database (local or Atlas)
- A Cloudinary account (for image/voice uploads)

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/BoniSaiPraneeth2506/chat-app.git
cd chat-app

# 2. Install backend dependencies
cd backend
npm install

# 3. Configure environment variables
# create backend/.env with the variables listed in section 12

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

## 14. Build & Deployment

The root `package.json` provides a combined build/start flow suitable for single-service hosts (e.g., Render):

```bash
npm run build   # installs backend + frontend deps, builds frontend into frontend/dist
npm run start   # starts the backend, which serves frontend/dist in production
```

In production (`NODE_ENV=production`), `backend/index.js`:
```js
app.use(express.static(path.join(__dirname, "../frontend/dist")));
app.get("/*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
});
```
serves the compiled React app and handles SPA client-side routing fallback, while `/api/*` routes remain handled by Express.

---

## 15. Known Issues / Notes

- `favorites`/`archived` fields exist on the `User` model and have a dedicated `/action/:id` endpoint, but the current `SideBar` UI actually manages favorites/archive/pin state via **`localStorage`** rather than these server fields — meaning these preferences are currently device-specific rather than synced across devices/sessions.
- `getUsersForSidebar` returns chatted users plus up to 4 "discover" users whose email matches `@example.com` (i.e., seeded dummy accounts) when no search query is provided — intended to showcase the app with sample contacts.
- Disappearing messages rely on a MongoDB TTL index (`deleteAt`, `expires: 0`) — requires MongoDB's background TTL monitor (runs every ~60s), so deletion isn't instantaneous.
- WebRTC calling requires camera/microphone permissions and works best when both peers can establish a direct or TURN-relayed connection; the configured public TURN server (`openrelay.metered.ca`) is a free/shared service suitable for testing, not guaranteed for production-scale reliability.
- The `backend/package.json` lists `"chat-app": "file:.."` as a dependency — a local self-reference likely left over from monorepo scaffolding; it has no functional effect but could be removed for clarity.

---

## 16. Mobile App (Capacitor / Android)

The Android app is **not a separate codebase** — it's the same React frontend (`frontend/`), wrapped by [Capacitor](https://capacitorjs.com) and running inside a native WebView. `frontend/android/` is the native Android project; it's committed to the repo, so it doesn't need to be regenerated from scratch, just kept in sync.

### 16.1 Prerequisites

- **Node.js** (same as the web app).
- **Android Studio** (for the SDK, platform tools, and an emulator if you want one) — install the SDK platforms/build-tools it prompts for.
- **A JDK compatible with Gradle 8.11** — a *system-wide* very new JDK (e.g. JDK 25/26) will fail with `Unsupported class file major version`. The simplest fix, since Android Studio ships its own: point `JAVA_HOME` at Android Studio's bundled JBR for any Gradle command:
  ```powershell
  $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
  $env:Path = "$env:JAVA_HOME\bin;$env:Path"
  ```
  (macOS/Linux: `Android Studio.app/Contents/jbr/Contents/Home`, or `/opt/android-studio/jbr`.)
- `adb` on your `PATH` (comes with the SDK's `platform-tools`).
- A device or emulator with **USB debugging enabled** (Settings → Developer Options), or an AVD created in Android Studio.

### 16.2 First-time setup

```bash
cd frontend
npm install                  # installs @capacitor/core, @capacitor/android,
                              # @capgo/capacitor-social-login, etc.
npm run build                 # builds dist/ from the current source
npx cap sync android          # copies dist/ into the native project,
                              # (re)registers plugins
```

### 16.3 The edit → rebuild → run loop

Every time you change frontend source and want to see it in the Android app:

```bash
cd frontend
npm run build          # 1. rebuild the web bundle into dist/
npx cap sync android   # 2. copy dist/ + plugin config into android/

cd android
# Windows (PowerShell), pointing at the JBR JDK as above:
.\gradlew.bat assembleDebug --console=plain
# macOS/Linux:
./gradlew assembleDebug

# APK lands at android/app/build/outputs/apk/debug/app-debug.apk

adb install -r app/build/outputs/apk/debug/app-debug.apk
adb shell am force-stop com.chatapp.mobile
adb shell monkey -p com.chatapp.mobile -c android.intent.category.LAUNCHER 1
```

If you only changed `frontend/android/*` (native config, manifest, gradle files) and not the web source, you can skip the `npm run build`/`cap sync` steps and just re-run Gradle.

`frontend/capacitor.config.json` controls the app ID (`com.chatapp.mobile`), display name, and which native plugin providers are bundled (`SocialLogin.providers` — only `google` is enabled; `facebook`/`apple`/`twitter` are disabled to keep the APK smaller and avoid Facebook's `AD_ID` permission).

### 16.4 Google Sign-In on Android

The app uses **Android's native Credential Manager** (via `@capgo/capacitor-social-login`) instead of a browser-redirect OAuth flow, because **Google blocks OAuth sign-in from embedded WebViews** (`Error 403: disallowed_useragent`) — this is why the web GIS "Sign in with Google" button (`LoginPage.jsx`/`SignUpPage.jsx`) is explicitly hidden when `Capacitor.isNativePlatform()` is true, and a separate native button calls `SocialLogin.login(...)` instead.

Getting this working from a fresh clone needs one extra piece of Google Cloud Console config beyond the Web client the backend already uses:

1. In the **same** Google Cloud project as your Web OAuth client, create a second OAuth client of type **Android**.
2. Package name: `com.chatapp.mobile`.
3. SHA-1 fingerprint of whichever keystore signs the build you're installing:
   ```bash
   # Debug builds (the default from `assembleDebug` above):
   keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android
   # look for the "SHA1:" line
   ```
   A release build needs its own SHA-1 registered from its own keystore (and again from Play App Signing's certificate, if distributed via Play Store) — the debug SHA-1 above only authorizes debug-signed installs.
4. That's it on the Google Cloud side — the Android client isn't referenced anywhere in code (no client ID/secret to paste in). Its mere existence (tied to package name + SHA-1) is what authorizes the app to use Sign-In; the actual ID token returned to the app is still requested against the **Web** Client ID (`VITE_GOOGLE_CLIENT_ID`, passed as `webClientId` in `SocialLogin.initialize(...)`), so it's verified by the exact same `/auth/google` backend endpoint the web flow uses. No backend changes needed for the mobile app specifically.
5. `frontend/src/pages/LoginPage.jsx` / `SignUpPage.jsx` call `SocialLogin.login({ provider: 'google', options: {} })` — **do not** pass a `scopes` option here; the plugin throws `"You CANNOT use scopes without modifying the main activity"` unless `MainActivity` is customized for it, and it isn't needed — `email`/`profile`/`email_verified` are already in the default ID token.

### 16.5 Troubleshooting notes (things that actually came up)

- **`Unsupported class file major version 70`** building with Gradle → your `JAVA_HOME` is pointing at too new a JDK. Use Android Studio's bundled JBR (§16.1).
- **`Duplicate class kotlin.collections.jdk8.CollectionsJDK8Kt ...`** (or similar `kotlin-stdlib-jdk7`/`jdk8` conflicts) → different native plugins pull in different Kotlin stdlib versions. Already fixed via a `configurations.all { exclude group: 'org.jetbrains.kotlin', module: 'kotlin-stdlib-jdk7' / 'kotlin-stdlib-jdk8' }` block in `android/app/build.gradle`; if a new plugin reintroduces this, that's the fix.
- **`Dependency 'androidx.browser:browser:...' requires compileSdk 36 / AGP 8.9.1+`** → bump `compileSdkVersion` in `android/variables.gradle` and the `com.android.tools.build:gradle` classpath version in `android/build.gradle` accordingly (already done once this repo added `@capgo/capacitor-social-login`; a future plugin bump may ask for this again).
- **Google API calls from the app return CORS errors / "Not allowed by CORS"** → the backend's `ALLOWED_ORIGIN` env var doesn't include `https://localhost` (the Capacitor Android app's origin). Add it and **redeploy** — on Render specifically, changing an env var and just *restarting* the service does **not** pick up the new value; it needs an actual redeploy (a restart reuses the previous env snapshot).
- **`[28444] Developer console is not set up correctly`** (native Google Sign-In) → the installed APK's signing certificate SHA-1, package name, or `webClientId` doesn't match what's registered in Google Cloud Console. Check Logcat for `GoogleProvider` — it logs the exact `package`, `signingSha1`, and `webClientId` the app is using, to diff against the Android OAuth client's config.
- **A phone connected via USB shows as `unauthorized` in `adb devices`** → check the phone's screen for the "Allow USB debugging?" prompt and accept it; it can take a couple of seconds to appear.
- **The app doesn't reflect a code change** → you edited frontend source but skipped `npm run build` and/or `npx cap sync android` before rebuilding with Gradle — the native project only sees whatever is in `frontend/dist/` at the last sync, not live source.

### 16.6 Offline behavior

The frontend also has an offline-first cache (`frontend/src/lib/db.js`, IndexedDB via Dexie) that applies on both the web and the Android app equally — chats/messages paint instantly from the last sync while the network confirms in the background, sends made while offline queue and auto-flush on reconnect, and the whole cache for an account is wiped on logout. This is app code, not Capacitor-specific, so there's nothing extra to configure for it — it's mentioned here only because it's most noticeable on mobile.
