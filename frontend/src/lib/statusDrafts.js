// Status drafts, kept on this device.
//
// A draft is never uploaded. A half-written status is private by definition — it
// may name someone, be aimed at a close-friends-only audience, or be something
// the author changes their mind about — so there is nowhere it should be before
// they post it.
//
// It is also not a photo. A picked image or a recorded clip is a File, and a File
// cannot be put in localStorage. What is stored is the *recipe*: the editor
// mode, the text, the styling, the chosen privacy — plus a thumbnail data URL
// for layouts, small enough to survive in storage and enough to recognise a
// draft in the list. Re-picking the media after a reload is the author's one
// extra step, and is stated plainly in the UI rather than faked with a stale
// blob URL.
const DRAFTS_KEY = "chatty_status_drafts_v1";
const MAX_DRAFTS = 12;
const THUMB_MAX_EDGE = 240;

const canStore = () => {
  try {
    const probe = "__chatty_probe__";
    localStorage.setItem(probe, "1");
    localStorage.removeItem(probe);
    return true;
  } catch {
    // Private browsing, or a full quota. Drafts are a convenience, so the app
    // carries on without them.
    return false;
  }
};

const read = () => {
  if (!canStore()) return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(DRAFTS_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const write = (drafts) => {
  if (!canStore()) return;
  try {
    localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts.slice(0, MAX_DRAFTS)));
  } catch (err) {
    console.warn("Could not save status drafts:", err);
  }
};

export const draftKeyFor = (mode) => `${mode}`;

// Drafts are plain localStorage, so nothing else in the app knows when one
// changes. A custom event is the smallest thing that lets the Add Status list
// show and drop its draft badges without polling storage.
const CHANGED = "chatty:status-drafts-changed";
const announce = () => {
  try {
    window.dispatchEvent(new CustomEvent(CHANGED));
  } catch {
    // No window (tests, SSR) — drafts still work, just without live badges.
  }
};

/** Subscribe to any draft write. Returns an unsubscribe function. */
export const onStatusDraftsChanged = (handler) => {
  window.addEventListener(CHANGED, handler);
  return () => window.removeEventListener(CHANGED, handler);
};

export const listStatusDrafts = () =>
  read()
    .map((d) => ({
      ...d,
      // A draft older than a week is noise, not something to resume.
      stale: Date.now() - new Date(d.updatedAt || 0).getTime() > 7 * 24 * 60 * 60 * 1000,
    }))
    .sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));

/** Upserts one draft. `mode` is the identity, so re-saving an editor overwrites. */
export const saveStatusDraft = (mode, draft) => {
  const key = draftKeyFor(mode);
  const entry = {
    id: `${mode}-${Date.now()}`,
    mode,
    updatedAt: new Date().toISOString(),
    ...draft,
  };
  const rest = read().filter((d) => d.mode !== key);
  write([entry, ...rest]);
  announce();
  return entry;
};

export const getStatusDraft = (mode) => read().find((d) => d.mode === mode) || null;

export const deleteStatusDraft = (mode) => {
  write(read().filter((d) => d.mode !== mode));
  announce();
};

export const clearStatusDrafts = () => {
  write([]);
  announce();
};

/**
 * A small preview image for a draft entry.
 *
 * Downscaled hard on purpose: this goes into localStorage, and a full-resolution
 * photo there would blow the quota and take the app's other storage with it.
 */
export const makeDraftThumbnail = (file) =>
  new Promise((resolve) => {
    if (!file || !file.type?.startsWith("image/")) {
      resolve("");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = setTimeout(() => finish(""), 3000);
    img.onload = () => {
      try {
        const scale = Math.min(1, THUMB_MAX_EDGE / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        clearTimeout(timer);
        finish(canvas.toDataURL("image/jpeg", 0.5));
      } catch {
        clearTimeout(timer);
        finish("");
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      finish("");
    };
    img.src = url;
  });
