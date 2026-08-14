const LOCAL_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5001",
];

const parseOriginList = (value) =>
  String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const getAllowedOrigins = () => [
  ...LOCAL_ORIGINS,
  ...parseOriginList(process.env.ALLOWED_ORIGIN),
  ...parseOriginList(process.env.FRONTEND_URL),
];

export const isOriginAllowed = (origin) => {
  if (process.env.NODE_ENV !== "production") return true;
  if (!origin) return true;
  if (getAllowedOrigins().includes(origin)) return true;
  try {
    const { protocol, hostname } = new URL(origin);
    return protocol === "https:" && hostname.endsWith(".onrender.com");
  } catch {
    return false;
  }
};
