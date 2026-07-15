"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.app = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const application_routes_js_1 = require("./routes/application.routes.js");
exports.app = (0, express_1.default)();
exports.app.use((0, cors_1.default)({
    origin: [
        "http://localhost:5173",
        "https://ils.corporateconnections-india.com",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
}));
exports.app.use(express_1.default.json());
exports.app.get("/api/health", (_request, response) => {
    return response.status(200).json({
        success: true,
        message: "ILS backend is running",
    });
});
exports.app.use("/api/routes", application_routes_js_1.applicationRouter);
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
