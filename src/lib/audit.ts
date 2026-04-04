import { prisma } from "./db";

/**
 * Logs an admin action to the audit trail
 */
export async function logAdminAction(params: {
  adminId: string;
  action: string;
  entityType: string;
  entityId?: number | string;
  details?: Record<string, any>;
  ip?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        adminId: params.adminId,
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId?.toString(),
        details: params.details || undefined,
        ip: params.ip || undefined,
      },
    });
  } catch (error) {
    console.error("Failed to log admin action:", error);
    // Don't throw - audit logging failure shouldn't break the action
  }
}

/**
 * Common admin actions for consistent logging
 */
export const AdminAction = {
  // Game actions
  CREATE_GAME: "CREATE_GAME",
  UPDATE_GAME: "UPDATE_GAME",
  DELETE_GAME: "DELETE_GAME",
  CHANGE_GAME_STATUS: "CHANGE_GAME_STATUS",

  // User actions
  BAN_USER: "BAN_USER",
  UNBAN_USER: "UNBAN_USER",
  UPDATE_USER_STATUS: "UPDATE_USER_STATUS",
  ADJUST_INVITE_QUOTA: "ADJUST_INVITE_QUOTA",
  PROMOTE_TO_ADMIN: "PROMOTE_TO_ADMIN",
  DEMOTE_FROM_ADMIN: "DEMOTE_FROM_ADMIN",

  // Question actions
  CREATE_QUESTION: "CREATE_QUESTION",
  UPDATE_QUESTION: "UPDATE_QUESTION",
  DELETE_QUESTION: "DELETE_QUESTION",
  BULK_IMPORT_QUESTIONS: "BULK_IMPORT_QUESTIONS",

  // Ticket actions
  REFUND_TICKET: "REFUND_TICKET",
  MANUAL_TICKET_CREATE: "MANUAL_TICKET_CREATE",

  // System actions
  LOGIN: "ADMIN_LOGIN",
  LOGOUT: "ADMIN_LOGOUT",
  VIEW_SENSITIVE_DATA: "VIEW_SENSITIVE_DATA",
  WITHDRAW_PROTOCOL_FEES: "WITHDRAW_PROTOCOL_FEES",
} as const;

/**
 * Entity types for audit logging
 */
export const EntityType = {
  GAME: "Game",
  USER: "User",
  QUESTION: "Question",
  TICKET: "Ticket",
  SYSTEM: "System",
} as const;
