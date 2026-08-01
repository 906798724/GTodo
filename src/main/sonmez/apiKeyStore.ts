import { app, safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';

/**
 * Sonmez 顾问的配置文件存储
 *
 * 设计：
 * - API Key 通过 Electron safeStorage 加密后存储（平台原生密钥链）
 * - 其余非敏感配置（如模型选择）明文 JSON 存储
 * - 文件路径：userData/sonmez-config.json
 *
 * 安全性：
 * - safeStorage 在 Windows 上基于 DPAPI，仅当前用户可解密
 * - 即使配置文件被复制到其他机器，API Key 也无法解密
 */

interface SonmezConfig {
  /** 加密后的 API Key（base64） */
  encryptedApiKey?: string;
  /** 模型名称，默认 deepseek-v4-flash */
  model?: string;
  /** API 基础 URL，默认官方地址 */
  baseUrl?: string;
  /** 是否启用思考模式（DeepSeek V4 新增），默认 false 以获得更快响应 */
  thinkingEnabled?: boolean;
}

const DEFAULT_CONFIG: Required<Pick<SonmezConfig, 'model' | 'baseUrl' | 'thinkingEnabled'>> = {
  model: 'deepseek-v4-flash',
  baseUrl: 'https://api.deepseek.com',
  thinkingEnabled: false,
};

/**
 * 旧模型名 → 新模型名映射（兼容历史配置）
 * DeepSeek 官方公告：deepseek-chat / deepseek-reasoner 于 2026/07/24 23:59 弃用
 * - deepseek-chat     → deepseek-v4-flash（非思考模式）
 * - deepseek-reasoner → deepseek-v4-pro（思考模式）
 */
function normalizeModel(model: string | undefined): string {
  if (!model) return DEFAULT_CONFIG.model;
  switch (model) {
    case 'deepseek-chat':
      return 'deepseek-v4-flash';
    case 'deepseek-reasoner':
      return 'deepseek-v4-pro';
    default:
      return model;
  }
}

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'sonmez-config.json');
}

function readConfig(): SonmezConfig {
  try {
    const cfgPath = getConfigPath();
    if (fs.existsSync(cfgPath)) {
      const raw = fs.readFileSync(cfgPath, 'utf-8');
      return JSON.parse(raw) as SonmezConfig;
    }
  } catch (err) {
    console.error('[Sonmez] Failed to read config:', err);
  }
  return {};
}

function writeConfig(config: SonmezConfig): void {
  try {
    const cfgPath = getConfigPath();
    fs.writeFileSync(cfgPath, JSON.stringify(config, null, 2), 'utf-8');
  } catch (err) {
    console.error('[Sonmez] Failed to write config:', err);
  }
}

/**
 * 保存 API Key（加密存储）
 * 如果传入空字符串，则清除已存储的 Key
 */
export function saveApiKey(apiKey: string): void {
  const config = readConfig();
  if (!apiKey) {
    delete config.encryptedApiKey;
  } else {
    if (!safeStorage.isEncryptionAvailable()) {
      // safeStorage 不可用时回退为明文（开发环境或非 Windows）
      console.warn('[Sonmez] safeStorage not available, storing API key as plaintext');
      config.encryptedApiKey = `plain:${apiKey}`;
    } else {
      const buf = safeStorage.encryptString(apiKey);
      config.encryptedApiKey = buf.toString('base64');
    }
  }
  writeConfig(config);
}

/** 读取已存储的 API Key（解密） */
export function loadApiKey(): string {
  const config = readConfig();
  if (!config.encryptedApiKey) return '';

  // 兼容明文回退
  if (config.encryptedApiKey.startsWith('plain:')) {
    return config.encryptedApiKey.slice(6);
  }

  if (!safeStorage.isEncryptionAvailable()) {
    console.warn('[Sonmez] safeStorage not available, cannot decrypt API key');
    return '';
  }
  try {
    const buf = Buffer.from(config.encryptedApiKey, 'base64');
    return safeStorage.decryptString(buf);
  } catch (err) {
    console.error('[Sonmez] Failed to decrypt API key:', err);
    return '';
  }
}

/** 是否已配置 API Key */
export function hasApiKey(): boolean {
  return !!readConfig().encryptedApiKey;
}

/** 获取模型名称（自动兼容旧模型名） */
export function getModel(): string {
  return normalizeModel(readConfig().model);
}

/** 设置模型名称 */
export function setModel(model: string): void {
  const config = readConfig();
  config.model = model || DEFAULT_CONFIG.model;
  writeConfig(config);
}

/** 是否启用思考模式 */
export function getThinkingEnabled(): boolean {
  const config = readConfig();
  // 旧配置中如果 model 是 deepseek-reasoner，等价于思考模式
  if (config.model === 'deepseek-reasoner') return true;
  return config.thinkingEnabled ?? DEFAULT_CONFIG.thinkingEnabled;
}

/** 设置思考模式 */
export function setThinkingEnabled(enabled: boolean): void {
  const config = readConfig();
  config.thinkingEnabled = !!enabled;
  writeConfig(config);
}

/** 获取 baseUrl */
export function getBaseUrl(): string {
  return readConfig().baseUrl || DEFAULT_CONFIG.baseUrl;
}

/** 设置 baseUrl */
export function setBaseUrl(baseUrl: string): void {
  const config = readConfig();
  config.baseUrl = baseUrl || DEFAULT_CONFIG.baseUrl;
  writeConfig(config);
}
