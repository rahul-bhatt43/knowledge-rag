import { User, IUser } from "@/models/User.model";
import { ApiError } from "@/utils/ApiError";
import { Types } from "mongoose";
import { UserRole, EntityStatus } from "@/types/common.types";
import bcrypt from "bcryptjs";

interface CreateUserData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  createdBy: Types.ObjectId;
}

interface UpdateUserData {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: UserRole;
  status?: EntityStatus;
}

export class UserService {
  async createUser(data: CreateUserData): Promise<IUser> {
    // Check if user already exists
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw new ApiError(400, "User with this email already exists");
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user
    const user = await User.create({
      ...data,
      password: hashedPassword,
      status: EntityStatus.ACTIVE,
    });

    return user;
  }

  async getUserById(userId: Types.ObjectId): Promise<IUser> {
    const user = await User.findById(userId)
      .populate("createdBy", "firstName lastName email");

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    return user;
  }

  async getAllUsers(filters: {
    role?: UserRole;
    status?: EntityStatus;
  }): Promise<IUser[]> {
    const query: any = {};

    if (filters.role) {
      query.role = filters.role;
    }
    if (filters.status) {
      query.status = filters.status;
    }

    const users = await User.find(query)
      .populate("createdBy", "firstName lastName")
      .sort({ createdAt: -1 });

    return users;
  }

  async updateUser(
    userId: Types.ObjectId,
    updateData: UpdateUserData
  ): Promise<IUser> {
    const user = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    return user;
  }

  async deleteUser(userId: Types.ObjectId): Promise<void> {
    const user = await User.findById(userId);

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Soft delete
    user.status = EntityStatus.DELETED;
    await user.save();
  }

  async getUsersByRole(
    role: UserRole
  ): Promise<IUser[]> {
    const query: any = { role, status: EntityStatus.ACTIVE };

    const users = await User.find(query)
      .select("-password")
      .sort({ createdAt: -1 });

    return users;
  }
}
