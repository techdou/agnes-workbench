import { describe, it, expect, beforeAll } from 'vitest';

// getRecommendedTargets 在 store.ts 里,但它依赖 zustand create(会初始化整个 store)
// 我们只测这个纯函数,不测 store 的副作用
describe('getRecommendedTargets', () => {
  let getRecommendedTargets: (sourceType: string) => string[];

  beforeAll(async () => {
    // 动态导入,避免 store 初始化副作用影响其他测试
    const mod = await import('../store');
    getRecommendedTargets = mod.getRecommendedTargets;
  });

  it('文本节点推荐所有图片/视频生成节点', () => {
    const targets = getRecommendedTargets('text');
    expect(targets).toContain('textToImage');
    expect(targets).toContain('textToVideo');
    expect(targets).toContain('imageToImage');
    expect(targets).toContain('imageToVideo');
    expect(targets).toContain('keyframe');
    expect(targets).toContain('multiImageVideo');
  });

  it('文生图节点推荐下游图片消费节点', () => {
    const targets = getRecommendedTargets('textToImage');
    expect(targets).toContain('imageToImage');
    expect(targets).toContain('imageToVideo');
    expect(targets).toContain('imagePreview');
    // 不应该推荐文本节点(图片不能连到文本)
    expect(targets).not.toContain('text');
  });

  it('上传节点推荐图片消费节点', () => {
    const targets = getRecommendedTargets('imageInput');
    expect(targets).toContain('imageToImage');
    expect(targets).toContain('imageToVideo');
    expect(targets).toContain('imagePreview');
  });

  it('视频生成节点推荐视频预览', () => {
    const targets = getRecommendedTargets('textToVideo');
    expect(targets).toContain('videoPreview');
  });

  it('未知类型返回空数组', () => {
    const targets = getRecommendedTargets('nonexistent');
    expect(targets).toEqual([]);
  });
});
