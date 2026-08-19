/**
 * GIPHY.
 *
 * The key stays here. Every request the client makes goes through this server,
 * which means the key never reaches a browser, a bundle, or the Android build —
 * and a client cannot spend the quota on anything but the two shapes of request
 * below.
 *
 * The account is on the free tier, so the request count matters more than
 * freshness: identical lookups are answered from memory for a few minutes rather
 * than asked again. A picker naturally repeats itself — the same trending list on
 * every open, the same query as someone retypes it — so this cuts most of the
 * traffic without the results ever looking stale.
 */

// Read at call time, not at module load. dotenv.config() runs in index.js after
// every import has already been evaluated, so a module-scope read here would
// capture undefined and never recover.
const apiKey = () => (process.env.GIPHY_API_KEY || "").trim();

export const isGiphyConfigured = () => Boolean(apiKey());

const BASE = "https://api.giphy.com/v1";

// Beta keys cap limit at 50; 24 fills the picker grid without asking for more
// than is shown.
const LIMIT = 24;
const QUERY_MAX = 50; // documented maximum for q
const CACHE_MS = 10 * 60 * 1000;
const CACHE_MAX = 120;

const cache = new Map(); // key -> { at, payload }

const fromCache = (key) => {
  const hit = cache.get(key);
  if (!hit) return null;
  if (Date.now() - hit.at > CACHE_MS) {
    cache.delete(key);
    return null;
  }
  return hit.payload;
};

const toCache = (key, payload) => {
  // Bounded, and oldest-first: a Map iterates in insertion order, so the first
  // key is the least recently written.
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), payload });
};

/**
 * The renditions a chat actually needs.
 *
 * `fixed_width` is 200px wide — right for a bubble, and small enough that it is
 * not a download. `fixed_width_small` is 100px, for the grid. Width and height
 * travel with them so the bubble can hold its size before the image arrives
 * instead of growing under the reader once it does.
 *
 * Falls back through the renditions rather than assuming any one is present:
 * `bundle=messaging_non_clips` returns a reduced set, and stickers do not carry
 * the same shapes as GIFs.
 */
const pick = (images, ...names) => {
  for (const name of names) {
    const rendition = images?.[name];
    if (rendition?.url) return rendition;
  }
  return null;
};

const normalise = (item) => {
  const images = item?.images || {};
  const full = pick(images, "fixed_width", "downsized", "fixed_height", "original");
  const thumb = pick(
    images,
    "fixed_width_small",
    "fixed_width_downsampled",
    "preview_gif",
    "fixed_width"
  );
  if (!full || !thumb) return null;

  const size = (rendition) => ({
    width: Number(rendition.width) || 0,
    height: Number(rendition.height) || 0,
  });

  return {
    id: String(item.id || ""),
    // Alt text where GIPHY has it, title otherwise: this is what a screen reader
    // reads out, and "GIF" alone says nothing.
    title: String(item.alt_text || item.title || "").slice(0, 120),
    url: full.url,
    ...size(full),
    // webp is a fraction of the bytes of the equivalent gif and animates in both
    // the browser and the Android WebView. The gif stays as the fallback.
    thumb: thumb.webp || thumb.url,
    thumbWidth: size(thumb).width,
    thumbHeight: size(thumb).height,
  };
};

/**
 * Trending, or a search, for either GIFs or stickers.
 *
 * `rating` is capped at pg: this is a chat app and the picker is one keystroke
 * away from anyone's conversation.
 */
export const fetchGiphy = async ({ kind = "gifs", query = "" } = {}) => {
  if (!isGiphyConfigured()) {
    const error = new Error("GIPHY is not configured");
    error.code = "not_configured";
    throw error;
  }

  const type = kind === "stickers" ? "stickers" : "gifs";
  const q = String(query || "").trim().slice(0, QUERY_MAX);
  const cacheKey = `${type}:${q.toLowerCase()}`;

  const cached = fromCache(cacheKey);
  if (cached) return { items: cached, cached: true };

  const params = new URLSearchParams({
    api_key: apiKey(),
    limit: String(LIMIT),
    rating: "pg",
    bundle: "messaging_non_clips",
  });
  if (q) params.set("q", q);

  const endpoint = `${BASE}/${type}/${q ? "search" : "trending"}?${params.toString()}`;

  const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
  if (!response.ok) {
    // The upstream body can carry the key back in an echoed request URL, so it is
    // never forwarded — only the status, and only into the server log.
    const error = new Error(`GIPHY responded ${response.status}`);
    error.code = response.status === 429 ? "rate_limited" : "upstream";
    throw error;
  }

  const body = await response.json();
  const items = (Array.isArray(body?.data) ? body.data : []).map(normalise).filter(Boolean);
  toCache(cacheKey, items);
  return { items, cached: false };
};

/**
 * Whether a URL is a GIPHY media address we are willing to store on a message.
 *
 * A GIF is kept as a link rather than copied into our own storage — it is already
 * hosted, permanently, and re-uploading every one would spend the image quota on
 * files GIPHY is serving anyway. That means a URL from the client ends up in the
 * database and then in other people's browsers, so the host is checked rather
 * than trusted: exact matches on GIPHY's media domains, nothing else.
 */
const GIPHY_HOSTS = new Set([
  "media.giphy.com",
  "media0.giphy.com",
  "media1.giphy.com",
  "media2.giphy.com",
  "media3.giphy.com",
  "media4.giphy.com",
  "i.giphy.com",
]);

export const isGiphyMediaUrl = (value) => {
  if (typeof value !== "string" || value.length > 400) return false;
  try {
    const { protocol, hostname } = new URL(value);
    return protocol === "https:" && GIPHY_HOSTS.has(hostname);
  } catch {
    return false;
  }
};
