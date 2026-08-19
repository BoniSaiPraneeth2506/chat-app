import { fetchGiphy, isGiphyConfigured } from "../lib/giphy.js";

/**
 * The picker's only endpoint.
 *
 * Signed-in callers only: an open proxy would let anyone spend this account's
 * free-tier quota. Errors come back as a sentence a person can read — the
 * upstream status and the key never leave the server.
 */
export const getGiphy = async (req, res) => {
  try {
    if (!isGiphyConfigured()) {
      return res.status(503).json({
        message: "GIFs are not set up on this server yet",
        configured: false,
      });
    }

    const kind = req.query.type === "stickers" ? "stickers" : "gifs";
    const query = typeof req.query.q === "string" ? req.query.q : "";

    const { items } = await fetchGiphy({ kind, query });
    res.status(200).json({ configured: true, kind, query: query.trim(), items });
  } catch (error) {
    console.error("Error in getGiphy:", error.code || "", error.message);

    if (error.code === "not_configured") {
      return res.status(503).json({ message: "GIFs are not set up on this server yet", configured: false });
    }
    if (error.code === "rate_limited") {
      return res.status(429).json({ message: "Too many GIF searches just now — try again in a moment" });
    }
    res.status(502).json({ message: "Could not reach GIPHY. Try again in a moment." });
  }
};
