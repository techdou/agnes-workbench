'use client';

// 全局错误边界 —— 捕获根 layout 的错误(整个应用崩溃时的最后防线)
// 必须自带 html/body,因为根 layout 已经挂了
'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, background: '#0a0e14', color: '#e6e1cf', fontFamily: 'monospace' }}>
        <div style={{ display: 'flex', minHeight: '100vh', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '16px', padding: '32px' }}>
          <div style={{ fontSize: '48px', color: '#c8553d' }}>⚠</div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0 }}>
            Application Error
          </h2>
          <p style={{ maxWidth: '400px', textAlign: 'center', fontSize: '13px', color: '#8b95a7', margin: 0 }}>
            {error.message || 'A critical error occurred.'}
          </p>
          {error.digest && (
            <p style={{ fontSize: '9px', letterSpacing: '0.1em', color: '#4a5568', margin: 0 }}>
              ID: {error.digest}
            </p>
          )}
          <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
            <button
              onClick={reset}
              style={{
                padding: '8px 20px', fontSize: '11px', fontFamily: 'monospace', fontWeight: 600,
                letterSpacing: '0.1em', cursor: 'pointer', borderRadius: '4px',
                border: '1px solid rgba(244,162,97,0.5)', background: 'rgba(244,162,97,0.12)',
                color: '#f4a261',
              }}
            >
              ↻ RETRY
            </button>
            <button
              onClick={() => window.location.href = '/'}
              style={{
                padding: '8px 20px', fontSize: '11px', fontFamily: 'monospace',
                letterSpacing: '0.1em', cursor: 'pointer', borderRadius: '4px',
                border: '1px solid #2a3548', background: 'transparent', color: '#8b95a7',
              }}
            >
              ← HOME
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
