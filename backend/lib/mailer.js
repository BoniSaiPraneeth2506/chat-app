import nodemailer from "nodemailer";

const hasSmtpConfig = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

const hasResendConfig = () => Boolean(process.env.RESEND_API_KEY);

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

const sendViaResend = async (to, otp) => {
  const { subject, text, html, from } = mailOptions(to, otp);
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: from || "onboarding@resend.dev",
      to: [to],
      subject,
      text,
      html,
    }),
  });

  if (!res.ok) {
    throw new Error(`Resend API responded ${res.status}: ${await res.text()}`);
  }
};

const sendViaSmtp = async (to, otp) => {
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
      return;
    } catch (err) {
      lastError = err;
      console.error(`SMTP send failed on port ${attempt.port}:`, err.message);
    }
  }

  throw lastError;
};

// Resend is tried first because several hosts (e.g. Render's free tier) block
// outbound SMTP ports, which makes nodemailer time out there.
export const sendPasswordResetOtp = async (to, otp) => {
  if (!hasResendConfig() && !hasSmtpConfig()) {
    console.log(`[DEV] Password reset OTP for ${to}: ${otp}`);
    return { sent: false };
  }

  let lastError;

  if (hasResendConfig()) {
    try {
      await sendViaResend(to, otp);
      return { sent: true };
    } catch (err) {
      lastError = err;
      console.error("Resend send failed:", err.message);
    }
  }

  if (hasSmtpConfig()) {
    try {
      await sendViaSmtp(to, otp);
      return { sent: true };
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError;
};
