import { Router } from "express";

import {
  createPayment,
  paymentReturn,
  paymentStatus,
} from "../controllers/payment.controller.js";

export const paymentRouter = Router();

paymentRouter.post(
  "/create-payment",
  createPayment
);

paymentRouter.all(
  "/payment-return",
  paymentReturn
);

paymentRouter.get(
  "/payment-status/:orderId",
  paymentStatus
);