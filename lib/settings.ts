// 设置 store —— 拆分服务端持久 + 客户端持久
//
// 服务端持久(模型名/生成参数/baseUrl):存 DB User.settings 字段,走 /api/settings
// 客户端持久(theme/animations/language):存 localStorage,首屏防闪烁脚本不变
//
// API Key 不在 settings 对象里,走 /api/settings 单独的 hasApiKey + apiKeyHint

'use client';

import { create } from 'zustand';

// ---------- 类型 ----------

export type Language = 'zh' | 'en';
export type Theme = 'dark' | 'light';

// 服务端持久字段
export interface ServerSettings {
  textModel: string;
  imageModel: string;
  videoModel: string;
  defaultImageSize: string;
  defaultVideoFrames: number;
  defaultVideoFps: number;
  defaultVideoWidth?: number;
  defaultVideoHeight?: number;
  autoTranslate: boolean;
  baseUrl: string;
}

// 客户端持久字段
interface ClientSettings {
  theme: Theme;
  animations: boolean;
  language: Language;
}

// 完整设置(前端用)
export interface AppSettings extends ServerSettings, ClientSettings {
  apiKey: string; // 仅前端临时用,实际 key 走服务端
}

export const DEFAULT_SETTINGS: AppSettings = {
  // 服务端
  textModel: 'agnes-2.0-flash',
  imageModel: 'agnes-image-2.1-flash',
  videoModel: 'agnes-video-v2.0',
  defaultImageSize: '1024x768',
  defaultVideoFrames: 121,
  defaultVideoFps: 24,
  defaultVideoWidth: undefined,
  defaultVideoHeight: undefined,
  autoTranslate: true,
  baseUrl: '',
  // 客户端
  theme: 'dark',
  animations: true,
  language: 'zh',
  // API Key
  apiKey: '',
};

const CLIENT_STORAGE_KEY = 'phosphor-client-settings';

// 从 localStorage 读客户端设置(同步,首屏用)
function loadClientSettings(): Partial<ClientSettings> {
  try {
    const raw = localStorage.getItem(CLIENT_STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return {};
}

function saveClientSettings(settings: ClientSettings) {
  try {
    localStorage.setItem(CLIENT_STORAGE_KEY, JSON.stringify(settings));
  } catch { /* ignore */ }
}

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

// ---------- API Key 状态(服务端来源) ----------

interface ApiKeyState {
  hasApiKey: boolean;
  apiKeyHint: string; // 脱敏显示,如 sk-...abcd
}

// ---------- Settings Store ----------

interface SettingsState {
  settings: AppSettings;
  apiKeyState: ApiKeyState;
  loaded: boolean; // 服务端设置加载完成
  update: (patch: Partial<AppSettings>) => void;
  load: () => Promise<void>;
  // 服务端持久字段的更新(调 PATCH /api/settings)
  updateServer: (patch: Partial<ServerSettings>) => Promise<void>;
  // API Key 单独更新(写入覆盖模式)
  updateApiKey: (newKey: string) => Promise<void>;
}

export const useSettings = create<SettingsState>((set, get) => ({
  settings: DEFAULT_SETTINGS,
  apiKeyState: { hasApiKey: false, apiKeyHint: '' },
  loaded: false,

  // 前端即时更新(用于客户端持久字段:theme/animations/language)
  update: (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });

    // 语言变更通知 i18n
    if (patch.language && patch.language !== currentLanguage) {
      currentLanguage = patch.language;
      notifyLanguageChange();
    }

    // 主题变更同步到 DOM + localStorage(首屏防闪烁)
    if (patch.theme && typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', patch.theme);
      try { localStorage.setItem('phosphor-theme', patch.theme); } catch { /* ignore */ }
    }

    // 客户端持久字段存 localStorage
    const clientPart: ClientSettings = {
      theme: next.theme,
      animations: next.animations,
      language: next.language,
    };
    saveClientSettings(clientPart);
  },

  // 从服务端加载设置 + 合并本地客户端设置
  load: async () => {
    try {
      const resp = await fetch('/api/settings', { cache: 'no-store' });
      if (resp.ok) {
        const data = await resp.json();
        const serverSettings = data.settings as Partial<ServerSettings>;
        const clientSettings = typeof window !== 'undefined' ? loadClientSettings() : {};

        const merged: AppSettings = {
          ...DEFAULT_SETTINGS,
          ...serverSettings,
          ...clientSettings,
        };
        set({
          settings: merged,
          apiKeyState: {
            hasApiKey: data.hasApiKey ?? false,
            apiKeyHint: data.apiKeyHint ?? '',
          },
          loaded: true,
        });
        currentLanguage = merged.language;
        notifyLanguageChange();
        if (typeof document !== 'undefined') {
          document.documentElement.setAttribute('data-theme', merged.theme);
          try { localStorage.setItem('phosphor-theme', merged.theme); } catch { /* ignore */ }
        }
        return;
      }
    } catch { /* 网络错误,用默认值 */ }
    set({ loaded: true });
  },

  // 服务端持久字段更新
  updateServer: async (patch) => {
    const resp = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (!resp.ok) throw new Error(`更新设置失败: ${resp.status}`);
    const data = await resp.json();
    // 合并返回的服务端设置
    set((state) => ({
      settings: { ...state.settings, ...(data.settings as Partial<ServerSettings>) },
    }));
  },

  // API Key 更新(空字符串 = 清除)
  updateApiKey: async (newKey) => {
    const resp = await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: newKey }),
    });
    if (!resp.ok) throw new Error(`更新 API Key 失败: ${resp.status}`);
    const data = await resp.json();
    set({
      apiKeyState: {
        hasApiKey: data.hasApiKey ?? false,
        apiKeyHint: data.apiKeyHint ?? '',
      },
    });
  },
}));

// ---------- 便捷读取(非组件环境) ----------

// 注意:多用户后 API Key 从服务端 DB 读取,不再前端传
// API route 内部自行从 session → DB → decrypt 获取
export function getApiKey(): string {
  return process.env.AGNES_API_KEY || '';
}

export function getBaseUrl(): string {
  const s = useSettings.getState().settings;
  return s.baseUrl || process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com';
}
