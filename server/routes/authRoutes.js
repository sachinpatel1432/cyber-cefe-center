
import { Router } from "express";
import { body } from "express-validator";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/authMiddleware.js";

import {
  register,
  verifyEmail,
  login,
  logout,
} from "../controllers/authController.js";


import {
  changePassword,
  forgotPassword,
  resetPassword,
  changeEmail,
  verifyEmailChange,
} from "../controllers/accountSecurityController.js";

import {
  completeStaffInvitation,
} from "../controllers/staffInvitationController.js";




const router = Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many attempts. Please try again later.",
  },
});

const emailValidation = body("email")
  .isString()
  .withMessage("Email is required.")
  .bail()
  .trim()
  .isEmail()
  .withMessage("Enter a valid email.")
  .bail()
  .normalizeEmail()
  .isLength({ max: 254 })
  .withMessage("Email is too long.");

const passwordValidation = body("password")
  .isString()
  .withMessage("Password is required.")
  .bail()
  .isLength({ min: 12, max: 72 })
  .withMessage("Password must be 12–72 characters long.");

router.post(
  "/register",
  authLimiter,
  body("fullName")
    .isString()
    .withMessage("Full name is required.")
    .bail()
    .trim()
    .isLength({ min: 2, max: 80 })
    .withMessage("Full name must be 2–80 characters long."),
  emailValidation,
  passwordValidation,
  register
);

router.post(
  "/verify-email",
  authLimiter,
  body("token")
    .isString()
    .withMessage("Verification token is required.")
    .bail()
    .isHexadecimal()
    .withMessage("Invalid verification token.")
    .bail()
    .isLength({ min: 64, max: 64 })
    .withMessage("Invalid verification token."),
  verifyEmail
);

router.post(
  "/login",
  authLimiter,
  emailValidation,
  body("password")
    .isString()
    .withMessage("Password is required.")
    .bail()
    .isLength({ min: 1, max: 72 })
    .withMessage("Invalid password."),
  login
);

router.get("/me", requireAuth, (req, res) => {
  const user = req.authUser;

  res.status(200).json({
    success: true,
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      accountStatus: user.accountStatus,
    },
  });
});


router.post(
  "/change-password",
  requireAuth,
  authLimiter,
  changePassword
);

router.post(
  "/forgot-password",
  authLimiter,
  body("email").isEmail().normalizeEmail(),
  forgotPassword
);

router.post(
  "/reset-password",
  authLimiter,
  resetPassword
);

router.post(
  "/change-email",
  requireAuth,
  authLimiter,
  changeEmail
);

router.post(
  "/verify-email-change",
  authLimiter,
  verifyEmailChange
);

router.post(
  "/staff-invitation/complete",
  completeStaffInvitation
);

router.post("/logout", logout);

export default router;
