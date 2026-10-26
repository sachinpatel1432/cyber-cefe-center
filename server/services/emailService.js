
import nodemailer from "nodemailer";

const createTransporter = () => {
  const {
    SMTP_HOST,
    SMTP_PORT,
    SMTP_USER,
    SMTP_PASS,
    SMTP_SECURE,
  } = process.env;

  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
    throw new Error(
      "Email configuration missing: check SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS."
    );
  }

  return nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT),
    secure: SMTP_SECURE === "true",
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
};

export const verifyEmailTransport = async () => {
  const transporter = createTransporter();

  try {
    await transporter.verify();
    console.log("SMTP connection verified successfully.");
  } catch (error) {
    console.error("SMTP verification failed:", {
      code: error.code,
      responseCode: error.responseCode,
      message: error.message,
    });

    throw error;
  } finally {
    transporter.close();
  }
};

export const sendVerificationEmail = async ({
  email,
  fullName,
  token,
}) => {
  const clientUrl = process.env.CLIENT_URL;

  if (!clientUrl) {
    throw new Error("CLIENT_URL is not configured.");
  }

  const verificationUrl = new URL("/verify-email", clientUrl);
  verificationUrl.searchParams.set("token", token);

  const transporter = createTransporter();

  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Verify your Cyber Cafe Center account",
      text: [
        `Hello ${fullName},`,
        "",
        "Please verify your email address using this link:",
        verificationUrl.toString(),
        "",
        "This link expires in 30 minutes.",
        "If you did not create this account, you can ignore this email.",
      ].join("\n"),
      html: `
        <p>Hello ${escapeHtml(fullName)},</p>
        <p>Please verify your email address to activate your account.</p>
        <p>
          <a href="${escapeHtml(verificationUrl.toString())}">
            Verify email address
          </a>
        </p>
        <p>This link expires in 30 minutes.</p>
        <p>If you did not create this account, you can ignore this email.</p>
      `,
    });
  } catch (error) {
    console.error("Verification email failed:", {
      code: error.code,
      responseCode: error.responseCode,
      command: error.command,
      message: error.message,
    });

    throw error;
  } finally {
    transporter.close();
  }
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[char];
  });
}




export const sendPasswordResetEmail = async ({
  email,
  fullName,
  token,
}) => {
  const clientUrl = process.env.CLIENT_URL;

  if (!clientUrl) {
    throw new Error("CLIENT_URL is not configured.");
  }

  const resetUrl = new URL("/reset-password", clientUrl);
  resetUrl.searchParams.set("token", token);

  const transporter = createTransporter();

  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Reset your CyberDesk password",
      text: [
        `Hello ${fullName},`,
        "",
        `Reset your password using this link: ${resetUrl.toString()}`,
        "",
        "This link expires in 15 minutes.",
        "If you did not request this, ignore this email.",
      ].join("\n"),
      html: `
        <p>Hello ${escapeHtml(fullName)},</p>
        <p>You requested to reset your CyberDesk password.</p>
        <p>
          <a href="${escapeHtml(resetUrl.toString())}">
            Reset password
          </a>
        </p>
        <p>This link expires in 15 minutes.</p>
        <p>If you did not request this, ignore this email.</p>
      `,
    });
  } catch (error) {
    console.error("Password reset email failed:", {
      code: error.code,
      responseCode: error.responseCode,
      message: error.message,
    });

    throw error;
  } finally {
    transporter.close();
  }
};



export const sendEmailChangeVerificationEmail = async ({
  email,
  fullName,
  token,
}) => {
  const clientUrl = process.env.CLIENT_URL;

  if (!clientUrl) {
    throw new Error("CLIENT_URL is not configured.");
  }

  const verifyUrl = new URL("/verify-email-change", clientUrl);
  verifyUrl.searchParams.set("token", token);

  const transporter = createTransporter();

  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Verify your new CyberDesk email",
      text: [
        `Hello ${fullName},`,
        "",
        `Verify your new email address using this link: ${verifyUrl.toString()}`,
        "",
        "This link expires in 15 minutes.",
      ].join("\n"),
      html: `
        <p>Hello ${escapeHtml(fullName)},</p>
        <p>Confirm your new email address for CyberDesk.</p>
        <p>
          <a href="${escapeHtml(verifyUrl.toString())}">
            Verify new email
          </a>
        </p>
        <p>This link expires in 15 minutes.</p>
      `,
    });
  } catch (error) {
    console.error("Email change verification failed:", {
      code: error.code,
      responseCode: error.responseCode,
      message: error.message,
    });

    throw error;
  } finally {
    transporter.close();
  }
};

export const sendStaffInvitationEmail = async ({
  email,
  fullName,
  token,
}) => {
  const clientUrl = process.env.CLIENT_URL;

  if (!clientUrl) {
    throw new Error("CLIENT_URL is not configured.");
  }

  const setupUrl = new URL("/staff/setup", clientUrl);
  setupUrl.searchParams.set("token", token);

  const transporter = createTransporter();

  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM || process.env.SMTP_USER,
      to: email,
      subject: "Your CyberDesk Staff Account Invitation",

      text: [
        `Hello ${fullName},`,
        "",
        "An administrator has created a CyberDesk staff account for you.",
        "Use the link below to verify your email and set your password:",
        setupUrl.toString(),
        "",
        "This invitation expires in 24 hours and can only be used once.",
        "If you were not expecting this invitation, you can ignore this email.",
        "",
        "CyberDesk Team",
      ].join("\n"),

      html: `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#1f2937">
          <h2>Welcome to CyberDesk</h2>

          <p>Hello ${escapeHtml(fullName)},</p>

          <p>
            An administrator has created a staff account for you.
          </p>

          <p>
            Click below to verify your email and set your password.
          </p>

          <p style="margin:28px 0">
            <a
              href="${escapeHtml(setupUrl.toString())}"
              style="background:#2563eb;color:white;padding:12px 20px;text-decoration:none;border-radius:8px;display:inline-block"
            >
              Set Up My Account
            </a>
          </p>

          <p>This invitation expires in 24 hours and can only be used once.</p>

          <p>
            If you weren't expecting this invitation, you can ignore this email.
          </p>

          <p>CyberDesk Team</p>
        </div>
      `,
    });

    console.log("Staff invitation email sent successfully.");
  } catch (error) {
    console.error("Staff invitation email failed:", {
      code: error.code,
      responseCode: error.responseCode,
      message: error.message,
    });

    throw error;
  } finally {
    transporter.close();
  }
};
// // function escapeHtml(value = "") {
// //   return String(value).replace(/[&<>"']/g, (character) => ({
// //     "&": "&amp;",
// //     "<": "&lt;",
// //     ">": "&gt;",
// //     '"': "&quot;",
// //     "'": "&#39;",
// //   })[character]);
// // }