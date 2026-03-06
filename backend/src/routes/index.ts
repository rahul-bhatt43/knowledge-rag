import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";
import documentRoutes from "./document.routes";
import chatRoutes from "./chat.routes";

const router = Router();

// Mount routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/documents", documentRoutes);
router.use("/chat", chatRoutes);

// API info route
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Company Knowledge API v1.0",
    version: "1.0.0",
    endpoints: {
      auth: "/api/v1/auth",
      users: "/api/v1/users",
      documents: "/api/v1/documents",
      chat: "/api/v1/chat",
    },
  });
});

export default router;

