import { Request, Response } from "express";
import { AuthService } from "@/services/auth.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiResponse } from "@/utils/ApiResponse";
import { ApiError } from "@/utils/ApiError";

const authService = new AuthService();

export class AuthController {
  register = asyncHandler(async (req: Request, res: Response) => {
    const { user, accessToken, refreshToken } = await authService.register(
      req.body,
    );

    res.status(201).json(
      new ApiResponse(
        201,
        {
          user,
          accessToken,
          refreshToken,
        },
        "User registered successfully",
      ),
    );
  });

  login = asyncHandler(async (req: Request, res: Response) => {
    const { user, accessToken, refreshToken } = await authService.login(
      req.body,
    );

    res.status(200).json(
      new ApiResponse(
        200,
        {
          user,
          accessToken,
          refreshToken,
        },
        "Login successful",
      ),
    );
  });

  refreshToken = asyncHandler(async (req: Request, res: Response) => {
    const { refreshToken: token } = req.body;
    const { user, accessToken, refreshToken } = await authService.refreshToken(
      token,
    );

    res.status(200).json(
      new ApiResponse(
        200,
        {
          user,
          accessToken,
          refreshToken,
        },
        "Token refreshed successfully",
      ),
    );
  });

  getProfile = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new ApiError(401, "Authentication required");
    }

    const user = await authService.getProfile(req.user.id);

    res
      .status(200)
      .json(new ApiResponse(200, { user }, "Profile retrieved successfully"));
  });

  updatePassword = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new ApiError(401, "Authentication required");
    }

    const { currentPassword, newPassword } = req.body;

    await authService.updatePassword(req.user.id, currentPassword, newPassword);

    res
      .status(200)
      .json(new ApiResponse(200, null, "Password updated successfully"));
  });

  logout = asyncHandler(async (req: Request, res: Response) => {
    // In a production app, you might want to blacklist the token
    res.status(200).json(new ApiResponse(200, null, "Logout successful"));
  });

  forgotPassword = asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;

    await authService.forgotPassword(email);

    res
      .status(200)
      .json(
        new ApiResponse(200, null, "Password reset link sent to your email"),
      );
  });

  resetPassword = asyncHandler(async (req: Request, res: Response) => {
    const { token, newPassword } = req.body;

    await authService.resetPassword(token, newPassword);

    res
      .status(200)
      .json(new ApiResponse(200, null, "Password reset successfully"));
  });
}
