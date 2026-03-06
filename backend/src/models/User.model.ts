import { EntityStatus, UserRole } from "@/types/common.types";
import { Schema, model, Document, Types } from "mongoose";

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  password: string;
  firstName: string;
  lastName?: string;
  role: UserRole;
  createdBy?: Types.ObjectId | null;
  managerId?: Types.ObjectId | null; // For STAFF: links to their Manager
  adminId?: Types.ObjectId | null; // For MANAGER: links to Admin who assigned them
  projectRoles?: {
    projectId: Types.ObjectId;
    role: UserRole;
  }[];
  status: EntityStatus;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [6, "Password must be at least 6 characters"],
      select: false,
    },
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      required: false,
      trim: true,
    },
    role: {
      type: String,
      enum: {
        values: Object.values(UserRole),
        message: "{VALUE} is not a valid role",
      },
      required: [true, "Role is required"],
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    managerId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    projectRoles: [
      {
        projectId: {
          type: Schema.Types.ObjectId,
          ref: "Project",
          required: true,
        },
        role: {
          type: String,
          enum: {
            values: Object.values(UserRole),
            message: "{VALUE} is not a valid role",
          },
          required: true,
        },
      },
    ],
    status: {
      type: String,
      enum: Object.values(EntityStatus),
      default: EntityStatus.ACTIVE,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// Indexes
// UserSchema.index({ email: 1 });
UserSchema.index({ createdBy: 1 });
UserSchema.index({ status: 1 });
UserSchema.index({ "projectRoles.projectId": 1 });

// Instance methods
UserSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

export const User = model<IUser>("User", UserSchema);
