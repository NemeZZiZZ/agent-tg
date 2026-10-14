import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import plugin from "../src/index.mjs";
import { startServer } from "../../core/test/helpers/server.mjs";

const config = {
  default: "personal",
  bots: { main: { tokenEnv: "TG_BOT_MAIN" } },
  channels: [
    { id: "personal", bot: "main", chatId: "123" },
    { id: "alerts", bot: "main", chatId: "456" },
  ],
};

function makeCtx(options = {}) {
  const state = {};
  const ctx = {
    options,
    tool: {
      transform(fn) {
        state.transform = fn;
      },
    },
  };
  const editor = {
    namespace(ns) {
      state.ns = ns;
    },
    add(tool) {
      state.tool = tool;
    },
  };
  return { ctx, state, editor };
}

async function setupTool(options) {
  const { ctx, state, editor } = makeCtx(options);
  await plugin.setup(ctx);
  await state.transform(editor);
  return { state, tool: state.tool };
}

function withEnv(overrides, fn) {
  const saved = { ...process.env };
  return (async () => {
    try {
      Object.assign(process.env, overrides);
      return await fn();
    } finally {
      for (const key of Object.keys(overrides)) delete process.env[key];
      Object.assign(process.env, saved);
    }
  })();
}

function envFile(content) {
  const dir = mkdtempSync(join(tmpdir(), "agent-tg-plug-"));
  const file = join(dir, "config.json");
  writeFileSync(file, typeof content === "string" ? content : JSON.stringify(content));
  return file;
}

test("plugin id and shape", () => {
  assert.equal(plugin.id, "telegram");
  assert.equal(typeof plugin.setup, "function");
});

test("normal mode: tool under namespace telegram, enum from config", async () => {
  const cfg = envFile(config);
  await withEnv({ AGENT_TG_CONFIG: cfg, TG_BOT_MAIN: "TESTTOKEN" }, async () => {
    const { state, tool } = await setupTool({});
    assert.equal(state.ns.name, "telegram");
    assert.equal(tool.name, "send");
    assert.equal(tool.options.namespace, "telegram");
    assert.deepEqual(tool.input.properties.to.enum, ["personal", "alerts"]);
    assert.deepEqual(tool.input.required, []);
    assert.equal(tool.input.additionalProperties, false);
  });
});

test("execute text → sends via api and reports chunks", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const cfg = envFile(config);
  await withEnv({ AGENT_TG_CONFIG: cfg, TG_BOT_MAIN: "TESTTOKEN", AGENT_TG_API_BASE: s.url }, async () => {
    const { tool } = await setupTool({});
    const res = await tool.execute({ text: "hi" }, { signal: undefined, progress: async () => {} });
    assert.deepEqual(res, { content: "✓ sent to personal (1 chunk)" });
    assert.equal(s.requests.length, 1);
    assert.equal(s.requests[0].url, "/botTESTTOKEN/sendMessage");
  });
});

test("execute file+caption → sendDocument, basename in report", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const cfg = envFile(config);
  const dir = mkdtempSync(join(tmpdir(), "agent-tg-plug-"));
  const file = join(dir, "out.log");
  writeFileSync(file, "data");
  await withEnv({ AGENT_TG_CONFIG: cfg, TG_BOT_MAIN: "TESTTOKEN", AGENT_TG_API_BASE: s.url }, async () => {
    const { tool } = await setupTool({});
    const res = await tool.execute({ file, caption: "c" }, { signal: undefined, progress: async () => {} });
    assert.deepEqual(res, { content: "✓ sent out.log to personal" });
    assert.ok(s.requests[0].url.includes("/sendDocument"));
  });
});

test("execute unknown alias rejects listing valid ones", async () => {
  const cfg = envFile(config);
  await withEnv({ AGENT_TG_CONFIG: cfg, TG_BOT_MAIN: "TESTTOKEN" }, async () => {
    const { tool } = await setupTool({});
    await assert.rejects(
      () => tool.execute({ to: "nope", text: "x" }, { signal: undefined, progress: async () => {} }),
      (err) => err.message.includes("personal") && err.message.includes("alerts"),
    );
  });
});

