
import bcrypt from "bcryptjs";
import { validationResult } from "express-validator";

import User from "../models/User.js";
import {
  generateEmailVerificationToken,
  hashEmailVerificationToken,
} from "../utils/emailToken.js";
import { sendVerificationEmail } from "../services/emailService.js";

const validationErrors = (req, res) => {
  const result = validationResult(req);

  if (result.isEmpty()) return false;

  res.status(400).json({
    success: false,
    message: "Please correct the invalid fields.",
    errors: result.array().map(({ path, msg }) => ({
      field: path,
      message: msg,
    })),
  });

  return true;
};

const clearSessionCookie = (res) => {
  res.clearCookie("cybercafe.sid", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
};

// Always return public user information only.
// Supports the profileImage shape: { url, publicId }.
const safeUser = (user) => {
  const profileImage = user?.profileImage;

  let normalizedProfileImage = null;

  if (typeof profileImage === "string") {
    normalizedProfileImage = profileImage.trim()
      ? { url: profileImage.trim() }
      : null;
  } else if (
    profileImage &&
    typeof profileImage === "object"
  ) {
    const url =
      typeof profileImage.url === "string"
        ? profileImage.url.trim()
        : "";

    normalizedProfileImage = url
      ? {
          url,
          ...(profileImage.publicId
            ? { publicId: profileImage.publicId }
            : {}),
        }
      : null;
  }

  return {
    id: user._id.toString(),
    _id: user._id.toString(),
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    role: user.role,
    emailVerified: user.emailVerified,
    accountStatus: user.accountStatus,
    profileImage: normalizedProfileImage,
    createdAt: user.createdAt,
  };
};

// Register a new customer and send the verification email.
export const register = async (req, res, next) => {
  try {
    if (validationErrors(req, res)) return;

    const fullName = req.body.fullName.trim();
    const email = req.body.email.trim().toLowerCase();
    const password = req.body.password;

    const existingUser = await User.findOne({ email }).select("_id");

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message:
          "An account with this email already exists. Try logging in or recovering your account.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const { token, tokenHash, expiresAt } =
      generateEmailVerificationToken();

    const user = await User.create({
      fullName,
      email,
      passwordHash,
      role: "customer",
      emailVerified: false,
      accountStatus: "pending",
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: expiresAt,
      sessionVersion: 0,
    });

    try {
      await sendVerificationEmail({
        email: user.email,
        fullName: user.fullName,
        token,
      });
    } catch (emailError) {
      console.error("Verification email delivery failed.");

      return res.status(503).json({
        success: false,
        code: "VERIFICATION_EMAIL_UNAVAILABLE",
        message:
          "Your account was created but the verification email could not be sent. Please try the resend-verification option later.",
      });
    }

    return res.status(201).json({
      success: true,
      message:
        "Registration successful. Check your email to verify your account.",
      user: safeUser(user),
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    return next(error);
  }
};

// Verify email using a single-use token.
export const verifyEmail = async (req, res, next) => {
  try {
    if (validationErrors(req, res)) return;

    const { token } = req.body;
    const tokenHash = hashEmailVerificationToken(token);

    const user = await User.findOne({
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiresAt: { $gt: new Date() },
      emailVerified: false,
      accountStatus: "pending",
    }).select(
      "+emailVerificationTokenHash +emailVerificationExpiresAt"
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "Verification link is invalid, expired, or already used.",
      });
    }

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    user.accountStatus = "active";
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpiresAt = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Email verified successfully. You can now log in.",
    });
  } catch (error) {
    return next(error);
  }
};

// Login and create a fresh session.
export const login = async (req, res, next) => {
  try {
    if (validationErrors(req, res)) return;

    const email = req.body.email.trim().toLowerCase();
    const password = req.body.password;

    const user = await User.findOne({ email }).select(
      "+passwordHash +sessionVersion"
    );

    if (
      !user ||
      !(await bcrypt.compare(password, user.passwordHash))
    ) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!user.emailVerified || user.accountStatus !== "active") {
      return res.status(403).json({
        success: false,
        code:
          user.accountStatus === "suspended"
            ? "ACCOUNT_SUSPENDED"
            : "EMAIL_VERIFICATION_REQUIRED",
        message:
          user.accountStatus === "suspended"
            ? "This account is suspended. Contact support."
            : "Please verify your email before logging in.",
      });
    }

    req.session.regenerate((error) => {
      if (error) return next(error);

      req.session.userId = user._id.toString();
      req.session.sessionVersion = user.sessionVersion ?? 0;

      req.session.save((saveError) => {
        if (saveError) return next(saveError);

        return res.status(200).json({
          success: true,
          message: "Login successful.",
          user: safeUser(user),
        });
      });
    });
  } catch (error) {
    return next(error);
  }
};

// Get the authenticated user's current information.
export const getMe = async (req, res, next) => {
  try {
    const userId = req.session?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please log in to continue.",
      });
    }

    const user = await User.findById(userId).select(
      "fullName email phone role emailVerified accountStatus profileImage createdAt sessionVersion"
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Your account could not be found. Please log in again.",
      });
    }

    if (user.accountStatus !== "active") {
      return res.status(403).json({
        success: false,
        message: "Your account is not active.",
      });
    }

    // If the application uses session-version invalidation,
    // reject sessions that have been revoked.
    if (
      req.session.sessionVersion !== undefined &&
      req.session.sessionVersion !== (user.sessionVersion ?? 0)
    ) {
      return req.session.destroy((error) => {
        if (error) return next(error);

        clearSessionCookie(res);

        return res.status(401).json({
          success: false,
          message: "Your session has expired. Please log in again.",
        });
      });
    }

    return res.status(200).json({
      success: true,
      user: safeUser(user),
    });
  } catch (error) {
    return next(error);
  }
};

// Destroy the session and clear the correct cookie.
export const logout = (req, res, next) => {
  if (!req.session) {
    clearSessionCookie(res);

    return res.status(200).json({
      success: true,
      message: "You are already logged out.",
    });
  }

  req.session.destroy((error) => {
    if (error) return next(error);

    clearSessionCookie(res);

    return res.status(200).json({
      success: true,
      message: "Logged out successfully.",
    });
  });
};
