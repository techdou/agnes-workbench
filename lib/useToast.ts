'use client';

// 轻量 toast:全局通知,自动消失
import { create } from 'zustand';

export interface ToastItem {
  id: string;
  message: string;
  type: 'info' | 'error' | 'success';
  createdAt: number;
}

interface ToastState {
  toasts: ToastItem[];
  push: (message: string, type?: ToastItem['type']) => void;
  dismiss: (id: string) => void;
}

export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, type = 'info') => {
    const id = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const item: ToastItem = { id, message, type, createdAt: Date.now() };
    set({ toasts: [...get().toasts, item] });
    // 4 秒后自动移除
    setTimeout(() => get().dismiss(id), 4000);
  },
  dismiss: (id) => {
    set({ toasts: get().toasts.filter((t) => t.id !== id) });
  },
}));

// 便捷方法:在非组件代码里也能用(比如 store.ts 的 catch)
export function toast(message: string, type: ToastItem['type'] = 'info') {
  useToast.getState().push(message, type);
}
