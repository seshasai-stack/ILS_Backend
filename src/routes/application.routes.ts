import { Router } from "express";
import { FieldValue } from "firebase-admin/firestore";
import { z } from "zod";

import { db } from "../config/firebase.js";

export const applicationRouter = Router();

const applicationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(255),
  phone: z.string().trim().min(6).max(30),
  organization: z.string().trim().min(2).max(150),
  designation: z.string().trim().min(2).max(100),
  intent: z.string().trim().max(800).optional().default(""),
});

applicationRouter.post(
  "/submit-application",
  async (request, response) => {
    const validation = applicationSchema.safeParse(request.body);

    if (!validation.success) {
      return response.status(400).json({
        success: false,
        message: "Invalid application details",
        errors: validation.error.flatten().fieldErrors,
      });
    }

    try {
      const application = validation.data;

      const document = await db
        .collection("summitApplications")
        .add({
          name: application.name,
          email: application.email.toLowerCase(),
          phone: application.phone,
          organization: application.organization,
          designation: application.designation,
          intent: application.intent || "",

          applicationStatus: "SUBMITTED",
          paymentStatus: "NOT_STARTED",

          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

      return response.status(201).json({
        success: true,
        message: "Application submitted successfully",
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