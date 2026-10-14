# opencode-tg

[OpenCode](https://opencode.ai) plugin that gives your agent a `telegram_send` tool — send Telegram messages and files to configured channels, backed by [`agent-tg`](https://www.npmjs.com/package/agent-tg).

## Setup

1. Install and configure the CLI once:

   ```sh
   npm i -g agent-tg
   agent-tg init
   # create a bot with @BotFather, then:
   export TG_BOT_MAIN="<token>"
   # edit ~/.config/agent-tg/config.json: set your chatId, add channels
   ```

2. Add the plugin to your project or global `opencode.jsonc`:

   ```jsonc
   {
     "plugins": ["opencode-tg"]
   }
   ```

   With options (optional `default` channel alias):

   ```jsonc
   {
     "plugins": [{ "package": "opencode-tg", "options": { "default": "alerts" } }]
   }
   ```

3. Restart OpenCode. The tool appears as `telegram_send` in the `telegram` namespace.

## Tool

`telegram_send({ to?, text?, rich?, file?, caption? })`

- `to` — channel alias; the schema enum lists your configured channels. Omit to use the config `default` (or the plugin `options.default`).
- `text` — message text; long messages are split into 4096-char chunks automatically.
- `rich` — send `text` as one rich-formatted message (rich markdown, ≤ 32768 chars, no chunking).
- `file` — absolute path, up to 50 MB, sent as a document.
- `caption` — file caption, up to 1024 chars (only with `file`).

Without a config the tool still registers (no enum) and its errors tell the model to run `agent-tg init`. After creating the config, restart OpenCode to refresh the alias enum — sending works immediately, no restart needed.

## Security

Tokens live in the environment (`tokenEnv`), never in chat. Errors never contain tokens or URLs. No telemetry.

MIT © 2026 NemeZZiZZ
