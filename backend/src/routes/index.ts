import { Router } from "express";
import authRoutes from "./auth.routes";
import userRoutes from "./user.routes";

const router = Router();

// Mount routes
router.use("/auth", authRoutes);
router.use("/users", userRoutes);

// API info route
router.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Company Knowledge API v1.0",
    version: "1.0.0",
    endpoints: {
      auth: "/api/auth",
      users: "/api/users",
    },
  });
});

export default router;
