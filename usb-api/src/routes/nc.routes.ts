import { Router } from "express";
import { requireAdmin } from "../middleware/requireAdmin.js";
import { getNcEntries, postNcEntry, patchNcEntryStatus } from "../controllers/nc.controller.js";

const ncRouter = Router();
ncRouter.use(requireAdmin);
ncRouter.get("/", getNcEntries);
ncRouter.post("/", postNcEntry);
ncRouter.patch("/:id/status", patchNcEntryStatus);

export default ncRouter;
