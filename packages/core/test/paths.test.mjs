import { test } from "node:test";
import assert from "node:assert/strict";
import { configPath } from "../src/paths.mjs";

const home = "/home/tester";

test("default config path is under $home/.config/agent-tg", () => {
  const p = configPath({ env: {}, platform: "linux", home });
  assert.equal(p, `${home}/.config/agent-tg/config.json`);
});

test("XDG_CONFIG_HOME is honored", () => {
  const p = configPath({ env: { XDG_CONFIG_HOME: "/custom/cfg" }, platform: "linux", home });
  assert.equal(p, "/custom/cfg/agent-tg/config.json");
});

test("AGENT_TG_CONFIG wins over everything", () => {
  const p = configPath({
    env: { AGENT_TG_CONFIG: "/elsewhere/conf.json", XDG_CONFIG_HOME: "/custom/cfg" },
    platform: "linux",
    home,
  });
  assert.equal(p, "/elsewhere/conf.json");
});

test("win32 uses %APPDATA%", () => {
  const p = configPath({ env: { APPDATA: "C:\\Users\\t\\AppData\\Roaming" }, platform: "win32", home });
  assert.equal(p, "C:\\Users\\t\\AppData\\Roaming\\agent-tg\\config.json");
});

test("win32 without APPDATA falls back to $home/AppData/Roaming", () => {
  const p = configPath({ env: {}, platform: "win32", home: "C:\\Users\\t" });
  assert.equal(p, "C:\\Users\\t\\AppData\\Roaming\\agent-tg\\config.json");
});

test("empty env on unix does not throw", () => {
  assert.equal(typeof configPath({ env: {}, platform: "darwin", home }), "string");
});

test("posix: $HOME resolves the home directory", () => {
  // $HOME is the user's expressed home; os.homedir() may disagree in
  // containers/CI. The env value must win on POSIX.
  const p = configPath({ env: { HOME: "/fake/tg-home" }, platform: "linux" });
  assert.equal(p, "/fake/tg-home/.config/agent-tg/config.json");
});

test("win32: $HOME never leaks into the home resolution (Git Bash sets HOME)", () => {
  const p = configPath({ env: { HOME: "/c/Users/t" }, platform: "win32" });
  assert.ok(!p.startsWith("/c/"), p);
});
