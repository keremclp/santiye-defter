import type { ClientSession, Types } from 'mongoose';
import { PlatformLogModel, type PlatformLogChange } from '../models/platform-log.js';

/** İşletim geçmişine kayıt. `changes` içine şifre, token veya kod yazılmaz. */
export async function writePlatformLog(
  entry: {
    adminId: Types.ObjectId | null;
    companyId?: Types.ObjectId | null;
    action: string;
    changes?: PlatformLogChange[];
    reason?: string | null;
    at: Date;
  },
  session?: ClientSession,
): Promise<void> {
  await PlatformLogModel.create(
    [
      {
        adminId: entry.adminId,
        companyId: entry.companyId ?? null,
        action: entry.action,
        changes: entry.changes ?? [],
        reason: entry.reason?.trim() || null,
        at: entry.at,
      },
    ],
    { session },
  );
}
