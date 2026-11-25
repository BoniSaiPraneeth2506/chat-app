const SHARE_PARAMS = ["share", "title", "text", "url", "files"];

const toFile = (value) => {
  if (!value || typeof File === "undefined") return null;
  let name = "shared-file";
  let type = "application/octet-stream";
  let bytes = "";
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      name = parsed.name || name;
      type = parsed.type || type;
      bytes = parsed.bytes || "";
    } catch {
      bytes = value.startsWith("data:") ? value.split(",")[1] || "" : value;
    }
  } else {
    name = value.name || name;
    type = value.type || type;
    bytes = value.bytes || "";
  }
  if (!bytes) return null;
  try {
    const binary = atob(bytes);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buffer[i] = binary.charCodeAt(i);
    return new File([buffer], name, { type });
  } catch {
    return null;
  }
};

const normalizeDetail = (raw) => ({
  text: raw?.text || "",
  url: raw?.url || "",
  files: Array.isArray(raw?.files) ? raw.files.map(toFile).filter(Boolean) : [],
});

const dispatchShare = (raw) => {
  const detail = normalizeDetail(raw);
  window.dispatchEvent(new CustomEvent("chatty:share", { detail }));
};

const cleanShareParams = () => {
  const url = new URL(window.location.href);
  SHARE_PARAMS.forEach((key) => url.searchParams.delete(key));
  window.history.replaceState(null, document.title, url.pathname + url.search + url.hash);
};

export const parseShareTarget = () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("share") === "1") {
    const text = params.get("text") || params.get("title") || "";
    const url = params.get("url") || "";
    dispatchShare({ text: [text, url].filter(Boolean).join("\n"), url, files: params.getAll("files") });
    cleanShareParams();
  }
  const pending = window.AndroidBridge?.takePendingShare?.();
  if (pending) {
    try {
      dispatchShare(JSON.parse(pending));
    } catch {
      return;
    }
  }
};

if (typeof navigator !== "undefined" && navigator.serviceWorker?.addEventListener) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "chatty:share") dispatchShare(event.data.detail);
  });
}
