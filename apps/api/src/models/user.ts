import { model, Schema, type HydratedDocument, type Types } from 'mongoose';
import { refreshTokenSchema, type StoredRefreshToken } from './refresh-token.js';

export interface User {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  name: string;
  /** Sistem genelinde tek; tr-TR küçük harf */
  username: string;
  phone: string;
  email: string;
  passwordHash: string;
  mustChangePassword: boolean;
  tempPasswordExpiresAt: Date | null;
  isActive: boolean;
  refreshTokens: StoredRefreshToken[];
  /** Bu andan önce verilmiş access token'lar geçersiz (oturum düşürme) */
  tokensValidAfter: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<User>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: 'Company', required: true, immutable: true },
    name: { type: String, required: true, trim: true, minlength: 2 },
    username: { type: String, required: true, trim: true },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    passwordHash: { type: String, required: true, select: false },
    mustChangePassword: { type: Boolean, default: true },
    tempPasswordExpiresAt: { type: Date, default: null },
    isActive: { type: Boolean, default: true },
    refreshTokens: { type: [refreshTokenSchema], default: [], select: false },
    tokensValidAfter: { type: Date, default: null },
  },
  { timestamps: true },
);

userSchema.index({ username: 1 }, { unique: true });
userSchema.index({ companyId: 1, isActive: 1 });

export const UserModel = model<User>('User', userSchema);
export type UserDocument = HydratedDocument<User>;
