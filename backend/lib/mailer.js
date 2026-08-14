import nodemailer from "nodemailer";

const hasSmtpConfig = () => Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);

export const sendPasswordResetOtp = async (to, otp) => {
  if (!hasSmtpConfig()) {
    console.log(`[DEV] Password reset OTP for ${to}: ${otp}`);
    return { sent: false };
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_FROM || process.env.SMTP_USER,
    to,
    subject: "Your Chatty password reset code",
    text: `Your password reset code is ${otp}. It expires in 10 minutes. If you did not request this, you can ignore this email.`,
    html: `
      <p>Your password reset code is:</p>
      <p style="font-size:24px;letter-spacing:4px;font-weight:bold">${otp}</p>
      <p>This code expires in 10 minutes.</p>
      <p>If you did not request a password reset, you can ignore this email.</p>
    `,
  });

  return { sent: true };
};
