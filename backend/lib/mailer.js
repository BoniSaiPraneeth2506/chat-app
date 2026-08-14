import nodemailer from "nodemailer";

const hasSmtpConfig = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

const SMTP_TIMEOUT_MS = 15_000;

const createTransporter = ({ port, secure }) =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });

const mailOptions = (to, otp) => ({
  from: process.env.EMAIL_FROM || process.env.SMTP_USER,
  to,
  subject: "Your Chatty password reset code",
  text: `Your password reset code is ${otp}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
  html: `
    <p>Your password reset code is:</p>
    <p style="font-size:24px;letter-spacing:4px;font-weight:bold">${otp}</p>
    <p>This code expires in 10 minutes.</p>
    <p>If you did not request this, you can ignore this email.</p>
  `,
});

export const sendPasswordResetOtp = async (to, otp) => {
  if (!hasSmtpConfig()) {
    console.log(`[DEV] Password reset OTP for ${to}: ${otp}`);
    return { sent: false };
  }

  const preferredPort = Number(process.env.SMTP_PORT) || 587;
  const preferredSecure = process.env.SMTP_SECURE === "true" || preferredPort === 465;
  const attempts = [
    { port: preferredPort, secure: preferredSecure },
    { port: 465, secure: true },
  ].filter((a, i, arr) => arr.findIndex((b) => b.port === a.port && b.secure === a.secure) === i);

  let lastError;
  for (const attempt of attempts) {
    try {
      const transporter = createTransporter(attempt);
      await transporter.sendMail(mailOptions(to, otp));
      return { sent: true };
    } catch (err) {
      lastError = err;
      console.error(`SMTP send failed on port ${attempt.port}:`, err.message);
    }
  }

  throw lastError;
};
