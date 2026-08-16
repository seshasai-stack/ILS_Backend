import {
  Router,
  type Request,
  type Response,
} from "express";
import { FieldValue } from "firebase-admin/firestore";

import { db } from "../config/firebase.js";
import { applicationSchema } from "../validators/application.validator.js";

export const applicationRouter = Router();

applicationRouter.post(
  "/submit-application",
  async (request: Request, response: Response) => {
    const validation = applicationSchema.safeParse(
      request.body
    );

    if (!validation.success) {
      return response.status(400).json({
        success: false,
        message: "Invalid application details",
        errors:
          validation.error.flatten().fieldErrors,
      });
    }

    try {
      const application = validation.data;

      const document = await db
        .collection("summitApplications")
        .add({
          ...application,
          email: application.email.toLowerCase(),
          applicationStatus: "SUBMITTED",
          paymentStatus: "NOT_STARTED",
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

      return response.status(201).json({
        success: true,
        message:
          "Application submitted successfully",
        applicationId: document.id,
      });
    } catch (error) {
      console.error("Firestore save failed:", error);

      return response.status(500).json({
        success: false,
        message: "Unable to save application",
      });
    }
  }
);
