import mongoose, { Schema, Document } from "mongoose";

export interface IAuditLog extends Document {
    userId: mongoose.Types.ObjectId;
    action: string;
    entityType: string;
    entityId: string;
    changes: {
        before?: any;
        after?: any;
    };
    ipAddress?: string;
    userAgent?: string;
    createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
    {
        userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
        action: { type: String, required: true },
        entityType: { type: String, required: true },
        entityId: { type: String, required: true },
        changes: {
            before: { type: Schema.Types.Mixed },
            after: { type: Schema.Types.Mixed },
        },
        ipAddress: { type: String },
        userAgent: { type: String },
    },
    { timestamps: { createdAt: true, updatedAt: false } }
);

export const AuditLog = mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
