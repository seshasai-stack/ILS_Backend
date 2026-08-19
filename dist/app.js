"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const application_routes_js_1 = require("./routes/application.routes.js");
const analytics_routes_js_1 = require("./routes/analytics.routes.js");
const payment_routes_js_1 = require("./routes/payment.routes.js");
const payment_controller_js_1 = require("./controllers/payment.controller.js");
exports.app = (0, express_1.default)();
exports.app.use((0, cors_1.default)({
    origin: [
        "http://localhost:5173",
        "https://ils.corporateconnections-india.com",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Analytics-Key"],
}));
// Razorpay requires the exact raw bytes for webhook signature verification.
exports.app.post("/api/payment/webhook", express_1.default.raw({ type: "application/json" }), payment_controller_js_1.razorpayWebhook);
// Frontend JSON requests
exports.app.use(express_1.default.json());
exports.app.get("/api/health", (_request, response) => {
    return response.status(200).json({
        success: true,
        message: "ILS backend is running",
    });
});
exports.app.use("/api/routes", application_routes_js_1.applicationRouter);
exports.app.use("/api/payment", payment_routes_js_1.paymentRouter);
exports.app.use("/api/analytics", analytics_routes_js_1.analyticsRouter);
exports.app.use((_request, response) => {
    return response.status(404).json({
        success: false,
        message: "Route not found",
    });
});
exports.app.use((error, _request, response, _next) => {
    console.error(error);
    return response.status(500).json({
        success: false,
        message: "Internal server error",
    });
});
