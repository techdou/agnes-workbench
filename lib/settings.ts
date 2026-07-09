// 全局设置 store —— API Key、语言、生成默认值、外观偏好
// 持久化到 IndexedDB(通过 idb-keyval),容量充足
// 语言相关导出给 i18n.ts 用,避免循环依赖

'use client';

import { create } from 'zustand';
import { get as idbGet, set as idbSet } from 'idb-keyval';
import { settingsStore, SETTINGS_KEY } from './db';

// ---------- 类型 ----------

export type Language = 'zh' | 'en';
export type Theme = 'dark' | 'light';

export interface AppSettings {
  // API
  apiKey: string; // 留空则用 .env 的 AGNES_API_KEY
  baseUrl: string; // 留空则用默认
  // 生成默认值
  defaultImageSize: string;
  defaultVideoFrames: number;
  defaultVideoFps: number;
  defaultVideoWidth?: number;
  defaultVideoHeight?: number;
  autoTranslate: boolean;
  // 外观
  theme: Theme;
  animations: boolean;
  // 语言
  language: Language;
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  baseUrl: '',
  defaultImageSize: '1024x768',
  defaultVideoFrames: 121,
  defaultVideoFps: 24,
  defaultVideoWidth: undefined,
  defaultVideoHeight: undefined,
  autoTranslate: true,
  theme: 'dark',
  animations: true,
  language: 'zh',
};

// ---------- 语言订阅(i18n.ts 用 useSyncExternalStore 订阅) ----------

let currentLanguage: Language = 'zh';
const listeners = new Set<() => void>();

export function getLanguage(): Language {
  return currentLanguage;
}

export function subscribeLanguage(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function notifyLanguageChange() {
  for (const cb of listeners) cb();
}

// ---------- Settings Store ----------

interface SettingsState {
  settings: AppSettings;
  loaded: boolean; // IndexedDB 异步加载完成
  update: (patch: Partial<AppSettings>) => void;
  load: () => Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loaded: false,

  update: (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    // 语言变更要通知 i18n 订阅者
    if (patch.language && patch.language !== currentLanguage) {
      currentLanguage = patch.language;
      notifyLanguageChange();
    }
    // 主题变更同步到 DOM
    if (patch.theme && typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', patch.theme);
    }
    // 持久化(防抖不必要,设置变更频率低)
    if (get().loaded) {
      idbSet(SETTINGS_KEY, next, settingsStore).catch(() => {});
    }
  },

  load: async () => {
    try {
      const saved = (await idbGet(SETTINGS_KEY, settingsStore)) as AppSettings | undefined;
      if (saved) {
        const merged = { ...DEFAULT_SETTINGS, ...saved };
        set({ settings: merged, loaded: true });
        currentLanguage = merged.language;
        notifyLanguageChange();
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', merged.theme);
        }
        return;
      }
    } catch {
      /* IndexedDB 读取失败,用默认值 */
    }
    set({ loaded: true });
  },
}));

// ---------- 便捷读取(非组件环境,如 agnes.ts 读 apiKey) ----------

export function getApiKey(): string {
  const s = useSettings.getState().settings;
  return s.apiKey || process.env.AGNES_API_KEY || '';
}

export function getBaseUrl(): string {
  const s = useSettings.getState().settings;
  return s.baseUrl || process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com';
}
