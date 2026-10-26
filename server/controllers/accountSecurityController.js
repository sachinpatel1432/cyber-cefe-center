
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import {
  generateSecurityToken,
  hashSecurityToken,
} from "../utils/securityToken.js";
import {
  sendPasswordResetEmail,
  sendEmailChangeVerificationEmail,
} from "../services/emailService.js";

const PASSWORD_MIN = 12;
const PASSWORD_MAX = 72;
const TOKEN_EXPIRY_MS = 15 * 60 * 1000;

const isValidPassword = (password) =>
  typeof password === "string" &&
  password.length >= PASSWORD_MIN &&
  password.length <= PASSWORD_MAX;

const clearSessionCookie = (res) => {
  res.clearCookie("cybercafe.sid", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
};

const destroyCurrentSession = (req, res, next, message) => {
  req.session.destroy((error) => {
    if (error) return next(error);

    clearSessionCookie(res);

    return res.status(200).json({
      success: true,
      message,
    });
  });
};

// Incrementing this version invalidates sessions checked by requireAuth.
const incrementSessionVersion = (user) => {
  user.sessionVersion = (user.sessionVersion ?? 0) + 1;
};

// Change password for a logged-in user.
export const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (
      typeof currentPassword !== "string" ||
      !isValidPassword(newPassword) ||
      newPassword !== confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Enter your current password, a new password of 12–72 characters, and matching confirmation.",
      });
    }

    const user = await User.findById(req.authUser._id).select(
      "+passwordHash +sessionVersion"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Account not found.",
      });
    }

    const matches = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

    if (!matches) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        message: "Choose a password different from your current one.",
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date();
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;

    incrementSessionVersion(user);
    await user.save();

    return destroyCurrentSession(
      req,
      res,
      next,
      "Password updated. Please log in again."
    );
  } catch (error) {
    return next(error);
  }
};

// Generic response prevents account enumeration.
export const forgotPassword = async (req, res, next) => {
  const genericResponse = {
    success: true,
    message:
      "If an account exists for that email, a password reset link will be sent.",
  };

  try {
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    if (!email || email.length > 254) {
      return res.status(200).json(genericResponse);
    }

    const user = await User.findOne({ email }).select(
      "+passwordResetTokenHash +passwordResetExpiresAt"
    );

    if (
      !user ||
      user.accountStatus !== "active" ||
      !user.emailVerified
    ) {
      return res.status(200).json(genericResponse);
    }

    const token = generateSecurityToken();

    user.passwordResetTokenHash = hashSecurityToken(token);
    user.passwordResetExpiresAt = new Date(
      Date.now() + TOKEN_EXPIRY_MS
    );

    await user.save();

    try {
      await sendPasswordResetEmail({
        email: user.email,
        fullName: user.fullName,
        token,
      });
    } catch (emailError) {
      user.passwordResetTokenHash = undefined;
      user.passwordResetExpiresAt = undefined;
      await user.save();
      throw emailError;
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    return next(error);
  }
};

// Reset password using a single-use, expiring token.
export const resetPassword = async (req, res, next) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/i.test(token) ||
      !isValidPassword(newPassword) ||
      newPassword !== confirmPassword
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid token or password details.",
      });
    }

    const user = await User.findOne({
      passwordResetTokenHash: hashSecurityToken(token),
      passwordResetExpiresAt: { $gt: new Date() },
      accountStatus: "active",
      emailVerified: true,
    }).select(
      "+passwordHash +passwordResetTokenHash +passwordResetExpiresAt +sessionVersion"
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "This reset link is invalid or has expired.",
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordChangedAt = new Date();
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;

    incrementSessionVersion(user);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successful. Please log in again.",
    });
  } catch (error) {
    return next(error);
  }
};

// Request an email change; the new address must be verified.
export const changeEmail = async (req, res, next) => {
  try {
    const { newEmail, currentPassword } = req.body;

    if (
      typeof newEmail !== "string" ||
      typeof currentPassword !== "string"
    ) {
      return res.status(400).json({
        success: false,
        message: "New email and current password are required.",
      });
    }

    const email = newEmail.trim().toLowerCase();

    if (
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address.",
      });
    }

    const user = await User.findById(req.authUser._id).select(
      "+passwordHash +emailChangeTokenHash +emailChangeExpiresAt +sessionVersion"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "Account not found.",
      });
    }

    const passwordMatches = await bcrypt.compare(
      currentPassword,
      user.passwordHash
    );

    if (!passwordMatches) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect.",
      });
    }

    if (email === user.email) {
      return res.status(400).json({
        success: false,
        message: "This is already your current email address.",
      });
    }

    const existingUser = await User.findOne({ email }).select("_id");

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "This email address is already in use.",
      });
    }

    const token = generateSecurityToken();

    user.pendingEmail = email;
    user.emailChangeTokenHash = hashSecurityToken(token);
    user.emailChangeExpiresAt = new Date(
      Date.now() + TOKEN_EXPIRY_MS
    );

    await user.save();

    try {
      await sendEmailChangeVerificationEmail({
        email,
        fullName: user.fullName,
        token,
      });
    } catch (emailError) {
      user.pendingEmail = undefined;
      user.emailChangeTokenHash = undefined;
      user.emailChangeExpiresAt = undefined;
      await user.save();
      throw emailError;
    }

    return res.status(200).json({
      success: true,
      message: "Verification link sent to your new email address.",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This email address is already in use.",
      });
    }

    return next(error);
  }
};

// Verify the new email address and apply the change.
export const verifyEmailChange = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (
      typeof token !== "string" ||
      !/^[a-f0-9]{64}$/i.test(token)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired email verification link.",
      });
    }

    const user = await User.findOne({
      emailChangeTokenHash: hashSecurityToken(token),
      emailChangeExpiresAt: { $gt: new Date() },
      accountStatus: "active",
      emailVerified: true,
    }).select(
      "+emailChangeTokenHash +emailChangeExpiresAt +sessionVersion"
    );

    if (!user || !user.pendingEmail) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired email verification link.",
      });
    }

    const emailAlreadyUsed = await User.findOne({
      email: user.pendingEmail,
      _id: { $ne: user._id },
    }).select("_id");

    if (emailAlreadyUsed) {
      user.pendingEmail = undefined;
      user.emailChangeTokenHash = undefined;
      user.emailChangeExpiresAt = undefined;
      await user.save();

      return res.status(409).json({
        success: false,
        message: "This email address is already in use.",
      });
    }

    user.email = user.pendingEmail;
    user.pendingEmail = undefined;
    user.emailChangeTokenHash = undefined;
    user.emailChangeExpiresAt = undefined;
    user.emailVerified = true;
    user.emailVerifiedAt = new Date();

    incrementSessionVersion(user);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Email address verified and updated. Please log in again.",
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "This email address is already in use.",
      });
    }

    return next(error);
  }
};
