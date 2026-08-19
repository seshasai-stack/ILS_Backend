import { Router } from "express";

import { analyticsOverview } from "../controllers/analytics.controller.js";

export const analyticsRouter = Router();

analyticsRouter.get("/overview", analyticsOverview);
