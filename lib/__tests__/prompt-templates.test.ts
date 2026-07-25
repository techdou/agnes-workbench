import { describe, it, expect } from 'vitest';
import { buildEnhanceSystemPrompt } from '../prompt-templates';

// 验证扩写模板的语言切换:用户勾"输出中文"应该把英文输出指令替换成中文输出指令,
// 而不是走"英文扩写→翻译中文"的串行链路(已废弃)
describe('buildEnhanceSystemPrompt language switching', () => {
  it('默认输出英文 prompt', () => {
    const prompt = buildEnhanceSystemPrompt('textToImage');
    expect(prompt).toContain('English prompt');
    expect(prompt).not.toContain('Chinese');
  });

  it('language="zh" 时输出中文 prompt 指令', () => {
    const prompt = buildEnhanceSystemPrompt('textToImage', 'zh');
    // 中文输出指令应替换英文输出指令
    expect(prompt).toContain('Chinese');
    expect(prompt).toContain('简体中文');
    // 不应再包含英文输出指令
    expect(prompt).not.toContain('Output ONLY the English prompt');
  });

  it('language="zh" 时保留结构化视觉要求(场景/主体/细节/构图/约束)', () => {
    // 结构化方法论跟语言无关,中文模式也应保留
    const prompt = buildEnhanceSystemPrompt('textToImage', 'zh');
    expect(prompt).toContain('Scene/Environment');
    expect(prompt).toContain('Subject');
    expect(prompt).toContain('Composition');
  });

  it('language="en" 显式传入也是英文', () => {
    const prompt = buildEnhanceSystemPrompt('textToVideo', 'en');
    expect(prompt).toContain('English prompt');
    expect(prompt).not.toContain('Chinese');
  });

  it('未知 targetType 回退到 auto 模板', () => {
    const prompt = buildEnhanceSystemPrompt('nonexistent', 'en');
    expect(prompt).toContain('English prompt');
    // auto 模板有这个特征
    expect(prompt).toContain('descriptive words for lighting');
  });

  it('中文模式四种 target 都能正确切换', () => {
    // 确保所有模板里的英文输出指令都被替换
    const targets = ['textToImage', 'textToVideo', 'imageToImage', 'imageToVideo', 'auto'];
    for (const target of targets) {
      const prompt = buildEnhanceSystemPrompt(target, 'zh');
      expect(prompt).toContain('Chinese (简体中文) prompt');
      expect(prompt).not.toContain('Output ONLY the English prompt');
    }
  });

  it('图生图模板的保留项指令在中文模式仍然存在', () => {
    // imageToImage 的 "while preserving" 等保护指令不能被语言切换破坏
    const prompt = buildEnhanceSystemPrompt('imageToImage', 'zh');
    expect(prompt).toContain('preserving');
    expect(prompt).toContain('EDITING task');
  });
});
