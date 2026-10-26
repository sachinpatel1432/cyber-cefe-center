import bcrypt from "bcryptjs";
import User from "../models/User.js";
import {
  hashSecurityToken,
} from "../utils/securityToken.js";

const isValidPassword = (password) =>
  typeof password === "string" &&
  password.length >= 12 &&
  password.length <= 72;

export const completeStaffInvitation = async (req, res, next) => {
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
        message:
          "Invalid or expired invitation, or passwords do not match. Use a password of 12–72 characters.",
      });
    }

    const user = await User.findOne({
      staffInvitationTokenHash: hashSecurityToken(token),
      staffInvitationExpiresAt: { $gt: new Date() },
      role: "staff",
      accountStatus: "pending",
      emailVerified: false,
    }).select(
      "+passwordHash +staffInvitationTokenHash +staffInvitationExpiresAt +sessionVersion"
    );

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "This invitation is invalid, expired, or already used. Ask the administrator for a new invitation.",
      });
    }

    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    user.accountStatus = "active";

    user.staffInvitationTokenHash = undefined;
    user.staffInvitationExpiresAt = undefined;

    user.sessionVersion = (user.sessionVersion ?? 0) + 1;

    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "Email verified and staff account activated. You can now log in.",
    });
  } catch (error) {
    return next(error);
  }
};