
import { Router } from "express";
import {
  getMyProfile,
  updateMyProfile,
  uploadMyProfilePhoto,
  removeMyProfilePhoto,
} from "../controllers/profileController.js";
import { requireAuth } from "../middleware/authMiddleware.js";
import uploadProfileImage from "../middleware/uploadMiddleware.js";

const router = Router();

router.use(requireAuth);

router.get("/", getMyProfile);
router.patch("/", updateMyProfile);

router.post(
  "/photo",
  uploadProfileImage.single("photo"),
  uploadMyProfilePhoto
);

router.delete("/photo", removeMyProfilePhoto);

export default router;
