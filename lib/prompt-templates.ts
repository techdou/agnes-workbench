// 结构化扩写模板 —— 按 OpenAI cookbook image-gen-models-prompting-guide 规范
// 参考: https://developers.openai.com/cookbook/examples/multimodal/image-gen-models-prompting-guide
//
// 每种目标类型(文生图/文生视频/图生图/图生视频)有专属模板:
// - 明确用途,按场景、主体、细节、构图、文字和约束组织复杂请求
// - 编辑任务(图生图/图生视频)反复声明保留项与修改边界
// - 视频任务增加镜头运动、时间线、节奏描述

import type { PromptTarget } from './types';

/**
 * 构建扩写 system prompt:根据目标类型返回不同的结构化指令
 * 用户输入(idea)由调用方拼到 user role
 */
export function buildEnhanceSystemPrompt(target: PromptTarget | string): string {
  const base = 'You are an expert prompt engineer for AI image/video generation. ';
  const task = TASK_PROMPTS[target] || TASK_PROMPTS.auto;
  return base + task;
}

// ---------- 各目标类型的模板 ----------

const TASK_PROMPTS: Record<string, string> = {
  // 文生图:5 段式结构化
  textToImage: `Transform the user's idea into a detailed image generation prompt.
Organize the prompt into these sections, separated by commas:
1. Scene/Environment: setting, location, atmosphere, time of day
2. Subject: main subject with specific details (clothing, pose, expression, texture)
3. Details: secondary elements, background objects, material qualities
4. Composition: camera angle, framing, depth of field, perspective
5. Constraints: quality words (e.g. "highly detailed, sharp focus"), style references, mood

Rules:
- Output ONLY the English prompt, no explanations, no section labels
- Preserve ALL concrete visual details from the user's idea
- Add specific descriptive words (lighting type, color palette, art style)
- Keep it as one flowing paragraph, 2-4 sentences`,

  // 文生视频:在图片基础上增加运动和时间线
  textToVideo: `Transform the user's idea into a detailed video generation prompt.
Organize the prompt into these aspects:
1. Scene/Environment: setting, atmosphere, lighting conditions
2. Subject: main subject with appearance, pose, and intended motion
3. Camera Motion: explicit camera movement (pan, zoom, dolly, orbit, static)
4. Action/Timeline: what happens over time — describe the motion sequence
5. Composition: framing, depth, focal point shifts
6. Style/Mood: cinematic style, color grading, pacing (slow/energetic)

Rules:
- Output ONLY the English prompt, no explanations
- Video prompts should emphasize MOTION and TEMPORAL flow
- Specify camera movement explicitly (avoid vague "cinematic")
- Describe what changes over the video duration`,

  // 图生图:编辑任务,反复声明保留项与修改边界(用自然语言,不输出标签)
  imageToImage: `Transform the user's editing instruction into a precise image editing prompt.
This is an EDITING task — describe what to change while clearly preserving the rest.

Write the prompt as ONE flowing paragraph that:
- Starts by describing the desired modification (what to change and how: style, color,
  lighting, object changes)
- Uses "while keeping" or "while preserving" phrases to lock down what must stay unchanged
  (composition, subject identity, position, background elements)
- Ends by restating the key preservation to reinforce the boundary

Example output style: "Transform the sky into a dramatic sunset with warm orange and purple
clouds while keeping the mountain silhouette, foreground trees, and overall composition
unchanged. Preserve the natural lighting direction on the terrain."

Rules:
- Output ONLY the English prompt, no explanations, no section labels, no "PRESERVE:" tags
- Weave preservation instructions naturally into the sentence flow
- Be specific about both the modification and what stays fixed`,

  // 图生视频:图片动画化
  imageToVideo: `Transform the user's instruction into a precise image-to-video prompt.
The input image is the FIRST FRAME — the video should animate FROM this image.

Structure the prompt as:
1. ANCHOR: Describe the input image as the starting frame (its content must remain
   consistent throughout the video)
2. MOTION: What elements should move and how (subtle vs dramatic motion)
3. CAMERA: Camera movement if any (slow zoom, gentle pan, orbit)
4. ENVIRONMENT: Environmental changes over time (lighting shift, weather, particles)
5. DURATION FEEL: Pacing — slow contemplative, energetic, smooth cinematic

Rules:
- Output ONLY the English prompt, no explanations
- The input image content must remain recognizable throughout
- Emphasize what MOVES vs what STAYS STILL
- Prefer "subtle" and "natural" motion unless user specifies otherwise`,

  // auto:通用模板(没连线时用)
  auto: `Transform the user's idea into a detailed generation prompt.
Include: scene/environment, subject with details, composition/camera angle,
lighting, style, and quality descriptors.

Rules:
- Output ONLY the English prompt, no explanations
- Preserve all concrete visual details from the user's idea
- Add descriptive words for lighting, color, and style
- 2-4 sentences, one flowing paragraph`,
};
