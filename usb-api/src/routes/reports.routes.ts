import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";
import {
  getReports,
  getReportEmailSettings,
  putReportEmailSettings,
} from "../controllers/reports.controller.js";

const reportsRouter = Router();
reportsRouter.use(requireAdmin);
reportsRouter.get("/", getReports);
reportsRouter.get("/email-settings", getReportEmailSettings);
reportsRouter.put("/email-settings", putReportEmailSettings);

export default reportsRouter;
