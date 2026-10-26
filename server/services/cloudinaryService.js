
import cloudinary from "../config/cloudinary.js";

// Upload profile image to Cloudinary
export const uploadProfileImage = (buffer) => {
  return new Promise((resolve, reject) => {
    const config = cloudinary.config();

    // Validate the active Cloudinary SDK configuration.
    if (!config.cloud_name || !config.api_key || !config.api_secret) {
      return reject(
        new Error(
          "Cloudinary configuration is incomplete. Check server environment variables."
        )
      );
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "cyber-cafe/profile-images",
        resource_type: "image",
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }

        if (!result?.secure_url || !result?.public_id) {
          return reject(
            new Error("Cloudinary did not return the uploaded image details.")
          );
        }

        resolve({
          url: result.secure_url,
          publicId: result.public_id,
        });
      }
    );

    uploadStream.end(buffer);
  });
};

// Delete previous profile image
export const deleteCloudinaryImage = async (publicId) => {
  if (!publicId) return;

  const config = cloudinary.config();

  if (!config.cloud_name || !config.api_key || !config.api_secret) {
    throw new Error("Cloudinary configuration is incomplete.");
  }

  const result = await cloudinary.uploader.destroy(publicId, {
    resource_type: "image",
  });

  if (result.result !== "ok" && result.result !== "not found") {
    throw new Error("Cloudinary could not delete the previous image.");
  }

  return result;
};
