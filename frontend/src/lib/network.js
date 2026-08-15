// Small connectivity helpers shared by the stores. Kept separate from db.js
// so "is the network reachable" stays independent of "how we persist data".

// Axios only omits `error.response` when the request never got a reply at
// all (DNS/timeout/offline/CORS) — any completed HTTP response, even a 4xx
// or 5xx, always has one. That makes this the reliable way to tell "the
// server is unreachable" apart from "the server rejected this request".
export const isNetworkError = (error) => !error?.response;

// Notifies `onChange(isOnline)` whenever the browser's connectivity status
// changes, and once immediately with the current status. Returns an
// unsubscribe function.
export const subscribeOnlineStatus = (onChange) => {
  if (typeof window === "undefined") return () => {};

  const handleChange = () => onChange(navigator.onLine);
  window.addEventListener("online", handleChange);
  window.addEventListener("offline", handleChange);
  handleChange();

  return () => {
    window.removeEventListener("online", handleChange);
    window.removeEventListener("offline", handleChange);
  };
};
