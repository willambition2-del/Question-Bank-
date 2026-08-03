CREATE TYPE "AdminPrivilegeAuditAction" AS ENUM ('CREATED_SUPER_ADMIN', 'PROMOTED_SUPER_ADMIN');

CREATE TABLE "AdminPrivilegeAudit" (
  "id" TEXT NOT NULL,
  "targetUserId" TEXT NOT NULL,
  "action" "AdminPrivilegeAuditAction" NOT NULL,
  "previousRole" "UserRole",
  "activated" BOOLEAN NOT NULL,
  "environment" TEXT NOT NULL,
  "actorLabel" TEXT NOT NULL,
  "metadataJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminPrivilegeAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminPrivilegeAudit_targetUserId_createdAt_idx" ON "AdminPrivilegeAudit"("targetUserId", "createdAt");
CREATE INDEX "AdminPrivilegeAudit_action_createdAt_idx" ON "AdminPrivilegeAudit"("action", "createdAt");
ALTER TABLE "AdminPrivilegeAudit" ADD CONSTRAINT "AdminPrivilegeAudit_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;