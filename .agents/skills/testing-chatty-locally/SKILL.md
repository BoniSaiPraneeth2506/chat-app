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
`backend/lib/mailer.js` picks Resend (HTTPS `https://api.resend.com/emails`) when `RESEND_API_KEY` is set,
then falls back to nodemailer SMTP when `SMTP_USER`/`SMTP_PASS` are set.
- The Resend base URL is hardcoded; there is no env override. Least-invasive interception is a Node
  preload that patches `globalThis.fetch` to rewrite `https://api.resend.com` → a local stub, launched via
  `NODE_OPTIONS="--import file:///path/to/fetch-redirect.mjs" npm run dev`. (If the code ever gains a
  configurable base URL, prefer that.)
- SMTP: run a fake server with the `smtp-server` npm package on 127.0.0.1:1025 and set
  `SMTP_HOST=localhost SMTP_PORT=1025 SMTP_SECURE=false SMTP_USER=x SMTP_PASS=y`. Note the mailer always
  retries port 465 after the preferred port fails, so a failing-SMTP test ends with `ECONNREFUSED :::465`.
- Env vars must be exported in the shell that starts the backend; `dotenv` does not override existing env.
- Ready-made harness used previously lives in `/home/ubuntu/teststub/` (resend stub, fake SMTP,
  `run-backend.sh none|resend|fallback|bothfail`).

## Devin Secrets Needed
None — all email paths are testable with local stubs. Do not use real `RESEND_API_KEY` / `SMTP_*`.
