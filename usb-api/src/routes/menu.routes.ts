import { Router } from "express";
import { getMenu } from "../controllers/menu.controller.js";

const menuRouter = Router();
menuRouter.get("/", getMenu);

export default menuRouter;
