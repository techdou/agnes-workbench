// 加解密单元测试 —— AES-256-GCM 往返 + 脱敏
import { describe, it, expect, beforeAll } from 'vitest';
import { encrypt, decrypt, maskKey } from '@/lib/crypto';

// 测试需要 ENCRYPTION_KEY(必须在运行测试前设置)
beforeAll(() => {
  if (!process.env.ENCRYPTION_KEY) {
    // 32 字节 base64
    process.env.ENCRYPTION_KEY = Buffer.alloc(32, 1).toString('base64');
  }
});

describe('crypto / AES-256-GCM', () => {
  it('加解密往返保持一致', () => {
    const plaintext = 'sk-test-1234567890-abcdefghij';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('每次加密输出不同(iv 随机)', () => {
    const plaintext = 'same input';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  it('密文格式 v1:iv:ciphertext', () => {
    const encrypted = encrypt('hello');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe('v1');
    expect(parts[1]).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 iv
    expect(parts[2]).toMatch(/^[A-Za-z0-9+/=]+$/); // base64 ct+tag
  });

  it('兼容老格式 iv:ciphertext(无版本前缀)', () => {
    // 模拟老格式密文:直接构造一个不带 v1: 前缀的有效密文
    const encrypted = encrypt('legacy');
    const stripped = encrypted.split(':').slice(1).join(':'); // 去掉 v1:
    expect(decrypt(stripped)).toBe('legacy');
  });

  it('篡改密文导致解密失败(GCM 完整性校验)', () => {
    const encrypted = encrypt('original');
    const [iv, data] = encrypted.split(':');
    // 篡改最后一个字符
    const tamperedData = data.slice(0, -1) + (data.slice(-1) === 'A' ? 'B' : 'A');
    expect(() => decrypt(`${iv}:${tamperedData}`)).toThrow();
  });

  it('空字符串加解密', () => {
    const encrypted = encrypt('');
    expect(decrypt(encrypted)).toBe('');
  });

  it('长字符串加解密', () => {
    const long = 'a'.repeat(10000);
    expect(decrypt(encrypt(long))).toBe(long);
  });
});

describe('crypto / maskKey', () => {
  it('脱敏 API Key', () => {
    expect(maskKey('sk-abcdefghij')).toBe('sk-...ghij');
  });

  it('短 key 返回 *** ', () => {
    expect(maskKey('short')).toBe('***');
    expect(maskKey('')).toBe('');
  });

  it('保留前缀 3 + 后缀 4', () => {
    expect(maskKey('sk-1234567890abcdef')).toBe('sk-...cdef');
  });
});
