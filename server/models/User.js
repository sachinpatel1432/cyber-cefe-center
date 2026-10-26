
import mongoose from "mongoose";

const { Schema } = mongoose;

// -------------------- ADDRESS SCHEMA --------------------
const addressSchema = new Schema(
  {
    street: {
      type: String,
      trim: true,
      maxlength: [150, "Street cannot exceed 150 characters"],
    },
    city: {
      type: String,
      trim: true,
      maxlength: [80, "City cannot exceed 80 characters"],
    },
    state: {
      type: String,
      trim: true,
      maxlength: [80, "State cannot exceed 80 characters"],
    },
    pincode: {
      type: String,
      trim: true,
      match: [/^\d{6}$/, "Enter a valid 6-digit Indian PIN code"],
    },
  },
  { _id: false }
);

// -------------------- PROFILE IMAGE SCHEMA --------------------
const profileImageSchema = new Schema(
  {
    url: {
      type: String,
      trim: true,
      maxlength: [2048, "Profile image URL is too long"],
    },
    publicId: {
      type: String,
      trim: true,
      maxlength: [255, "Profile image ID is too long"],
    },
  },
  { _id: false }
);

// -------------------- USER SCHEMA --------------------
const userSchema = new Schema(
  {
    // Basic account information
    fullName: {
      type: String,
      required: [true, "Full name is required"],
      trim: true,
      minlength: [2, "Name must contain at least 2 characters"],
      maxlength: [80, "Name cannot exceed 80 characters"],
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, "Email cannot exceed 254 characters"],
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Enter a valid email address",
      ],
    },

    phone: {
      type: String,
      trim: true,
      match: [
        /^\+?[1-9]\d{7,14}$/,
        "Enter a valid phone number with country code",
      ],
      default: undefined,
    },

    // Always store a bcrypt/approved password hash, never a plain password.
    passwordHash: {
      type: String,
      required: [true, "Password hash is required"],
      select: false,
    },

    // Account roles
    role: {
      type: String,
      enum: ["customer", "staff", "admin"],
      default: "customer",
      required: true,
    },

    // -------------------- PROFILE INFORMATION --------------------
    profileImage: {
      type: profileImageSchema,
      default: undefined,
    },

    dateOfBirth: {
      type: Date,
      validate: {
        validator(value) {
          return !value || value <= new Date();
        },
        message: "Date of birth cannot be in the future",
      },
    },

    address: {
      type: addressSchema,
      default: undefined,
    },

    bio: {
      type: String,
      trim: true,
      maxlength: [300, "Bio cannot exceed 300 characters"],
    },

    // -------------------- EMAIL VERIFICATION --------------------
    emailVerified: {
      type: Boolean,
      default: false,
      required: true,
    },

    emailVerifiedAt: {
      type: Date,
      default: null,
    },

    emailVerificationTokenHash: {
      type: String,
      select: false,
      default: undefined,
    },

    emailVerificationExpiresAt: {
      type: Date,
      select: false,
      default: undefined,
    },

    // -------------------- EMAIL CHANGE --------------------
    // The current email remains active until the new email is verified.
    pendingEmail: {
      type: String,
      lowercase: true,
      trim: true,
      maxlength: [254, "Email cannot exceed 254 characters"],
      match: [
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
        "Enter a valid email address",
      ],
      default: undefined,
    },

    emailChangeTokenHash: {
      type: String,
      select: false,
      default: undefined,
    },

    emailChangeExpiresAt: {
      type: Date,
      select: false,
      default: undefined,
    },

    // -------------------- PASSWORD RESET --------------------
    passwordResetTokenHash: {
      type: String,
      select: false,
      default: undefined,
    },

    passwordResetExpiresAt: {
      type: Date,
      select: false,
      default: undefined,
    },

    // -------------------- STAFF INVITATION --------------------
    // Admin creates a pending staff account and sends an invitation.
    // Store only the hash of the random invitation token.
    staffInvitationTokenHash: {
      type: String,
      select: false,
      default: undefined,
    },

    staffInvitationExpiresAt: {
      type: Date,
      select: false,
      default: undefined,
    },

    staffInvitationSentAt: {
      type: Date,
      default: null,
    },

    // -------------------- ACCOUNT SECURITY --------------------
    passwordChangedAt: {
      type: Date,
      select: false,
      default: null,
    },

    // Increment this when sessions must be invalidated.
    sessionVersion: {
      type: Number,
      default: 0,
      min: 0,
      select: false,
    },

    // -------------------- ACCOUNT STATUS --------------------
    accountStatus: {
      type: String,
      enum: ["pending", "active", "suspended"],
      default: "pending",
      required: true,
    },

    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,

    // Prevent sensitive security fields from appearing in JSON responses.
    toJSON: {
      transform(doc, ret) {
        delete ret.passwordHash;

        delete ret.emailVerificationTokenHash;
        delete ret.emailVerificationExpiresAt;

        delete ret.emailChangeTokenHash;
        delete ret.emailChangeExpiresAt;

        delete ret.passwordResetTokenHash;
        delete ret.passwordResetExpiresAt;

        delete ret.staffInvitationTokenHash;
        delete ret.staffInvitationExpiresAt;

        delete ret.passwordChangedAt;
        delete ret.sessionVersion;

        return ret;
      },
    },
  }
);

// -------------------- INDEXES --------------------

// `unique: true` on email creates a unique index.
// This index can support account-status filtering.
userSchema.index({ accountStatus: 1 });

// Useful when filtering users by role and account status.
userSchema.index({ role: 1, accountStatus: 1 });

// Do not use TTL indexes for verification/reset/invitation tokens.
// Expired tokens should become invalid; they must not delete user accounts.

// -------------------- MODEL EXPORT --------------------
const User =
  mongoose.models.User || mongoose.model("User", userSchema);

export default User;
