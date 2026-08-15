---
name: testing-chatty-locally
description: How to run the Chatty MERN app locally (Mongo, backend, frontend) and how to exercise the password-reset email paths (Resend HTTP API / SMTP fallback / dev OTP) without real credentials.
---

# Running Chatty locally for end-to-end testing

## Services
1. MongoDB: no mongod on the box; use docker — `docker run -d --name mongo -p 27017:27017 mongo:7`.
2. Backend: `cd backend && npm install`, create `backend/.env`:
   ```
   PORT=5001
   MONGO_URI=mongodb://localhost:27017/chatty
   JWT_SECRET=testsecret123
   NODE_ENV=development
   ```
   `PORT` has no default — must be 5001 or the frontend can't reach it. Then `npm run dev`.
   Wait for both `server running on port 5001` and `MongoDB Connected` (a DB failure is only logged, not fatal).
3. Frontend: `cd frontend && npm run dev` → http://localhost:5173. Do NOT create `frontend/.env`
   (a `VITE_API_URL` would point the dev server at the deployed Render backend).

## Known dependency breakage (may recur)
A fresh `npm install` in `backend/` can pull `htmlparser2@12` (ESM) under `sanitize-html`, and the server
crashes at boot with `ERR_REQUIRE_ESM ... htmlparser2/dist/index.js`. Workaround that keeps git clean:
```
cd backend
npm install --no-save htmlparser2@8
rm -rf node_modules/sanitize-html/node_modules   # nested copy pins v12
```
Verify with `node -e "import('sanitize-html').then(()=>console.log('ok'))"`. nodemon does not watch
node_modules — restart the backend after this fix.

## Password reset UI path
Login page (`/login`) → "Forgot password?" link (right of the Password label) → email field →
"Send reset code" → reset view with "Reset code" / "New password" / "Confirm password" → "Reset password".
The email input is shared with the login form, so it keeps its previous value — select-all before typing.
With no email provider configured, the backend returns `devOtp` and the frontend prefills the code field
and toasts `Dev code: NNNNNN`; the same code is printed in the backend log as
`[DEV] Password reset OTP for <email>: <otp>`.

## Testing the email providers without real credentials
`backend/lib/mailer.js` tries HTTP providers in order Brevo (`BREVO_API_KEY`) → Resend (`RESEND_API_KEY`),
then falls back to nodemailer SMTP when `SMTP_USER`/`SMTP_PASS` are set.
- Both HTTP providers honour base-URL env overrides, so point them straight at local stubs — no fetch
  preload hack needed:
  `BREVO_BASE_URL=http://127.0.0.1:8788/v3` (mailer POSTs `${BREVO_BASE_URL}/smtp/email`, header
  `api-key: <BREVO_API_KEY>`, body `{ sender:{name,email}, to:[{email}], subject, textContent, htmlContent }`)
  and `RESEND_BASE_URL=http://127.0.0.1:8787` (POSTs `${RESEND_BASE_URL}/emails`, `Authorization: Bearer`,
  body `{ from, to:[..], subject, text, html }`).
  If a future provider lacks such an override, the fallback trick is a Node preload patching
  `globalThis.fetch`, launched via `NODE_OPTIONS="--import file:///path/to/fetch-redirect.mjs" npm run dev`.
- `EMAIL_FROM="Chatty <no-reply@chatty.test>"` is split by `parseFrom` into Brevo's `sender {name,email}`;
  a bare address yields just `{ email }`. Assert on this in the stub log.
- A single generic stub server that logs method/URL/headers/body to a file and reads an `ok|fail` mode
  file per provider makes it cheap to drive the whole chain (success, 500 fallthrough, all-fail).
- To distinguish provider order, assert the *next* provider's log gained no entry when an earlier one
  succeeded, and that backend logs `<Provider> send failed: ... 500` when it did fall through.
- SMTP: run a fake server with the `smtp-server` npm package on 127.0.0.1:1025 and set
  `SMTP_HOST=localhost SMTP_PORT=1025 SMTP_SECURE=false SMTP_USER=x SMTP_PASS=y`. Note the mailer always
  retries port 465 after the preferred port fails, so a failing-SMTP test ends with `ECONNREFUSED :::465`.
- Env vars must be exported in the shell that starts the backend; `dotenv` does not override existing env.
- Ready-made harness used previously lives in `/home/ubuntu/teststub/` (`http-stub.mjs <brevo|resend> <port>`,
  `fake-smtp.mjs`, `run-backend.sh none|brevo|brevofail|httpfail|allfail`, plus `*-mode.txt` files holding
  `ok`/`fail`). Start all stub listeners BEFORE running a fallthrough scenario — a missing listener produces
  `fetch failed` and looks like an app failure when it is only a harness gap.

## Multi-user / multi-session UI testing
- Use one normal Chrome window + one incognito window (separate cookie jars) so two users — or the same
  user on "two devices" — can be driven side by side. Two side-by-side ~500px windows are enough to see
  live socket updates in both at once.
- Beware the responsive breakpoints: the desktop message hover bar (reactions / reply / forward) is
  `hidden lg:flex`, so in a narrow window it never appears. In narrow windows tap the bubble once to get
  the mobile action bar instead (leftmost icon = Reply), or maximize the window with
  `wmctrl -r :ACTIVE: -b add,maximized_vert,maximized_horz`.
- Group creation is `POST /api/groups/` (NOT `/api/groups/create`). Creating users/groups over the API for
  setup adds extra "Unknown browser on Unknown OS" rows to the session list — expect them.
- Backend stdout when started via nodemon usually lands in `/tmp/backend.log`; if unsure,
  `ls -l /proc/<pid>/fd/1`. Grep it for `[DEV] Password reset OTP`, `Error in sendMessage`, etc.

## Known local limitation: image upload
`backend/.env` has no Cloudinary credentials, so any image/voice/wallpaper upload fails with
`Error in sendMessage: Error: Must supply api_key` and the message silently never appears (the sidebar may
briefly show an optimistic "Image" preview). Image-send regression cannot be verified locally without
`CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET`.

## Polls / formatting / device-session features (PR #4 onward)
- Poll button (bar-chart icon) in the message input is rendered only when a group is selected; 1:1 chats
  show only the image + Type (A) buttons.
- Poll percentages are per participant, not per vote, so in a multiple-answer poll one voter picking two
  options shows 100% on both with `1 participant`.
- Formatting toolbar: click Type (A) to reveal B / I / S / `<>`; select text in the input, then click a
  mark to wrap it. Verify by the SENT bubble (its `aria-label` holds the raw text, e.g. `*toolbar*`) —
  reading the input via zoomed screenshots can show stale pixels and lead to false "it did not wrap"
  conclusions. Clicking a mark twice yields `**text**`, which renders bold with literal asterisks.
- Device sessions live in Settings → "Active Sessions & Devices". Revoking another device emits socket
  `sessionRevoked`; the other window toasts "This device was logged out from another session" and
  redirects to `/login` within a second, and its stored token is then rejected.
- Backend-only assertions worth a curl check: a legacy JWT signed with only `{userId}` (no `sid`) is still
  accepted by `GET /api/auth/check`; a non-member gets 403 `You are not a member of this group` on
  `POST /api/groups/:id/polls`; voting a closed poll gets 403 `This poll is closed`.

## Devin Secrets Needed
None for email paths — all testable with local stubs. Do not use real `RESEND_API_KEY` / `SMTP_*`.
Image upload testing would need `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
