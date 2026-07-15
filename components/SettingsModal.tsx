'use client';

// 设置弹窗 —— API / 模型 / 生成参数 / 外观 / 语言 五个 tab
// 毛玻璃背景 + 左侧 tab 栏,样式沿用 Phosphor 设计系统
import { useState, useEffect } from 'react';
import { useSettings, type Language, type Theme } from '@/lib/settings';
import { useTranslation } from '@/lib/i18n';

interface SettingsModalProps {
  onClose: () => void;
}

type Tab = 'api' | 'models' | 'generation' | 'appearance' | 'language';

const TABS: { key: Tab; icon: string; labelKey: string }[] = [
  { key: 'api', icon: '🔑', labelKey: 'settings.tab.api' },
  { key: 'models', icon: '◇', labelKey: 'settings.tab.models' },
  { key: 'generation', icon: '⚙', labelKey: 'settings.tab.generation' },
  { key: 'appearance', icon: '◐', labelKey: 'settings.tab.appearance' },
  { key: 'language', icon: '言', labelKey: 'settings.tab.language' },
];

export function SettingsModal({ onClose }: SettingsModalProps) {
  const t = useTranslation();
  const { settings, update } = useSettings();
  const [tab, setTab] = useState<Tab>('api');

  // Esc 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(10,14,20,0.75)', backdropFilter: 'blur(12px)' }}
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl overflow-hidden rounded-lg border shadow-2xl"
        style={{ borderColor: 'var(--c-line)', background: 'var(--c-ink)', animation: 'fade-up 0.2s ease-out' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左侧 tab 栏 */}
        <nav
          className="flex w-40 shrink-0 flex-col border-r py-4"
          style={{ borderColor: 'var(--c-edge)', background: 'color-mix(in srgb, var(--c-void) 50%, transparent)' }}
        >
          <h2 className="mb-4 px-4 font-[family-name:var(--font-display)] text-[14px] font-semibold" style={{ color: 'var(--c-text)' }}>
            {t('settings.title')}
          </h2>
          {TABS.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className="flex items-center gap-2.5 border-l-2 px-4 py-2 text-left font-mono text-[11px] transition-colors"
              style={{
                borderColor: tab === tb.key ? 'var(--c-amber)' : 'transparent',
                color: tab === tb.key ? 'var(--c-amber)' : 'var(--c-text-dim)',
                background: tab === tb.key ? 'color-mix(in srgb, var(--c-amber) 8%, transparent)' : 'transparent',
              }}
            >
              <span className="w-4 text-center text-[12px]">{tb.icon}</span>
              {t(tb.labelKey)}
            </button>
          ))}
        </nav>

        {/* 右侧内容 */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'api' && <ApiTab settings={settings} update={update} t={t} />}
          {tab === 'models' && <ModelsTab settings={settings} update={update} t={t} />}
          {tab === 'generation' && <GenTab settings={settings} update={update} t={t} />}
          {tab === 'appearance' && <AppearanceTab settings={settings} update={update} t={t} />}
          {tab === 'language' && <LanguageTab settings={settings} update={update} t={t} />}
        </div>

        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded p-1 font-mono text-sm transition-colors hover:bg-white/5"
          style={{ color: 'var(--c-text-faint)' }}
        >
          ✕
        </button>
      </div>
    </div>
  );
}

// ---------- 通用控件 ----------

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <label className="mb-1.5 block font-mono text-[10px] uppercase tracking-[0.15em]" style={{ color: 'var(--c-text-faint)' }}>
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 font-mono text-[9px]" style={{ color: 'var(--c-text-ghost)' }}>{hint}</p>}
    </div>
  );
}

const inputClass = 'w-full rounded border px-3 py-2 font-mono text-[13px] transition-colors focus:outline-none';
const inputStyle = { borderColor: 'var(--c-line)', background: 'var(--c-void)', color: 'var(--c-text)' };

// ---------- Tab 内容 ----------

type TabProps = {
  settings: ReturnType<typeof useSettings.getState>['settings'];
  update: ReturnType<typeof useSettings.getState>['update'];
  t: ReturnType<typeof useTranslation>;
};

