import { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";
import { ApiError } from "@/utils/ApiError";

export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    const errorMessages = errors
      .array()
      .map((error) => error.msg)
      .join(", ");
    throw new ApiError(400, errorMessages);
  }

  next();
};
