// AES-256-GCM 加解密 —— 用于用户 Agnes API Key 的安全存储
//
// 密钥来自环境变量 ENCRYPTION_KEY(base64 编码的 32 字节)
// 支持密钥版本前缀(未来轮换时:encrypt 用 v2,decrypt 兼容 v1)
//
// 加密格式:v1:base64(iv):base64(ciphertext + authTag)
// 老格式(无 v1: 前缀)按 v1 解密,向后兼容

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const CURRENT_VERSION = 'v1';
const IV_LENGTH = 12; // GCM 推荐 96-bit IV

// 惰性加载:不在模块顶层抛错,避免 import 时崩(让调用方拿到友好错误)
let _keyBuffer: Buffer | null = null;
function getKeyBuffer(): Buffer {
  if (_keyBuffer) return _keyBuffer;
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error('ENCRYPTION_KEY 环境变量未配置');
  }
  const buf = Buffer.from(raw, 'base64');
  if (buf.length !== 32) {
    throw new Error(`ENCRYPTION_KEY 必须是 base64 编码的 32 字节,当前 ${buf.length} 字节`);
  }
  _keyBuffer = buf;
  return buf;
}

/**
 * 加密明文字符串
 * 返回格式:v1:base64(iv):base64(ciphertext+tag)
 */
export function encrypt(plaintext: string): string {
  const key = getKeyBuffer();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // tag 拼在密文末尾,解密时拆出来
  return `${CURRENT_VERSION}:${iv.toString('base64')}:${Buffer.concat([encrypted, tag]).toString('base64')}`;
}

/**
 * 解密 encrypt() 产出的密文
 * 兼容老格式(无版本前缀)
 */
export function decrypt(payload: string): string {
  const key = getKeyBuffer();
  const parts = payload.split(':');

  let ivB64: string;
  let dataB64: string;

  if (parts.length === 3 && parts[0] === CURRENT_VERSION) {
    // 新格式:v1:iv:data
    [, ivB64, dataB64] = parts;
  } else if (parts.length === 2) {
    // 老格式(无版本前缀):iv:data
    [ivB64, dataB64] = parts;
  } else {
    throw new Error('密文格式错误');
  }

  const iv = Buffer.from(ivB64, 'base64');
  const combined = Buffer.from(dataB64, 'base64');
  const tag = combined.subarray(combined.length - 16);
  const ciphertext = combined.subarray(0, combined.length - 16);

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
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
