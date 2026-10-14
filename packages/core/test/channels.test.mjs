import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveChannel, channelList } from "../src/channels.mjs";

const config = {
  default: "dev",
  bots: {
    main: { tokenEnv: "TG_BOT_MAIN" },
    inline: { token: "111:secret-token-value" },
    unset: { tokenEnv: "TG_BOT_UNSET" },
  },
  channels: [
    { id: "dev", bot: "main", chatId: "12345" },
    { id: "ops", bot: "inline", chatId: "-100999" },
    { id: "ghost", bot: "unset", chatId: "42" },
  ],
};

test("explicit alias resolves to bot, chatId and env token", () => {
  const ch = resolveChannel(config, "dev", { env: { TG_BOT_MAIN: "111:abc" } });
  assert.deepEqual(ch, { alias: "dev", bot: "main", chatId: "12345", token: "111:abc" });
});

test("missing alias falls back to config.default", () => {
  const ch = resolveChannel(config, undefined, { env: { TG_BOT_MAIN: "111:abc" } });
  assert.equal(ch.alias, "dev");
});

test("no alias and no default is UNKNOWN_CHANNEL", () => {
  assert.throws(
    () => resolveChannel({ ...config, default: undefined }, undefined, { env: {} }),
    (err) => err.code === "UNKNOWN_CHANNEL" && /no channel given and no default configured/.test(err.message),
  );
});

test("unknown alias lists all valid ids", () => {
  assert.throws(
    () => resolveChannel(config, "nope", { env: {} }),
    (err) =>
      err.code === "UNKNOWN_CHANNEL" &&
      /Unknown channel "nope"/.test(err.message) &&
      err.message.includes("dev") &&
      err.message.includes("ops") &&
      err.message.includes("ghost"),
  );
});

test("missing env token is MISSING_TOKEN naming the env var, never the token", () => {
  assert.throws(
    () => resolveChannel(config, "dev", { env: {} }),
    (err) =>
      err.code === "MISSING_TOKEN" &&
      err.message.includes("TG_BOT_MAIN") &&
      err.message.includes("main") &&
      !err.message.includes("secret-token-value"),
  );
});

test("inline token resolves without env", () => {
  const ch = resolveChannel(config, "ops", { env: {} });
  assert.equal(ch.token, "111:secret-token-value");
});

test("channelList reports tokenEnv and tokenSet per channel", () => {
  const list = channelList(config, { env: { TG_BOT_MAIN: "111:abc" } });
  assert.deepEqual(list, [
    { id: "dev", bot: "main", chatId: "12345", tokenEnv: "TG_BOT_MAIN", tokenSet: true },
    { id: "ops", bot: "inline", chatId: "-100999", tokenEnv: undefined, tokenSet: true },
    { id: "ghost", bot: "unset", chatId: "42", tokenEnv: "TG_BOT_UNSET", tokenSet: false },
  ]);
});
