// ── Centralized notification tap navigation ──────────────────────────────────
//
// Every notification tap — foreground (local), background, or cold-start from
// the drawer — funnels through THIS module. That is deliberate: a tap can
// arrive while the app is still booting (auth not restored, router not wired),
// and routing too early loses it. So we hold the target until BOTH the router
// is available AND the session is authenticated, then navigate exactly once.
//
// The navigation target is read from the structured `conversationId` in the
// notification `data` payload — never from the title/body.

import { useGroupStore } from "../store/useGroupStore";

let navigateFn = null;
let authReady = false;
let pending = null;
let inFlight = false;

function log(...args) {
  console.log("[NotifyNav]", ...args);
}

/** Give the module the react-router navigate function (App mounts it). */
export function setNotificationNavigator(fn) {
  navigateFn = fn;
  log("[Router] ready");
  tryNavigate();
}

/** Tell the module when authentication has (or hasn't) been restored. */
export function setAuthReady(ready) {
  authReady = Boolean(ready);
  log(`[Auth] ready = ${authReady}`);
  tryNavigate();
}

/** Drop any held tap + in-flight nav (e.g. on logout / session end). */
export function resetNotificationNavigation() {
  if (pending) log("clearing pending:", JSON.stringify(pending));
  pending = null;
  inFlight = false;
}

/**
 * Central entry point for a notification tap. `data` is the structured FCM
 * payload: { type, conversationId, messageId, senderId, ... }.
 */
export function handleNotificationTap(data) {
  const payload = {
    type: data?.type || "",
    conversationId: data?.conversationId ? String(data.conversationId) : "",
    messageId: data?.messageId ? String(data.messageId) : "",
    senderId: data?.senderId ? String(data.senderId) : "",
  };

  log("[React] notification tap received:", JSON.stringify(payload));

  if (!payload.conversationId) {
    log("no conversationId — ignoring tap", JSON.stringify(payload));
    return;
  }

  pending = payload;
  log("[Pending] stored:", JSON.stringify(payload));
  tryNavigate();
}

function tryNavigate() {
  if (!pending || inFlight) {
    if (inFlight) log("navigation already in flight — ignoring duplicate");
    return;
  }
  if (!authReady) {
    log("[Auth] not ready yet — pending held for navigation");
    return;
  }
  if (!navigateFn) {
    log("[Router] not ready yet — pending held for navigation");
    return;
  }

  const target = pending;
  pending = null; // consume the tap exactly once
  inFlight = true;
  log("[Navigate] opening conversation", target.conversationId, "type", target.type || "dm");
  run(target).finally(() => {
    inFlight = false;
    // A tap that arrived while a navigation was in flight may still be held;
    // retry so it isn't silently swallowed.
    tryNavigate();
  });
}

async function run(target) {
  const { type, conversationId } = target;

  if (type === "group_message" || type === "mention") {
    const groupStore = useGroupStore.getState();
    const existing =
      groupStore.groups?.find((g) => String(g._id) === String(conversationId)) ||
      groupStore.selectedGroup;

    if (existing) {
      await openGroup(existing);
      return;
    }

    await groupStore.getGroups();
    const fresh = useGroupStore
      .getState()
      .groups?.find((g) => String(g._id) === String(conversationId));
    if (fresh) {
      await openGroup(fresh);
    } else {
      log("group not found, opening home");
      navigateFn("/");
    }
    return;
  }

  // DMs (chat_message / reply / reaction) + anything else carrying a
  // conversationId: open the exact conversation via the existing deep-link
  // route. conversationId for a DM IS the partner's user id.
  log("[Navigate] DM → /chat-with/" + conversationId);
  navigateFn(`/chat-with/${conversationId}`);
}

function openGroup(group) {
  useGroupStore.getState().setSelectedGroup(group);
  log("[Navigate] group → home with group", group._id);
  navigateFn("/");
}
