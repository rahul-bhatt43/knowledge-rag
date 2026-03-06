import { User, IUser } from "@/models/User.model";
import { ApiError } from "@/utils/ApiError";
import {
  generateAccessToken,
  generateRandomToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "@/utils/jwt.util";
import { UserRole, EntityStatus } from "@/types/common.types";
import { Types } from "mongoose";
import { compare, hashPassword } from "@/utils/bcrypt.util";
import { sendEmail } from "@/utils/email.util";
import { PasswordResetToken } from "@/models/PasswordResetToken.model";
import { config } from "../config/env";

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  createdBy?: Types.ObjectId;
}

interface LoginData {
  email: string;
  password: string;
}

export class AuthService {
  async register(
    data: RegisterData,
  ): Promise<{ user: IUser; accessToken: string; refreshToken: string }> {
    // Check if user already exists
    const existingUser = await User.findOne({ email: data.email });
    if (existingUser) {
      throw new ApiError(400, "User with this email already exists");
    }
    if (!data.role) {
      throw new ApiError(400, "Role is required");
    }

    // Hash password
    const hashedPassword = await hashPassword(data.password);

    // Create user - default to OWNER role if not specified
    const user = await User.create({
      ...data,
      password: hashedPassword,
      role: data.role,
      status: EntityStatus.ACTIVE,
    });

    // Generate tokens
    const accessToken = generateAccessToken({
      id: user._id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      id: user._id,
      email: user.email,
      role: user.role,
    });

    return {
      user,
      accessToken,
      refreshToken,
    };
  }

  async login(
    data: LoginData,
  ): Promise<{ user: IUser; accessToken: string; refreshToken: string }> {
    // Find user with password
    const user = await User.findOne({ email: data.email }).select("+password");

    if (!user) {
      throw new ApiError(401, "Invalid email or password");
    }

    // Check if user is active
    if (user.status !== EntityStatus.ACTIVE) {
      throw new ApiError(401, "Your account has been deactivated");
    }

    // Verify password
    const isPasswordValid = await compare(data.password, user.password);

    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid email or password");
    }

    // Generate tokens
    const accessToken = generateAccessToken({
      id: user._id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      id: user._id,
      email: user.email,
      role: user.role,
    });

    // Remove password from response
    user.password = undefined as any;

    return {
      user,
      accessToken,
      refreshToken,
    };
  }

  async refreshToken(
    token: string,
  ): Promise<{ user: IUser; accessToken: string; refreshToken: string }> {
    // Verify token
    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (error) {
      throw new ApiError(401, "Invalid refresh token");
    }

    // Get user
    const user = await User.findById(decoded.id);

    if (!user) {
      throw new ApiError(401, "User not found");
    }

    if (user.status !== EntityStatus.ACTIVE) {
      throw new ApiError(401, "Your account has been deactivated");
    }

    // Generate new tokens (Rotation)
    const accessToken = generateAccessToken({
      id: user._id,
      email: user.email,
      role: user.role,
    });

    const refreshToken = generateRefreshToken({
      id: user._id,
      email: user.email,
      role: user.role,
    });

    return {
      user,
      accessToken,
      refreshToken,
    };
  }

  async getProfile(userId: Types.ObjectId): Promise<IUser> {
    const user = await User.findById(userId)
      .populate("createdBy", "firstName lastName email");

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    return user;
  }

  async updatePassword(
    userId: Types.ObjectId,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await User.findById(userId).select("+password");

    if (!user) {
      throw new ApiError(404, "User not found");
    }

    // Verify current password
    const isPasswordValid = await compare(currentPassword, user.password);

    if (!isPasswordValid) {
      throw new ApiError(401, "Current password is incorrect");
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    user.password = hashedPassword;
    await user.save();
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await User.findOne({ email });

    if (!user) {
      // For security → always pretend success
      return;
    }

    // Delete old tokens
    await PasswordResetToken.deleteMany({ userId: user._id });

    // Generate token
    const resetToken = generateRandomToken();

    // Save token
    await PasswordResetToken.create({
      userId: user._id,
      token: resetToken,
      expiresAt: new Date(Date.now() + 1000 * 60 * 15), // 15 minutes
    });

    // Frontend reset URL
    const resetUrl = `${config.redirectUrls.clientSideResetPass}?token=${resetToken}`;

    // Send email
    try {
      // const emailTemplateService = new EmailTemplateService();
      // const html = emailTemplateService.getForgotPasswordTemplate(user, resetUrl);

      // await sendEmail(user.email, "Password Reset Request", html);
      // later
    } catch (error) {
      console.error("EMAIL SEND ERROR:", error);
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const resetToken = await PasswordResetToken.findOne({ token });

    if (!resetToken) {
      throw new ApiError(400, "Invalid or expired password reset token");
    }

    if (resetToken.expiresAt < new Date()) {
      throw new ApiError(400, "Reset token has expired");
    }

    const user = await User.findById(resetToken.userId).select("+password");
    if (!user) throw new ApiError(404, "User not found");

    user.password = await hashPassword(newPassword);
    await user.save();

    await PasswordResetToken.deleteMany({ userId: user._id });
  }
}
