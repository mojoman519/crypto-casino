import { Prisma } from '@prisma/client'
import { db } from './db'

export type AuditAction =
  | 'BET_PLACED' | 'BET_WON' | 'BET_LOST' | 'BET_ROLLBACK'
  | 'RATE_LIMITED' | 'FRAUD_DETECTED' | 'FRAUD_FLAGGED'
  | 'USER_BANNED' | 'LOGIN' | 'WALLET_CONNECTED'
  | 'ADMIN_CONFIG_CHANGE' | 'BALANCE_ADJUSTED'

export type AuditSeverity = 'INFO' | 'WARN' | 'ALERT'

interface LogParams {
  userId?: string
  username?: string
  action: AuditAction
  severity?: AuditSeverity
  data?: Record<string, unknown>
  ipAddress?: string
}

// Fire-and-forget — never block the request path
export function auditLog(params: LogParams): void {
  db.auditLog.create({
    data: {
      userId: params.userId ?? null,
      username: params.username ?? null,
      action: params.action,
      severity: params.severity ?? 'INFO',
      data: (params.data ?? {}) as Prisma.InputJsonValue,
      ipAddress: params.ipAddress ?? null,
    },
  }).catch(err => console.error('[audit-logger]', err))
}

export async function auditLogSync(params: LogParams): Promise<void> {
  await db.auditLog.create({
    data: {
      userId: params.userId ?? null,
      username: params.username ?? null,
      action: params.action,
      severity: params.severity ?? 'INFO',
      data: (params.data ?? {}) as Prisma.InputJsonValue,
      ipAddress: params.ipAddress ?? null,
    },
  })
}
