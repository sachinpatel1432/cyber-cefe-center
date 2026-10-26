
import "dotenv/config";
import { v2 as cloudinary } from "cloudinary";

const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();

if (!cloudName || !apiKey || !apiSecret) {
  throw new Error(
    "Cloudinary configuration missing. Check CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in .env."
  );
}

cloudinary.config({
  cloud_name: cloudName,
  api_key: apiKey,
  api_secret: apiSecret,
  secure: true,
});

const activeConfig = cloudinary.config();

console.log("Cloudinary SDK status:", {
  cloudNameLoaded: Boolean(activeConfig.cloud_name),
  apiKeyLoaded: Boolean(activeConfig.api_key),
  apiSecretLoaded: Boolean(activeConfig.api_secret),
});

export default cloudinary;