test("execute without text and file rejects", async () => {
  const cfg = envFile(config);
  await withEnv({ AGENT_TG_CONFIG: cfg, TG_BOT_MAIN: "TESTTOKEN" }, async () => {
    const { tool } = await setupTool({});
    await assert.rejects(() => tool.execute({}, { signal: undefined, progress: async () => {} }), /text or file/);
  });
});

test("execute with both text and file rejects", async () => {
  const cfg = envFile(config);
  await withEnv({ AGENT_TG_CONFIG: cfg, TG_BOT_MAIN: "TESTTOKEN" }, async () => {
    const { tool } = await setupTool({});
    await assert.rejects(
      () => tool.execute({ text: "x", file: "/tmp/y" }, { signal: undefined, progress: async () => {} }),
      /either/,
    );
  });
});

test("options.default routes the send when input.to omitted (request body pins the recipient)", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const cfg = envFile(config); // config default: personal (chatId 123); alerts → 456
  await withEnv({ AGENT_TG_CONFIG: cfg, TG_BOT_MAIN: "TESTTOKEN", AGENT_TG_API_BASE: s.url }, async () => {
    const { tool } = await setupTool({ default: "alerts" });
    const res = await tool.execute({ text: "hi" }, { signal: undefined, progress: async () => {} });
    assert.equal(res.content, "✓ sent to alerts (1 chunk)");
    assert.equal(s.requests[0].json.chat_id, "456");
  });
});

test("options.default works when the config has no default channel", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const noDefault = { ...config, default: undefined };
  const cfg = envFile(noDefault);
  await withEnv({ AGENT_TG_CONFIG: cfg, TG_BOT_MAIN: "TESTTOKEN", AGENT_TG_API_BASE: s.url }, async () => {
    const { tool } = await setupTool({ default: "alerts" });
    const res = await tool.execute({ text: "hi" }, { signal: undefined, progress: async () => {} });
    assert.equal(res.content, "✓ sent to alerts (1 chunk)");
    assert.equal(s.requests[0].json.chat_id, "456");
  });
});

test("execute rich text → sendRichMessage, rich report", async (t) => {
  const s = await startServer();
  t.after(() => s.close());
  const cfg = envFile(config);
  await withEnv({ AGENT_TG_CONFIG: cfg, TG_BOT_MAIN: "TESTTOKEN", AGENT_TG_API_BASE: s.url }, async () => {
    const { tool } = await setupTool({});
    const res = await tool.execute({ text: "**hi**", rich: true }, { signal: undefined, progress: async () => {} });
    assert.deepEqual(res, { content: "✓ sent rich to personal" });
    assert.equal(s.requests.length, 1);
    assert.ok(s.requests[0].url.includes("/sendRichMessage"));
    assert.deepEqual(s.requests[0].json, { chat_id: "123", rich_message: { markdown: "**hi**" } });
  });
});

test("execute rich with file rejects", async () => {
  const cfg = envFile(config);
  await withEnv({ AGENT_TG_CONFIG: cfg, TG_BOT_MAIN: "TESTTOKEN" }, async () => {
    const { tool } = await setupTool({});
    await assert.rejects(
      () => tool.execute({ file: "/tmp/y", rich: true }, { signal: undefined, progress: async () => {} }),
      /rich requires text/,
    );
  });
});

test("degraded mode: tool added without enum, execute surfaces NO_CONFIG hint", async () => {
  await withEnv({ AGENT_TG_CONFIG: "/nonexistent/config.json" }, async () => {
    const { tool } = await setupTool({});
    assert.equal(tool.name, "send");
    assert.equal(tool.input.properties.to.enum, undefined);
    await assert.rejects(
      () => tool.execute({ text: "x" }, { signal: undefined, progress: async () => {} }),
      (err) => /agent-tg init/.test(err.message),
    );
  });
});
