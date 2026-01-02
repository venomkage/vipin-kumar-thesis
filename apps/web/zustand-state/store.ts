import { create } from "zustand";

interface StoreState {
  authCode: string | null;
  setAuthCode: (code: string | null) => void;
}

export const useAuthStore = create<StoreState>((set) => ({
  authCode: null,
  setAuthCode: (code: string | null) => set({ authCode: code }),
}));