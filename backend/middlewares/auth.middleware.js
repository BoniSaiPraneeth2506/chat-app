import jwt from 'jsonwebtoken'
import User from '../models/user.model.js'

const LAST_ACTIVE_REFRESH_MS = 60 * 1000;

const protectRoute = async (req, res, next) => {
  try {
    let token = req.cookies.jwt;
    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization;
      if (authHeader.startsWith("Bearer ")) {
        token = authHeader.split(" ")[1];
      }
    }

    if (!token) {
      return res.status(401).json({ message: "Unauthorized: No token provided" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (jwtErr) {
      if (
        jwtErr.name === "TokenExpiredError" ||
        jwtErr.name === "JsonWebTokenError" ||
        jwtErr.name === "NotBeforeError"
      ) {
        return res.status(401).json({ message: "Unauthorized: Invalid or expired token" });
      }
      throw jwtErr; // unexpected JWT error — bubble up to outer catch
    }

    const user = await User.findById(decoded.userId).select("-password");
    if (!user) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }

    // Tokens issued before device sessions existed carry no sid and stay valid.
    if (decoded.sid) {
      const session = user.sessions?.find((s) => s.sid === decoded.sid);
      if (!session) {
        return res.status(401).json({ message: "Unauthorized: Session has been logged out" });
      }
      req.sessionId = decoded.sid;
      if (Date.now() - new Date(session.lastActive).getTime() > LAST_ACTIVE_REFRESH_MS) {
        User.updateOne(
          { _id: user._id, "sessions.sid": decoded.sid },
          { $set: { "sessions.$.lastActive": new Date() } }
        ).catch((err) => console.error("Error updating session lastActive:", err.message));
      }
    }

    req.user = user;
    next();

  } catch (err) {
    console.error("Error in protectRoute middleware:", err.message);
    res.status(500).json({ message: "Internal server error" });
  }
};

export default protectRoute;