function ApiTab({ settings, update, t }: TabProps) {
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle');
  const [testError, setTestError] = useState<string | null>(null);

  async function testConnection() {
    setTestStatus('testing');
    setTestError(null);
    try {
      // 和生图用完全一样的参数构造方式(authHeaders + modelParams)
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (settings.apiKey) headers['X-Agnes-Key'] = settings.apiKey;
      // 必须传 baseUrl + textModel,和生图链路一致,否则用户在设置里填的 Base URL 不生效
      const body: Record<string, unknown> = { prompt: 'Hi', maxTokens: 5 };
      if (settings.baseUrl) body.baseUrl = settings.baseUrl;
      if (settings.textModel) body.textModel = settings.textModel;
      const resp = await fetch('/api/agnes/text', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      // 200 = 完全正常
      // 401 = key 无效但地址通了(能收到 Agnes 的鉴权响应)
      // 429 = 限流(RPM 超限),但说明地址+key 能连通
      // 503 = 服务端队列满/过载,但说明地址+key 能连通(只是暂时忙)
      if (resp.ok || resp.status === 401 || resp.status === 429 || resp.status === 503) {
        setTestStatus('ok');
      } else {
        const err = await resp.json().catch(() => ({}));
        setTestStatus('fail');
        setTestError(err.error || `HTTP ${resp.status}`);
      }
    } catch (e: unknown) {
      setTestStatus('fail');
      setTestError(e instanceof Error ? e.message : String(e));
    }
  }

  return (
    <div>
      <Field label={t('settings.api.key')} hint={t('settings.api.keyHint')}>
        <input
          type="password"
          value={settings.apiKey}
          onChange={(e) => update({ apiKey: e.target.value })}
          placeholder="sk-..."
          className={inputClass}
          style={inputStyle}
        />
      </Field>

      <Field label={t('settings.api.baseUrl')}>
        <input
          type="text"
          value={settings.baseUrl}
          onChange={(e) => update({ baseUrl: e.target.value })}
          placeholder="https://apihub.agnes-ai.com"
          className={inputClass}
          style={inputStyle}
        />
      </Field>

      <button
        onClick={testConnection}
        disabled={testStatus === 'testing'}
        className="rounded border px-4 py-2 font-mono text-[11px] tracking-wider transition-colors disabled:opacity-50"
        style={{ borderColor: 'var(--c-phosphor)', color: 'var(--c-phosphor)' }}
      >
        {testStatus === 'testing' ? t('settings.api.testing') : t('settings.api.test')}
      </button>
      {testStatus === 'ok' && (
        <span className="ml-3 font-mono text-[11px]" style={{ color: 'var(--c-phosphor)' }}>✓ {t('settings.api.testOk')}</span>
      )}
      {testStatus === 'fail' && (
        <div className="ml-3">
          <span className="font-mono text-[11px]" style={{ color: 'var(--c-rust)' }}>✕ {t('settings.api.testFail')}</span>
          {testError && (
            <p className="mt-1 max-w-xs font-mono text-[9px] leading-relaxed" style={{ color: 'var(--c-text-ghost)' }}>
              {testError}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

const SIZES = ['1024x768', '1024x1024', '768x1024', '1280x768', '720x1280'];
const FRAME_OPTIONS = [81, 121, 161, 241, 441];
const FPS_OPTIONS = [24, 30];

function ModelsTab({ settings, update, t }: TabProps) {
  const [models, setModels] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function fetchModels() {
    setFetching(true);
    setFetchMsg(null);
    try {
      // 构造请求头(带 API key)
      const headers: Record<string, string> = {};
      if (settings.apiKey) headers['X-Agnes-Key'] = settings.apiKey;
      const resp = await fetch('/api/agnes/models', { headers });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      if (data.models && Array.isArray(data.models)) {
        setModels(data.models);
        setFetchMsg({ ok: true, text: t('settings.models.fetchOk', { count: data.models.length }) });
      } else {
        throw new Error(data.error || 'Invalid response');
      }
    } catch (e: unknown) {
      setFetchMsg({ ok: false, text: `${t('settings.models.fetchFail')}: ${e instanceof Error ? e.message : String(e)}` });
    } finally {
      setFetching(false);
    }
  }

  const defaults = { textModel: 'agnes-2.0-flash', imageModel: 'agnes-image-2.1-flash', videoModel: 'agnes-video-v2.0' };

  return (
    <div>
      {/* 拉取按钮 */}
      <div className="mb-5 flex items-center gap-3">
        <button
          onClick={fetchModels}
          disabled={fetching}
          className="rounded border px-4 py-2 font-mono text-[11px] tracking-wider transition-colors disabled:opacity-50"
          style={{ borderColor: 'var(--c-phosphor)', color: 'var(--c-phosphor)' }}
        >
          {fetching ? t('settings.models.fetching') : `↻ ${t('settings.models.fetchLatest')}`}
        </button>
        {fetchMsg && (
          <span
            className="font-mono text-[11px]"
            style={{ color: fetchMsg.ok ? 'var(--c-phosphor)' : 'var(--c-rust)' }}
          >
            {fetchMsg.ok ? '✓' : '✕'} {fetchMsg.text}
          </span>
        )}
      </div>

      {/* 可用模型列表(拉取后显示) */}
      {models.length > 0 && (
        <div className="mb-5 rounded border p-3" style={{ borderColor: 'var(--c-edge)', background: 'var(--c-void)' }}>
          <p className="mb-2 font-mono text-[9px] tracking-[0.15em]" style={{ color: 'var(--c-text-faint)' }}>
            {t('settings.docs.models')} ({models.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {models.map((m) => (
              <span
                key={m}
                className="rounded border px-2 py-0.5 font-mono text-[10px]"
                style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-dim)' }}
              >
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      <p className="mb-4 text-[11px]" style={{ color: 'var(--c-text-faint)' }}>
        {t('settings.models.customHint')}
      </p>

      {/* 三个模型输入框(带 datalist 自动补全) */}
      <datalist id="agnes-models-list">
        {models.map((m) => <option key={m} value={m} />)}
      </datalist>

      <Field label={t('settings.models.textModel')}>
        <input
          list="agnes-models-list"
          value={settings.textModel}
          onChange={(e) => update({ textModel: e.target.value })}
          placeholder={defaults.textModel}
          className={inputClass}
          style={inputStyle}
        />
      </Field>

      <Field label={t('settings.models.imageModel')}>
        <input
          list="agnes-models-list"
          value={settings.imageModel}
          onChange={(e) => update({ imageModel: e.target.value })}
          placeholder={defaults.imageModel}
          className={inputClass}
          style={inputStyle}
        />
      </Field>

      <Field label={t('settings.models.videoModel')}>
        <input
          list="agnes-models-list"
          value={settings.videoModel}
          onChange={(e) => update({ videoModel: e.target.value })}
          placeholder={defaults.videoModel}
          className={inputClass}
          style={inputStyle}
        />
      </Field>

      <button
        onClick={() => update(defaults)}
        className="rounded border px-3 py-1.5 font-mono text-[10px] tracking-wider transition-colors"
        style={{ borderColor: 'var(--c-line)', color: 'var(--c-text-dim)' }}
      >
        ↺ {t('settings.models.reset')}
      </button>

      {/* 文档链接 */}
      <div className="mt-6 border-t pt-4" style={{ borderColor: 'var(--c-edge)' }}>
        <p className="mb-2 font-mono text-[9px] tracking-[0.15em]" style={{ color: 'var(--c-text-faint)' }}>
          {t('settings.docs.title')}
        </p>
        <div className="flex flex-col gap-1.5">
          <a
            href="https://agnes-ai.com/zh-Hans/docs/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] transition-colors hover:underline"
            style={{ color: 'var(--c-amber)' }}
          >
            → {t('settings.docs.overview')}
          </a>
          <a
            href="https://wiki.agnes-ai.com/zh-Hans/docs/overview"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] transition-colors hover:underline"
            style={{ color: 'var(--c-amber)' }}
          >
            → Wiki {t('settings.docs.overview')}
          </a>
        </div>
      </div>
    </div>
  );
}

function GenTab({ settings, update, t }: TabProps) {
  return (
    <div>
      <Field label={t('settings.gen.defaultSize')}>
        <select
          value={settings.defaultImageSize}
          onChange={(e) => update({ defaultImageSize: e.target.value })}
          className={inputClass}
          style={inputStyle}
        >
          {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-4">
        <Field label={t('settings.gen.defaultFrames')}>
          <select
            value={settings.defaultVideoFrames}
            onChange={(e) => update({ defaultVideoFrames: Number(e.target.value) })}
            className={inputClass}
            style={inputStyle}
          >
            {FRAME_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>

        <Field label={t('settings.gen.defaultFps')}>
          <select
            value={settings.defaultVideoFps}
            onChange={(e) => update({ defaultVideoFps: Number(e.target.value) })}
            className={inputClass}
            style={inputStyle}
          >
            {FPS_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </Field>
      </div>

      <Field label={t('settings.gen.autoTranslate')}>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={settings.autoTranslate}
            onChange={(e) => update({ autoTranslate: e.target.checked })}
            style={{ accentColor: 'var(--c-amber)', width: '16px', height: '16px' }}
          />
          <span className="text-[13px]" style={{ color: 'var(--c-text-dim)' }}>
            {settings.autoTranslate ? '✓' : '○'} ON
          </span>
        </label>
      </Field>
    </div>
  );
}

function AppearanceTab({ settings, update, t }: TabProps) {
  const themes: { key: Theme; labelKey: string; icon: string }[] = [
    { key: 'dark', labelKey: 'settings.app.themeDark', icon: '◆' },
    { key: 'light', labelKey: 'settings.app.themeLight', icon: '◇' },
  ];

  return (
    <div>
      <Field label={t('settings.app.theme')}>
        <div className="flex gap-3">
          {themes.map((th) => (
            <button
              key={th.key}
              onClick={() => update({ theme: th.key })}
              className="flex flex-1 items-center justify-center gap-2 rounded border py-3 font-mono text-[12px] transition-colors"
              style={{
                borderColor: settings.theme === th.key ? 'var(--c-amber)' : 'var(--c-line)',
                color: settings.theme === th.key ? 'var(--c-amber)' : 'var(--c-text-dim)',
                background: settings.theme === th.key ? 'color-mix(in srgb, var(--c-amber) 10%, transparent)' : 'var(--c-void)',
              }}
            >
              <span>{th.icon}</span>
              {t(th.labelKey)}
            </button>
          ))}
        </div>
      </Field>

      <Field label={t('settings.app.animations')}>
        <label className="flex cursor-pointer items-center gap-2.5">
          <input
            type="checkbox"
            checked={settings.animations}
            onChange={(e) => update({ animations: e.target.checked })}
            style={{ accentColor: 'var(--c-amber)', width: '16px', height: '16px' }}
          />
          <span className="text-[13px]" style={{ color: 'var(--c-text-dim)' }}>
            {settings.animations ? '✓' : '○'} ON
          </span>
        </label>
      </Field>
    </div>
  );
}

function LanguageTab({ settings, update, t }: TabProps) {
  const langs: { key: Language; labelKey: string }[] = [
    { key: 'zh', labelKey: 'settings.lang.zh' },
    { key: 'en', labelKey: 'settings.lang.en' },
  ];

  return (
    <div>
      <Field label={t('settings.tab.language')}>
        <div className="flex gap-3">
          {langs.map((lg) => (
            <button
              key={lg.key}
              onClick={() => update({ language: lg.key })}
              className="flex-1 rounded border py-3 font-[family-name:var(--font-display)] text-[14px] transition-colors"
              style={{
                borderColor: settings.language === lg.key ? 'var(--c-amber)' : 'var(--c-line)',
                color: settings.language === lg.key ? 'var(--c-amber)' : 'var(--c-text-dim)',
                background: settings.language === lg.key ? 'color-mix(in srgb, var(--c-amber) 10%, transparent)' : 'var(--c-void)',
              }}
            >
              {t(lg.labelKey)}
            </button>
          ))}
        </div>
      </Field>
    </div>
  );
}
