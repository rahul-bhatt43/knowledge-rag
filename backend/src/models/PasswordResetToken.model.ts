import { Schema, model, Document, Types } from "mongoose";

export interface IPasswordResetToken extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  token: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const PasswordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User ID is required"],
    },

    token: {
      type: String,
      required: [true, "Reset token is required"],
      trim: true,
    },

    expiresAt: {
      type: Date,
      required: [true, "Expiration time is required"],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  },
);

// TTL Index (Automatically deletes expired tokens)
PasswordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Additional helpful indexes
PasswordResetTokenSchema.index({ userId: 1 });
PasswordResetTokenSchema.index({ token: 1 });

export const PasswordResetToken = model<IPasswordResetToken>(
  "PasswordResetToken",
  PasswordResetTokenSchema,
);
