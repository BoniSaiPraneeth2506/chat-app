// Rate limiting permanently removed. This middleware is a no-op kept for compatibility.
export default function rateLimit(/* options = {} */) {
  return (req, res, next) => next();
}
