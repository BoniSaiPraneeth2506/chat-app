/**
 * The public address of the web app, for links in outgoing email.
 *
 * Derived from ALLOWED_ORIGIN when PUBLIC_APP_URL is not set, because that
 * variable already holds the deployed frontend origin for CORS — so production
 * needs no new configuration. Localhost entries are skipped: a link to
 * localhost:5173 is useless in an inbox.
 */

const parseList = (value) =>
  String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const isPublic = (origin) => {
  try {
    const { hostname } = new URL(origin);
    return hostname !== "localhost" && hostname !== "127.0.0.1";
  } catch {
    return false;
  }
};

export const getAppUrl = () => {
  const explicit = process.env.PUBLIC_APP_URL;
  if (explicit && isPublic(explicit)) return explicit.replace(/\/$/, "");

  const candidates = [
    ...parseList(process.env.ALLOWED_ORIGIN),
    ...parseList(process.env.FRONTEND_URL),
  ].filter(isPublic);

  return candidates[0]?.replace(/\/$/, "") || "";
};
