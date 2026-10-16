// Ürün sahibi oturumu (şartname 7.13, 10.10): müşteri oturumundan ayrı saklanır. Şifre adımından
// sonraki ara token yalnız bellektedir; sayfa yenilenince giriş baştan yapılır. Kurtarma kodları ve
// geçici şifreler hiçbir depoya yazılmaz.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PlatformAdmin, PlatformSession } from '../api/admin-types';
import { safeStorage } from './session';

interface AdminSessionState {
  accessToken: string | null;
  refreshToken: string | null;
  admin: PlatformAdmin | null;
  setSession: (session: PlatformSession) => void;
  setTokens: (tokens: { accessToken: string; refreshToken: string }) => void;
  clear: () => void;
}

export const useAdminSession = create<AdminSessionState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      admin: null,
      setSession: ({ accessToken, refreshToken, admin }) =>
        set({ accessToken, refreshToken, admin }),
      setTokens: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
      clear: () => set({ accessToken: null, refreshToken: null, admin: null }),
    }),
    { name: 'santiye-hesap-yonetim-oturum', storage: safeStorage },
  ),
);

/** Şifre adımından sonraki ara token (5 dakika); yalnız bellekte tutulur. */
interface PendingState {
  pendingToken: string | null;
  setupRequired: boolean;
  setPending: (pending: { pendingToken: string; setupRequired: boolean } | null) => void;
}

export const useAdminPending = create<PendingState>()((set) => ({
  pendingToken: null,
  setupRequired: false,
  setPending: (pending) =>
    set({
      pendingToken: pending?.pendingToken ?? null,
      setupRequired: pending?.setupRequired ?? false,
    }),
}));
