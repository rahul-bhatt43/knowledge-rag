// src/config/database.ts
import mongoose from "mongoose";
import logger from "../utils/logger.util";
import { config } from "../config/env";

const MONGODB_URI =
  config.database.uri || "mongodb://localhost:27017/company-knowledge";
const MONGODB_DB_NAME = config.database.dbName || "company-knowledge";

const isVercel = !!process.env.VERCEL;


export const connectDB = async (): Promise<void> => {
  try {
    await mongoose.connect(MONGODB_URI, {
      dbName: MONGODB_DB_NAME,
    });
    logger.info(`MongoDB connected successfully to DB: ${MONGODB_DB_NAME}`);
  } catch (error) {
    logger.error("MongoDB connection error:", error);
    if (isVercel) {
      throw error;
    }else{
      process.exit(1);
    }
  }
};

// Graceful disconnect
process.on("SIGINT", async () => {
  await mongoose.connection.close();
  logger.info("MongoDB disconnected");
  process.exit(0);
});
