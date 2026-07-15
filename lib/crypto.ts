// AES-256-GCM 加解密 —— 用于用户 Agnes API Key 的安全存储
// 密钥来自环境变量 ENCRYPTION_KEY(base64 编码的 32 字节)
//
// 加密格式:base64(iv) : base64(ciphertext + authTag)
// GCM 模式自带完整性校验,密钥错误会抛错而非返回乱数据

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const KEY_BUFFER = (() => {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('ENCRYPTION_KEY 环境变量未配置');
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error(`ENCRYPTION_KEY 必须是 base64 编码的 32 字节,当前 ${buf.length} 字节`);
  }
  return buf;
})();

const IV_LENGTH = 12; // GCM 推荐 96-bit IV

/**
 * 加密明文字符串
 * 返回格式:base64(iv):base64(ciphertext+tag)
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', KEY_BUFFER, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // tag 拼在密文末尾,解密时拆出来
  return `${iv.toString('base64')}:${Buffer.concat([encrypted, tag]).toString('base64')}`;
}

/**
 * 解密 encrypt() 产出的密文
 */
export function decrypt(payload: string): string {
  const [ivB64, dataB64] = payload.split(':');
  if (!ivB64 || !dataB64) {
    throw new Error('密文格式错误');
  }
  const iv = Buffer.from(ivB64, 'base64');
  const combined = Buffer.from(dataB64, 'base64');
  const tag = combined.subarray(combined.length - 16);
  const ciphertext = combined.subarray(0, combined.length - 16);

  const decipher = createDecipheriv('aes-256-gcm', KEY_BUFFER, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/**
 * 脱敏 API Key 用于前端显示
 * sk-abcdefghij...wxyz → sk-...wxyz
 */
export function maskKey(key: string): string {
  if (!key) return '';
  if (key.length <= 8) return '***';
  const prefix = key.slice(0, 3);
  const suffix = key.slice(-4);
  return `${prefix}...${suffix}`;
}
