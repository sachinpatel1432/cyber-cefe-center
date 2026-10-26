
import User from "../models/User.js";
import {
  uploadProfileImage as uploadImageToCloudinary,
  deleteCloudinaryImage,
} from "../services/cloudinaryService.js";

const editableFields = ["fullName", "phone", "bio"];

function buildProfileResponse(user) {
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone || "",
    dateOfBirth: user.dateOfBirth || null,
    bio: user.bio || "",
    address: user.address || {},
    profileImage: user.profileImage || null,
    emailVerified: user.emailVerified,
    accountStatus: user.accountStatus,
    role: user.role,
    createdAt: user.createdAt,
  };
}

// GET: Logged-in user's profile
export const getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.authUser._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      profile: buildProfileResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

// PATCH: Update logged-in user's profile
export const updateMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.authUser._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const updates = req.body;

    if (!updates || typeof updates !== "object" || Array.isArray(updates)) {
      return res.status(400).json({
        success: false,
        message: "Invalid profile details.",
      });
    }

    const allowedFields = new Set([
      ...editableFields,
      "dateOfBirth",
      "address",
    ]);

    const invalidFields = Object.keys(updates).filter(
      (field) => !allowedFields.has(field)
    );

    if (invalidFields.length) {
      return res.status(400).json({
        success: false,
        message: `Unsupported fields: ${invalidFields.join(", ")}`,
      });
    }

    for (const field of editableFields) {
      if (!Object.hasOwn(updates, field)) continue;

      const value = updates[field];

      if (typeof value !== "string" && value !== null) {
        return res.status(400).json({
          success: false,
          message: `${field} must be a string.`,
        });
      }

      user.set(field, value?.trim() || undefined);
    }

    if (Object.hasOwn(updates, "dateOfBirth")) {
      const value = updates.dateOfBirth;

      if (value === "" || value === null) {
        user.dateOfBirth = undefined;
      } else {
        const date = new Date(value);

        if (
          typeof value !== "string" ||
          !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
          Number.isNaN(date.getTime()) ||
          date.toISOString().slice(0, 10) !== value ||
          date > new Date()
        ) {
          return res.status(400).json({
            success: false,
            message: "Please provide a valid date of birth.",
          });
        }

        user.dateOfBirth = date;
      }
    }

    if (Object.hasOwn(updates, "address")) {
      const address = updates.address;

      if (!address || typeof address !== "object" || Array.isArray(address)) {
        return res.status(400).json({
          success: false,
          message: "Invalid address details.",
        });
      }

      const allowedAddressFields = ["street", "city", "state", "pincode"];
      const invalidAddressFields = Object.keys(address).filter(
        (field) => !allowedAddressFields.includes(field)
      );

      if (invalidAddressFields.length) {
        return res.status(400).json({
          success: false,
          message: "Address contains unsupported fields.",
        });
      }

      const currentAddress = user.address?.toObject?.() || {};

      for (const [field, value] of Object.entries(address)) {
        if (typeof value !== "string" && value !== null) {
          return res.status(400).json({
            success: false,
            message: `${field} must be a string.`,
          });
        }

        currentAddress[field] = value?.trim() || undefined;
      }

      user.address = currentAddress;
    }

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully.",
      profile: buildProfileResponse(user),
    });
  } catch (error) {
    if (error.name === "ValidationError" || error.name === "CastError") {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }

    next(error);
  }
};



export const uploadMyProfilePhoto = async (req, res, next) => {
  let uploadedImage;

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please select a profile image.",
      });
    }

    const user = await User.findById(req.authUser._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    uploadedImage = await uploadImageToCloudinary(req.file.buffer);

    const previousPublicId = user.profileImage?.publicId;

    user.profileImage = uploadedImage;
    await user.save();

    // Keep the saved profile valid even if old-image cleanup fails.
    if (previousPublicId && previousPublicId !== uploadedImage.publicId) {
      try {
        await deleteCloudinaryImage(previousPublicId);
      } catch (cleanupError) {
        console.error("Previous profile image cleanup failed.");
      }
    }

    return res.status(200).json({
      success: true,
      message: "Profile photo updated successfully.",
      profileImage: user.profileImage,
    });
  } catch (error) {
    // Avoid leaving an unreferenced new image if the database save fails.
    if (uploadedImage?.publicId) {
      try {
        await deleteCloudinaryImage(uploadedImage.publicId);
      } catch {
        console.error("Uploaded profile image cleanup failed.");
      }
    }

    next(error);
  }
};

export const removeMyProfilePhoto = async (req, res, next) => {
  try {
    const user = await User.findById(req.authUser._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    const previousPublicId = user.profileImage?.publicId;

    user.profileImage = undefined;
    await user.save();

    if (previousPublicId) {
      try {
        await deleteCloudinaryImage(previousPublicId);
      } catch {
        // Database no longer references the old image.
        // A cleanup retry can be added if deletion fails.
        console.error("Profile image cleanup failed.");
      }
    }

    return res.status(200).json({
      success: true,
      message: "Profile photo removed successfully.",
    });
  } catch (error) {
    next(error);
  }
};
