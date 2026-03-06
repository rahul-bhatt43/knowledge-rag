// src/utils/response.util.ts
import { Response } from "express";

export const sendSuccess = (
  res: Response,
  data: any,
  message = "Success",
  status = 200,
): void => {
  res.status(status).json({
    success: true,
    message,
    data,
  });
};

export const sendError = (
  res: Response,
  message: string,
  status = 400,
): void => {
  res.status(status).json({
    success: false,
    message,
  });
};
