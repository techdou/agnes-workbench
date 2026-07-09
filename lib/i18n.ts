// 国际化核心 —— 轻量客户端方案(无第三方依赖)
// 字典在 lib/dictionaries/,语言存于 settings store
// 组件用 useTranslation() 获取 t() 函数,语言切换即时生效

'use client';

import { useSyncExternalStore } from 'react';
import zh from './dictionaries/zh';
import en from './dictionaries/en';
import type { Dictionary } from './dictionaries/zh';
import { getLanguage, subscribeLanguage } from './settings';

const dictionaries: Record<string, Dictionary> = { zh, en };

// 简单的 {key} 占位替换:t('key', { count: 3 }) → 模板里 {count} 替换为 3
type Params = Record<string, string | number>;

function translate(lang: string, key: string, params?: Params): string {
  const dict = dictionaries[lang] || dictionaries.zh;
  let str = (dict as Record<string, string>)[key];
  if (str === undefined) {
    // 回退到中文,再回退到 key 本身
    str = (zh as Record<string, string>)[key] ?? key;
  }
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return str;
}

// useSyncExternalStore 需要返回稳定引用,getSnapshot 必须返回缓存值
let cachedLang = 'zh';
let cachedT: ((key: string, params?: Params) => string) | null = null;

function getSnapshot() {
  const lang = getLanguage();
  if (lang !== cachedLang || !cachedT) {
    cachedLang = lang;
    cachedT = (key: string, params?: Params) => translate(lang, key, params);
  }
  return cachedT;
}

/**
 * 翻译 hook,语言切换时自动重渲染
 * @returns t(key, params?) 翻译函数
 */
export function useTranslation(): (key: string, params?: Params) => string {
  return useSyncExternalStore(subscribeLanguage, getSnapshot, getSnapshot);
}

// 非组件环境用(如 store.ts 的 toast)
export function t(key: string, params?: Params): string {
  return translate(getLanguage(), key, params);
}
