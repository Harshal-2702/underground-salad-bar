import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";
import {
  createKotTemplateVersion,
  getActiveKotTemplate,
  getChannelTimingSettings,
  putChannelTimingSettings,
} from "../controllers/kot.controller.js";

const router = Router();
router.use(requireAdmin);
router.get("/templates", getActiveKotTemplate);
router.post("/templates", createKotTemplateVersion);
router.get("/timing-settings", getChannelTimingSettings);
router.put("/timing-settings", putChannelTimingSettings);

export default router;
