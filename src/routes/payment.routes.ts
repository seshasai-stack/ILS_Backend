import { Router } from "express";

import {
  createPayment,
  cancelPayment,
  paymentStatus,
  verifyPayment,
} from "../controllers/payment.controller.js";

export const paymentRouter = Router();

paymentRouter.post(
  "/create-payment",
  createPayment
);

paymentRouter.post("/verify", verifyPayment);
paymentRouter.post("/cancel", cancelPayment);

paymentRouter.get(
  "/payment-status/:orderId",
  paymentStatus
);
