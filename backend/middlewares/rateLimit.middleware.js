// Simple per-user token-bucket style rate limiter.
// For production, prefer Redis-backed rate limiting.

const buckets = new Map(); // userId => { tokens, lastRefill }

const DEFAULT_CAPACITY = 60; // tokens
const DEFAULT_REFILL_INTERVAL_MS = 60 * 1000; // refill interval
const DEFAULT_REFILL_TOKENS = 60; // tokens per interval

function getBucket(userId, opts) {
  const key = userId.toString();
  if (!buckets.has(key)) {
    buckets.set(key, { tokens: opts.capacity || DEFAULT_CAPACITY, lastRefill: Date.now() });
  }
  return buckets.get(key);
}

export default function rateLimit(options = {}) {
  const capacity = options.capacity || DEFAULT_CAPACITY;
  const refillInterval = options.refillIntervalMs || DEFAULT_REFILL_INTERVAL_MS;
  const refillTokens = options.refillTokens || DEFAULT_REFILL_TOKENS;
  const cost = options.cost || 1;

  return (req, res, next) => {
    try {
      const userId = req.user && req.user._id ? req.user._id.toString() : req.ip;
      const bucket = getBucket(userId, { capacity });
      const now = Date.now();
      const elapsed = now - bucket.lastRefill;
      if (elapsed > 0) {
        const periods = Math.floor(elapsed / refillInterval);
        if (periods > 0) {
          bucket.tokens = Math.min(capacity, bucket.tokens + periods * refillTokens);
          bucket.lastRefill = now;
        }
      }

      if (bucket.tokens >= cost) {
        bucket.tokens -= cost;
        return next();
      }

      res.status(429).json({ message: "Rate limit exceeded. Slow down." });
    } catch (err) {
      console.error("Rate limiter error", err);
      next();
    }
  };
}
