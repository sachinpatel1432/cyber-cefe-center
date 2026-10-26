
import { Router } from "express";
import { requireAdmin } from "../middleware/adminMiddleware.js";

import {
  getActiveServices,
  getManageableServices,
  getServiceDetails,
  createService,
  updateService,
  closeService,
  reopenService,
  activateService,
  deactivateService,
  deleteService,
} from "../controllers/serviceController.js";

const router = Router();

// Public catalog
router.get("/", getActiveServices);

// Everything below this line requires admin authentication
router.use(...requireAdmin);

router.get("/manage", getManageableServices);
router.post("/", createService);

router.get("/manage/:id", getServiceDetails);
router.patch("/manage/:id", updateService);


router.get("/manage/:id", getServiceDetails);
router.patch("/manage/:id/close", closeService);
router.patch("/manage/:id/reopen", reopenService);
router.patch("/manage/:id/activate", activateService);
router.patch("/manage/:id/deactivate", deactivateService);


router.delete("/manage/:id", deleteService);

export default router;
