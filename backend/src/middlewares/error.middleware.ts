import { Request, Response, NextFunction } from "express";
import { ApiError } from "@/utils/ApiError";
import { config } from "@/config/env";

export const errorHandler = (
  err: Error | ApiError,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  let error = err;

  // Mongoose validation error
  if (err.name === "ValidationError") {
    const message = Object.values((err as any).errors)
      .map((e: any) => e.message)
      .join(", ");
    error = new ApiError(400, message);
  }

  // Mongoose duplicate key error
  if ((err as any).code === 11000) {
    const field = Object.keys((err as any).keyPattern)[0];
    error = new ApiError(400, `${field} already exists`);
  }

  // Mongoose cast error
  if (err.name === "CastError") {
    error = new ApiError(400, "Invalid ID format");
  }

  // JWT errors
  if (err.name === "JsonWebTokenError") {
    error = new ApiError(401, "Invalid token");
  }

  if (err.name === "TokenExpiredError") {
    error = new ApiError(401, "Token expired");
  }

  const statusCode = (error as ApiError).statusCode || 500;
  const message = error.message || "Internal Server Error";

  res.status(statusCode).json({
    success: false,
    message,
    ...(config.env === "development" && { stack: error.stack }),
  });
};
