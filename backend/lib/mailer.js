import nodemailer from "nodemailer";

const hasSmtpConfig = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

const hasResendConfig = () => Boolean(process.env.RESEND_API_KEY);

const hasBrevoConfig = () => Boolean(process.env.BREVO_API_KEY);

// Splits "Chatty <no-reply@example.com>" into its name and email parts.
const parseFrom = (from) => {
  const match = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(from || "");
  return match ? { name: match[1] || undefined, email: match[2] } : { email: from };
};

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
  const baseUrl = (process.env.RESEND_BASE_URL || "https://api.resend.com").replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/emails`, {
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

const sendViaBrevo = async (to, otp) => {
  const { subject, text, html, from } = mailOptions(to, otp);
  const baseUrl = (process.env.BREVO_BASE_URL || "https://api.brevo.com/v3").replace(/\/$/, "");
  const res = await fetch(`${baseUrl}/smtp/email`, {
    method: "POST",
    headers: {
      "api-key": process.env.BREVO_API_KEY,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: parseFrom(from),
      to: [{ email: to }],
      subject,
      textContent: text,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    throw new Error(`Brevo API responded ${res.status}: ${await res.text()}`);
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

// HTTP providers are tried before SMTP because several hosts (e.g. Render's
// free tier) block outbound SMTP ports, which makes nodemailer time out there.
const HTTP_PROVIDERS = [
  { name: "Brevo", isConfigured: hasBrevoConfig, send: sendViaBrevo },
  { name: "Resend", isConfigured: hasResendConfig, send: sendViaResend },
];

export const sendPasswordResetOtp = async (to, otp) => {
  const providers = HTTP_PROVIDERS.filter((p) => p.isConfigured());

  if (providers.length === 0 && !hasSmtpConfig()) {
    console.log(`[DEV] Password reset OTP for ${to}: ${otp}`);
    return { sent: false };
  }

  let lastError;

  for (const provider of providers) {
    try {
      await provider.send(to, otp);
      return { sent: true };
    } catch (err) {
      lastError = err;
      console.error(`${provider.name} send failed:`, err.message);
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
