// import dotenv from 'dotenv';
// import path from 'path';

// const envFile = path.resolve(process.cwd(), '.env');
// dotenv.config({ path: envFile });

// export const env = {
//   PORT: process.env.PORT || '3000',
//   NODE_ENV: process.env.NODE_ENV || 'development',
//   DATABASE_URL: process.env.DATABASE_URL || '',
//   JWT_SECRET: process.env.JWT_SECRET || 'your-secret',
// };

// export default env;

// src/config/env.ts
import dotenv from "dotenv";

dotenv.config();

export const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "3000", 10),
  mongodbUri: process.env.MONGODB_URI || "",
  mongodbDbName: process.env.MONGODB_DB_NAME || "",
  jwtSecret: process.env.JWT_SECRET || "",
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  allowedOrigins: process.env.ALLOWED_ORIGINS?.split(",") || ["*"],
  clientSideResetPass:
    process.env.FRONTEND_RESET_PASS ||
    "http://localhost:3000/auth/reset-password",
  clientSideAcceptInvite:
    process.env.FRONTEND_ACCEPT_INVITE ||
    "http://localhost:3000/auth/accept-invite",

  smtpHost: process.env.SMTP_HOST || "",
  smtpPort: process.env.SMTP_PORT || "587",
  smtpUser: process.env.SMTP_USER || "",
  smtpPass: process.env.SMTP_PASS || "",
  smtpFromEmail: process.env.SMTP_FROM_EMAIL || "",
  smtpSecure: process.env.SMTP_SECURE === "true",
};

// or

export const config = {
  env: process.env.NODE_ENV || "development",
  port: parseInt(process.env.PORT || "5000", 10),
  apiVersion: process.env.API_VERSION || "v1",

  database: {
    uri:
      process.env.MONGODB_URI || "mongodb://localhost:27017/events-management",
    dbName: process.env.MONGODB_DB_NAME || "events-management",
  },

  jwt: {
    secret: process.env.JWT_SECRET || "your-secret-key",
    expiresIn: process.env.JWT_EXPIRES_IN || 604800,
    refreshSecret: process.env.JWT_REFRESH_SECRET || "your-refresh-secret",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || 2592000,
  },

  cors: {
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || "100", 10),
  },

  socket: {
    port: parseInt(process.env.SOCKET_PORT || "5001", 10),
  },

  redirectUrls: {
    clientSideResetPass:
      process.env.FRONTEND_RESET_PASS ||
      "http://localhost:3000/auth/reset-password",
    clientSideAcceptInvite:
      process.env.FRONTEND_ACCEPT_INVITE ||
      "http://localhost:3000/auth/accept-invite",
  },

  smtp: {
    host: process.env.SMTP_HOST || "smtp.example.com",
    port: parseInt(process.env.SMTP_PORT || "587", 10),
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
    fromEmail: process.env.SMTP_FROM_EMAIL || "",
    secure: process.env.SMTP_SECURE === "true",
  },

  sendgrid: {
    apiKey: process.env.SENDGRID_API_KEY || "",
    fromEmail: process.env.SENDGRID_FROM_EMAIL || process.env.SMTP_FROM_EMAIL || "",
  },
};
