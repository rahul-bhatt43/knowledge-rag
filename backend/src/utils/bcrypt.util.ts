import bcrypt from "bcryptjs";

// export async function hash(password: string) {
//   const salt = await bcrypt.genSalt(10);
//   return bcrypt.hash(password, salt);
// }

// export async function compare(password: string, hash: string) {
//   return bcrypt.compare(password, hash);
// }

// export default { hash, compare };

// src/utils/jwt.util.ts
import jwt from "jsonwebtoken";
import { config } from "@config/env";
import logger from "./logger.util";
import { RequestUser } from "@/types/express";

const Expires_In: number | undefined = +config.jwt.expiresIn || 604800; // 7d

export const generateToken = (payload: object): string => {
  return jwt.sign(payload, config.jwt.secret, { expiresIn: Expires_In });
};

export const verifyToken = (token: string): RequestUser | null => {
  try {
    return jwt.verify(token, config.jwt.secret) as RequestUser;
  } catch (error) {
    logger.warn("JWT verification failed:", error);
    return null;
  }
};

export async function hashPassword(password: string) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

export async function compare(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}
