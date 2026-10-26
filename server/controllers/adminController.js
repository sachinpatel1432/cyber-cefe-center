
import User from "../models/User.js";
import mongoose from "mongoose";
import crypto from "crypto";
import bcrypt from "bcryptjs";

import {
  generateSecurityToken,
  hashSecurityToken,
} from "../utils/securityToken.js";

import { sendStaffInvitationEmail } from "../services/emailService.js";

// GET /api/admin/dashboard
// Returns real statistics for the admin dashboard.
export const getAdminDashboard = async (req, res, next) => {
  try {
    const [
      totalUsers,
      activeUsers,
      suspendedUsers,
      pendingUsers,
      totalCustomers,
      totalStaff,
      totalAdmins,
      recentUsers,
    ] = await Promise.all([
      User.countDocuments(),

      User.countDocuments({ accountStatus: "active" }),

      User.countDocuments({ accountStatus: "suspended" }),

      User.countDocuments({ accountStatus: "pending" }),

      User.countDocuments({ role: "customer" }),

      User.countDocuments({ role: "staff" }),

      User.countDocuments({ role: "admin" }),

      User.find()
        .select(
          "_id fullName email role accountStatus emailVerified createdAt"
        )
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
    ]);

    return res.status(200).json({
      success: true,
      dashboard: {
        statistics: {
          totalUsers,
          activeUsers,
          suspendedUsers,
          pendingUsers,
          totalCustomers,
          totalStaff,
          totalAdmins,
        },
        recentUsers,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// GET /api/admin/users
// Returns a paginated user list.
export const getAdminUsers = async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(
      50,
      Math.max(1, Number.parseInt(req.query.limit, 10) || 10)
    );

    const search =
      typeof req.query.search === "string"
        ? req.query.search.trim().slice(0, 100)
        : "";

    const filter = {};

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      filter.$or = [
        { fullName: { $regex: escapedSearch, $options: "i" } },
        { email: { $regex: escapedSearch, $options: "i" } },
      ];
    }

    const [users, totalUsers] = await Promise.all([
      User.find(filter)
        .select(
          "_id fullName email role accountStatus emailVerified createdAt"
        )
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),

      User.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        totalUsers,
        totalPages: Math.ceil(totalUsers / limit),
      },
    });
  } catch (error) {
    return next(error);
  }
};


// PATCH /api/admin/users/:id/status
// Activate or suspend a customer/staff account.
export const updateAdminUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { accountStatus } = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    if (!["active", "suspended"].includes(accountStatus)) {
      return res.status(400).json({
        success: false,
        message: "Status must be active or suspended.",
      });
    }

    // Prevent an administrator from suspending their own account.
    if (String(req.authUser._id) === String(id)) {
      return res.status(403).json({
        success: false,
        message: "You cannot change your own account status.",
      });
    }

    const user = await User.findById(id).select("+sessionVersion");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Protect administrator accounts from this general-purpose endpoint.
    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Administrator accounts cannot be modified here.",
      });
    }

    if (user.accountStatus === accountStatus) {
      return res.status(200).json({
        success: true,
        message: `Account is already ${accountStatus}.`,
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
          accountStatus: user.accountStatus,
        },
      });
    }

    user.accountStatus = accountStatus;

    // Invalidate existing sessions when suspending the account.
    if (accountStatus === "suspended") {
      user.sessionVersion = (user.sessionVersion ?? 0) + 1;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: `Account ${accountStatus} successfully.`,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        accountStatus: user.accountStatus,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// DELETE /api/admin/users/:id
export const getAdminUserDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    const user = await User.findById(id).select(
      "_id fullName email phone role accountStatus emailVerified createdAt updatedAt profileImage bio address"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};


// DELETE /api/admin/users/:id
export const deleteAdminUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid user ID.",
      });
    }

    // Prevent an admin from deleting their own account.
    if (String(req.authUser._id) === String(id)) {
      return res.status(403).json({
        success: false,
        message: "You cannot delete your own admin account.",
      });
    }

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    // Protect all admin accounts.
    if (user.role === "admin") {
      return res.status(403).json({
        success: false,
        message: "Admin accounts cannot be deleted here.",
      });
    }

    await User.deleteOne({ _id: user._id });

    return res.status(200).json({
      success: true,
      message: `Account for ${user.fullName} was deleted successfully.`,
      deletedUserId: String(user._id),
    });
  } catch (error) {
    next(error);
  }
};

const STAFF_INVITATION_EXPIRY_MS = 24 * 60 * 60 * 1000;

export const createAdminStaff = async (req, res, next) => {
  let createdUser = null;

  try {
    const fullName =
      typeof req.body.fullName === "string"
        ? req.body.fullName.trim()
        : "";

    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    const phone =
      typeof req.body.phone === "string"
        ? req.body.phone.trim()
        : "";

    if (!fullName || fullName.length > 100) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid staff name.",
      });
    }

    if (
      !email ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid email address.",
      });
    }

    if (phone && !/^\+?[1-9]\d{7,14}$/.test(phone)) {
      return res.status(400).json({
        success: false,
        message: "Enter a valid phone number with country code.",
      });
    }

    const existingUser = await User.findOne({ email }).select("_id");

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists.",
      });
    }

    const token = generateSecurityToken();

    // A random, unknown password hash prevents passwordless login
    // while preserving schemas where passwordHash is required.
    const randomPassword = crypto.randomBytes(48).toString("hex");
    const passwordHash = await bcrypt.hash(randomPassword, 12);

    createdUser = await User.create({
      fullName,
      email,
      ...(phone ? { phone } : {}),
      passwordHash,
      role: "staff",
      accountStatus: "pending",
      emailVerified: false,
      sessionVersion: 0,
      staffInvitationTokenHash: hashSecurityToken(token),
      staffInvitationExpiresAt: new Date(
        Date.now() + STAFF_INVITATION_EXPIRY_MS
      ),
      staffInvitationSentAt: new Date(),
    });

    try {
      await sendStaffInvitationEmail({
        email: createdUser.email,
        fullName: createdUser.fullName,
        token,
      });
    } catch (emailError) {
      // Do not leave an account behind when the invitation fails.
      await User.deleteOne({ _id: createdUser._id });
      createdUser = null;
      throw emailError;
    }

    return res.status(201).json({
      success: true,
      message: "Staff account created. Invitation email sent successfully.",
      staff: {
        _id: createdUser._id,
        fullName: createdUser.fullName,
        email: createdUser.email,
        phone: createdUser.phone,
        role: createdUser.role,
        accountStatus: createdUser.accountStatus,
        emailVerified: createdUser.emailVerified,
        staffInvitationSentAt: createdUser.staffInvitationSentAt,
      },
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