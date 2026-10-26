
import User from "../models/User.js";

export const requireAuth = async (req, res, next) => {
  try {
    const userId = req.session?.userId;
    const sessionVersion = req.session?.sessionVersion;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Please log in to access this resource.",
      });
    }

    const user = await User.findById(userId).select(
      "_id fullName email role emailVerified accountStatus +sessionVersion"
    );

    if (!user || user.accountStatus !== "active") {
      return res.status(401).json({
        success: false,
        message: "Your session is invalid or your account is inactive.",
      });
    }

    if (!user.emailVerified) {
      return res.status(403).json({
        success: false,
        message: "Please verify your email first.",
      });
    }

    // Sessions created before this feature are rejected too.
    if (
      !Number.isInteger(sessionVersion) ||
      sessionVersion !== (user.sessionVersion ?? 0)
    ) {
      return res.status(401).json({
        success: false,
        message: "Your session has expired. Please log in again.",
      });
    }

    req.authUser = user;
    return next();
  } catch (error) {
    return next(error);
  }
};

export const requireRole = (...allowedRoles) => (req, res, next) => {
  if (!req.authUser) {
    return res.status(401).json({
      success: false,
      message: "Authentication is required.",
    });
  }

  if (!allowedRoles.includes(req.authUser.role)) {
    return res.status(403).json({
      success: false,
      message: "You do not have permission to access this resource.",
    });
  }

  return next();
};
