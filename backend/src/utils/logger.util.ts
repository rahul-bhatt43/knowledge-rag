import winston from "winston";
import path from "path";

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  format: combine(
    errors({ stack: true }),
    timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    logFormat,
  ),
  transports: [
    // Console transport
    new winston.transports.Console({
      format: combine(colorize(), logFormat),
    }),
    // File transport for errors
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/error.log"),
      level: "error",
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
    // File transport for all logs
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/combined.log"),
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/exceptions.log"),
    }),
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(__dirname, "../../logs/rejections.log"),
    }),
  ],
});

export default logger;

// src/utils/logger.util.ts
// import winston from 'winston';
// import { env } from '@config/env';

// const logger = winston.createLogger({
//   level: env.nodeEnv === 'production' ? 'info' : 'debug',
//   format: winston.format.combine(
//     winston.format.timestamp(),
//     winston.format.errors({ stack: true }),
//     winston.format.json()
//   ),
//   transports: [
//     new winston.transports.Console({
//       format: winston.format.simple(),
//     }),
//     new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
//     new winston.transports.File({ filename: 'logs/combined.log' }),
//   ],
// });

// export { logger };
