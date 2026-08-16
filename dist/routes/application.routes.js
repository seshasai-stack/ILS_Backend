"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applicationRouter = void 0;
const express_1 = require("express");
const firestore_1 = require("firebase-admin/firestore");
const firebase_js_1 = require("../config/firebase.js");
const application_validator_js_1 = require("../validators/application.validator.js");
exports.applicationRouter = (0, express_1.Router)();
exports.applicationRouter.post("/submit-application", async (request, response) => {
    const validation = application_validator_js_1.applicationSchema.safeParse(request.body);
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
            ...application,
            email: application.email.toLowerCase(),
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
