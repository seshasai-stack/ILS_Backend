"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applicationRouter = void 0;
const express_1 = require("express");
const firestore_1 = require("firebase-admin/firestore");
const zod_1 = require("zod");
const firebase_js_1 = require("../config/firebase.js");
exports.applicationRouter = (0, express_1.Router)();
const applicationSchema = zod_1.z.object({
    name: zod_1.z.string().trim().min(2).max(100),
    email: zod_1.z.string().trim().email().max(255),
    phone: zod_1.z.string().trim().min(6).max(30),
    organization: zod_1.z.string().trim().min(2).max(150),
    designation: zod_1.z.string().trim().min(2).max(100),
    intent: zod_1.z.string().trim().max(800).optional().default(""),
});
exports.applicationRouter.post("/submit-application", async (request, response) => {
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
        const document = await firebase_js_1.db
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
            createdAt: firestore_1.FieldValue.serverTimestamp(),
            updatedAt: firestore_1.FieldValue.serverTimestamp(),
        });
        return response.status(201).json({
            success: true,
            message: "Application submitted successfully",
            applicationId: document.id,
        });
    }
    catch (error) {
        console.error("Firestore save failed:", error);
        return response.status(500).json({
            success: false,
            message: "Unable to save application",
        });
    }
});
