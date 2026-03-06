import { Request, Response, NextFunction } from "express";
import { AuditAction } from "@/types/common.types";
import { AuditLog } from "@/models/AuditLog.model";
import { asyncHandler } from "@/utils/asyncHandler";

export const auditLog = (action: AuditAction, entityType: string) => {
  return asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      const originalSend = res.json;

      res.json = function (data: any) {
        if (req.user && res.statusCode < 400) {
          const audit = res.locals.audit ?? {};

          const entityId = audit.entityId || data?.data?._id || req.params.id;

          if (entityId) {
            AuditLog.create({
              userId: req.user.id,
              action,
              entityType,
              entityId,
              changes: {
                before: audit.before ?? null,
                after: audit.after ?? null,
              },
              ipAddress: req.ip,
              userAgent: req.get("user-agent"),
            }).catch((err) => console.error("Audit log error:", err));
          }
        }

        return originalSend.call(this, data);
      };

      next();
    },
  );
};
