import { posix, win32 } from "node:path";
import os from "node:os";

/**
 * Resolve the user's home directory. On POSIX $HOME wins over os.homedir():
 * it is the user's expressed home, and in containers/CI it can diverge from
 * the passwd entry os.homedir() derives. On win32 $HOME is ignored
 * (Git Bash sets it to a POSIX-style path node:path join cannot use).
 *
 * @param {{ env?: Record<string, string|undefined>, platform?: string, home?: string }} [opts]
 * @returns {string} home directory
 */
export function homeDir(opts = {}) {
  if (opts.home) return opts.home;
  const env = opts.env ?? process.env;
  const platform = opts.platform ?? process.platform;
  if (platform !== "win32" && env.HOME) return env.HOME;
  return os.homedir();
}

/**
 * Resolve the agent-tg config file path. Pure, no IO.
 *
 * Order: AGENT_TG_CONFIG (verbatim) → win32: %APPDATA%\agent-tg\config.json
 * (fallback $home\AppData\Roaming) → else: ${XDG_CONFIG_HOME || $home/.config}/agent-tg/config.json.
 *
 * @param {{ env?: Record<string, string|undefined>, platform?: string, home?: string }} [opts]
 * @returns {string} absolute config path
 */
export function configPath(opts = {}) {
  const env = opts.env ?? process.env;
  const platform = opts.platform ?? process.platform;
  const home = homeDir(opts);
  const join = platform === "win32" ? win32.join : posix.join;

  if (env.AGENT_TG_CONFIG) return env.AGENT_TG_CONFIG;
  if (platform === "win32") {
    return join(env.APPDATA ?? join(home, "AppData", "Roaming"), "agent-tg", "config.json");
  }
  return join(env.XDG_CONFIG_HOME ?? join(home, ".config"), "agent-tg", "config.json");
}
