import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { UserRole } from "@/types/common.types";
import { config } from "@/config/env";
import crypto from "crypto";

interface TokenPayload {
  id: Types.ObjectId;
  email: string;
  role: UserRole;
}
const Expires_In: number | undefined = +config.jwt.expiresIn || 604800; // 7d
const Refresh_Expires_In: number | undefined =
  +config.jwt.refreshExpiresIn || 2592000; // default 30d

export const generateAccessToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: Expires_In,
  });
};

export const generateRefreshToken = (payload: TokenPayload): string => {
  return jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: Refresh_Expires_In,
  });
};

export const verifyAccessToken = (token: string): TokenPayload => {
  return jwt.verify(token, config.jwt.secret) as TokenPayload;
};

export const verifyRefreshToken = (token: string): TokenPayload => {
  return jwt.verify(token, config.jwt.refreshSecret) as TokenPayload;
};

export const generateRandomToken = (length: number = 32): string => {
  return crypto.randomBytes(length).toString("hex");
};
