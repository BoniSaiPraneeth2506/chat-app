import jwt from 'jsonwebtoken';

export const generateToken = (userId, res) => {
    
    const token = jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: "7d",  // Token valid for 7 days
    });

    res.cookie("jwt", token, {
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
        httpOnly: true,                  // Prevents client-side JS from accessing the cookie (XSS protection)
        sameSite: "strict",              // CSRF protection by restricting cross-site cookie sharing
        secure: process.env.NODE_ENV !== "development", // Send cookie only on HTTPS in production
    });

    return token;
};

