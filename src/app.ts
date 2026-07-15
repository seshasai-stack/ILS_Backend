import express from "express";
import cors from "cors";

import { applicationRouter } from "./routes/application.routes.js";

export const app = express();

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://ils.corporateconnections-india.com",
    ],
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

app.get("/api/health", (_request, response) => {
  return response.status(200).json({
    success: true,
    message: "ILS backend is running",
  });
});

app.use("/api/routes", applicationRouter);

app.use((_request, response) => {
  return response.status(404).json({
    success: false,
    message: "Route not found",
  });
});