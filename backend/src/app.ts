import express, { Application } from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import morgan from "morgan";

import { rateLimiterMiddleware } from "@middlewares/rateLimiter.middleware";
import routes from "@routes/index";
import logger from "./utils/logger.util";
import { errorHandler } from "./middlewares/error.middleware";
import { config } from "./config/env";

const app: Application = express();

// Middleware setup
app.use(helmet()); // Security headers
app.use(
  cors({
    origin: config.env === "production" ? config.cors.origin : "*",
    credentials: true,
  }),
);

app.use(compression()); // Compression
app.use(
  morgan("combined", {
    stream: { write: (message) => logger.info(message.trim()) },
  }),
); // Logging
app.use(express.json({ limit: "10mb" })); // JSON parsing
app.use(express.urlencoded({ extended: true })); // URL-encoded parsing
app.use(rateLimiterMiddleware); // Rate limiting

// Routes
app.get("/", (req, res) => {
  res.status(200).json({
    message: "API is running successfully.",
  });
});

app.use("/api/v1", routes);

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// Global error handler
app.use(errorHandler);

export default app;
