// Bağlantı durumu ve kısa bildirimler. Kritik durumlar (doğrulanıyor vb.) yalnız toast'ta kalmaz;
// ilgili sayfada kalıcı olarak da gösterilir (şartname 4.4).

import { create } from 'zustand';

export interface Toast {
  id: number;
  message: string;
}

interface UiState {
  offline: boolean;
  toasts: Toast[];
  /** Giriş ekranında bir kez gösterilecek bilgi (ör. şifre değişti, oturum sona erdi). */
  loginNotice: string | null;
  setLoginNotice: (notice: string | null) => void;
  setOffline: (offline: boolean) => void;
  toast: (message: string) => void;
  dismissToast: (id: number) => void;
}

let toastId = 0;

export const useUi = create<UiState>()((set, get) => ({
  offline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  toasts: [],
  loginNotice: null,
  setLoginNotice: (loginNotice) => set({ loginNotice }),
  setOffline: (offline) => {
    if (get().offline !== offline) set({ offline });
  },
  toast: (message) => {
    toastId += 1;
    const id = toastId;
    set((state) => ({ toasts: [...state.toasts, { id, message }] }));
    setTimeout(() => get().dismissToast(id), 4000);
  },
  dismissToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

export const toast = (message: string) => useUi.getState().toast(message);
