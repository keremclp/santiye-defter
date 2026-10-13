// Oturum (şartname 3 kimlik akışı, 11). Token'lar ve son bilinen kullanıcı tarayıcıda saklanır;
// ağ hatasında silinmez, yalnız refresh de 401 verirse veya çıkışta temizlenir.

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { AuthUser, ServiceSummary, TokenPair } from '../api/types';

export interface SessionState {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  companyName: string;
  service: ServiceSummary | null;
  setSession: (session: {
    accessToken: string;
    refreshToken: string;
    user: AuthUser;
    company?: { displayName: string };
    service?: ServiceSummary;
  }) => void;
  setTokens: (tokens: TokenPair) => void;
  setUser: (user: AuthUser) => void;
  setCompany: (company: { displayName: string }, service: ServiceSummary) => void;
  clear: () => void;
}

const empty = {
  accessToken: null,
  refreshToken: null,
  user: null,
  companyName: '',
  service: null,
};

// Gizli pencere veya engellenmiş depolamada uygulama yine çalışır; yalnız oturum kalıcı olmaz.
const safeStorage = createJSONStorage(() => ({
  getItem: (name: string) => {
    try {
      return localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      /* depolama kapalı */
    }
  },
  removeItem: (name: string) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* depolama kapalı */
    }
  },
}));

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      ...empty,
      setSession: ({ accessToken, refreshToken, user, company, service }) =>
        set((state) => ({
          accessToken,
          refreshToken,
          user,
          companyName: company?.displayName ?? state.companyName,
          service: service ?? state.service,
        })),
      setTokens: ({ accessToken, refreshToken }) => set({ accessToken, refreshToken }),
      setUser: (user) => set({ user }),
      setCompany: (company, service) => set({ companyName: company.displayName, service }),
      clear: () => set(empty),
    }),
    { name: 'santiye-hesap-oturum', storage: safeStorage },
  ),
);
