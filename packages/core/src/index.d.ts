export interface TgBot {
  tokenEnv?: string;
  token?: string;
}

export interface TgChannel {
  id: string;
  bot: string;
  chatId: string;
}

export interface TgConfig {
  default?: string;
  bots: Record<string, TgBot>;
  channels: TgChannel[];
}

export interface TgSendOptions {
  /** Skip loadConfig and use this config directly. */
  config?: TgConfig;
  env?: Record<string, string | undefined>;
  platform?: string;
  home?: string;
  configPath?: string;
  warn?: (message: string) => void;
  fetch?: typeof fetch;
  apiBase?: string;
  signal?: AbortSignal;
  sleep?: (ms: number) => Promise<void>;
  /** sendFile only; default 52428800 (50 MB). */
  maxFileBytes?: number;
}

export interface TgResolvedChannel {
  alias: string;
  bot: string;
  chatId: string;
  token: string;
}

export interface TgChannelInfo {
  id: string;
  bot: string;
  chatId: string;
  tokenEnv: string | undefined;
  tokenSet: boolean;
}

export interface TgSendTextResult {
  chatId: string;
  chunks: number[];
}

export interface TgSendFileResult {
  chatId: string;
  messageId: number;
}

export declare class TgError extends Error {
  name: "TgError";
  code: string;
  constructor(message: string, code: string);
}

export declare function configPath(opts?: {
  env?: Record<string, string | undefined>;
  platform?: string;
  home?: string;
}): string;

export declare function loadConfig(opts?: TgSendOptions & { configPath?: string }): Promise<TgConfig>;

export declare function resolveChannel(
  config: TgConfig,
  alias: string | undefined,
  opts?: { env?: Record<string, string | undefined> },
): TgResolvedChannel;

export declare function channelList(
  config: TgConfig,
  opts?: { env?: Record<string, string | undefined> },
): TgChannelInfo[];

export declare function chunkText(text: string): string[];

export declare function sendText(
  args: { to?: string; text?: string },
  opts?: TgSendOptions,
): Promise<TgSendTextResult>;

export declare function sendFile(
  args: { to?: string; file: string; caption?: string },
  opts?: TgSendOptions,
): Promise<TgSendFileResult>;

export declare function sendRich(
  args: { to?: string; markdown?: string },
  opts?: TgSendOptions,
): Promise<TgSendFileResult>;

export declare function init(opts?: {
  env?: Record<string, string | undefined>;
  platform?: string;
  home?: string;
  skillDir?: string;
  configOnly?: boolean;
  skillOnly?: boolean;
  warn?: (message: string) => void;
}): { configCreated: boolean; configPath: string; skillPath: string };
