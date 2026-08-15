const BROWSERS = [
  [/Edg\//i, "Edge"],
  [/OPR\/|Opera/i, "Opera"],
  [/SamsungBrowser/i, "Samsung Internet"],
  [/Chrome\//i, "Chrome"],
  [/CriOS/i, "Chrome"],
  [/Firefox\/|FxiOS/i, "Firefox"],
  [/Safari\//i, "Safari"],
];

const OPERATING_SYSTEMS = [
  [/Windows NT 10/i, "Windows 10/11"],
  [/Windows/i, "Windows"],
  [/Android/i, "Android"],
  [/iPhone|iPad|iPod/i, "iOS"],
  [/Mac OS X/i, "macOS"],
  [/CrOS/i, "ChromeOS"],
  [/Linux/i, "Linux"],
];

const match = (table, userAgent, fallback) => {
  const found = table.find(([pattern]) => pattern.test(userAgent));
  return found ? found[1] : fallback;
};

/** Best-effort user-agent parsing — avoids pulling in a UA parsing dependency. */
export const parseUserAgent = (userAgent = "") => ({
  browser: match(BROWSERS, userAgent, "Unknown browser"),
  os: match(OPERATING_SYSTEMS, userAgent, "Unknown OS"),
  device: /Mobi|Android|iPhone|iPod/i.test(userAgent)
    ? "Mobile"
    : /iPad|Tablet/i.test(userAgent)
      ? "Tablet"
      : "Desktop",
});

export const getClientIp = (req) => {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "";
};

export const buildSession = (req, sid) => {
  const userAgent = req.headers["user-agent"] || "";
  return {
    sid,
    ip: getClientIp(req),
    userAgent,
    ...parseUserAgent(userAgent),
    createdAt: new Date(),
    lastActive: new Date(),
  };
};
