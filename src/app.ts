import express, {
  type NextFunction,
  type Request,
  type Response,
} from "express";
import cors from "cors";

import { applicationRouter } from "./routes/application.routes.js";
import { analyticsRouter } from "./routes/analytics.routes.js";
import { paymentRouter } from "./routes/payment.routes.js";
import { razorpayWebhook } from "./controllers/payment.controller.js";

export const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://ils.corporateconnections-india.com",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Analytics-Key"],
  })
);

// Razorpay requires the exact raw bytes for webhook signature verification.
app.post("/api/payment/webhook", express.raw({ type: "application/json" }), razorpayWebhook);

// Frontend JSON requests
app.use(express.json());


app.get(
  "/api/health",
  (_request: Request, response: Response) => {
    return response.status(200).json({
      success: true,
      message: "ILS backend is running",
    });
  }
);

app.use("/api/routes", applicationRouter);
app.use("/api/payment", paymentRouter);
app.use("/api/analytics", analyticsRouter);

app.use(
  (_request: Request, response: Response) => {
    return response.status(404).json({
      success: false,
      message: "Route not found",
    });
  }
);

app.use(
  (
    error: unknown,
    _request: Request,
    response: Response,
    _next: NextFunction
  ) => {
    console.error(error);

    return response.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
);
