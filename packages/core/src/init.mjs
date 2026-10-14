import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { configPath, homeDir } from "./paths.mjs";

const SCAFFOLD = `{
  "default": "personal",
  "bots": { "main": { "tokenEnv": "TG_BOT_MAIN" } },
  "channels": [{ "id": "personal", "bot": "main", "chatId": "123456789" }]
}
`;

/**
 * Create the config scaffold (only if absent) and install the universal
 * SKILL.md into the user's skills directory (always overwritten).
 *
 * @param {{ env?: Record<string,string|undefined>, platform?: string, home?: string, skillDir?: string, configOnly?: boolean, skillOnly?: boolean, warn?: (m: string) => void }} [opts]
 * @returns {{ configCreated: boolean, configPath: string, skillPath: string }}
 */
export function init(opts = {}) {
  const home = homeDir(opts);
  const file = configPath(opts);

  let configCreated = false;
  if (!opts.skillOnly) {
    mkdirSync(join(file, ".."), { recursive: true });
    if (!existsSync(file)) {
      writeFileSync(file, SCAFFOLD);
      configCreated = true;
    }
  }

  const skillDir = opts.skillDir ?? join(home, ".agents", "skills", "agent-tg");
  const skillPath = join(skillDir, "SKILL.md");
  if (!opts.configOnly) {
    mkdirSync(skillDir, { recursive: true });
    const source = readFileSync(new URL("../skill/SKILL.md", import.meta.url), "utf8");
    writeFileSync(skillPath, source);
  }

  return { configCreated, configPath: file, skillPath };
}
