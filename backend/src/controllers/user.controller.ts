import { Request, Response } from "express";
import { UserService } from "@/services/user.service";
import { asyncHandler } from "@/utils/asyncHandler";
import { ApiResponse } from "@/utils/ApiResponse";
import { ApiError } from "@/utils/ApiError";
import { UserRole } from "@/types/common.types";
import { Types } from "mongoose";

const userService = new UserService();

export class UserController {
  createUser = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new ApiError(401, "Authentication required");
    }

    const user = await userService.createUser({
      ...req.body,
      createdBy: req.user.id,
    });

    res
      .status(201)
      .json(new ApiResponse(201, { user }, "User created successfully"));
  });

  getUserById = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await userService.getUserById(id as any);

    res
      .status(200)
      .json(new ApiResponse(200, { user }, "User retrieved successfully"));
  });

  getAllUsers = asyncHandler(async (req: Request, res: Response) => {
    const { role, status } = req.query;

    const users = await userService.getAllUsers({
      role: role as any,
      status: status as any,
    });

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { users, count: users.length },
          "Users retrieved successfully"
        )
      );
  });

  updateUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const user = await userService.updateUser(id as any, req.body);

    res
      .status(200)
      .json(new ApiResponse(200, { user }, "User updated successfully"));
  });

  deleteUser = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    await userService.deleteUser(id as any);

    res
      .status(200)
      .json(new ApiResponse(200, null, "User deleted successfully"));
  });


  getUsersByRole = asyncHandler(async (req: Request, res: Response) => {
    const { role } = req.params;

    const users = await userService.getUsersByRole(
      role as any
    );

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { users, count: users.length },
          "Users retrieved successfully"
        )
      );
  });

  hasRole = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
      throw new ApiError(401, "Authentication required");
    }

    const { role } = req.query;

    if (!role) {
      throw new ApiError(400, "Role parameter is required");
    }

    const hasRole = req.user.role === role;

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { hasRole, userRole: req.user.role, requestedRole: role },
          "Role check completed successfully"
        )
      );
  });
}
