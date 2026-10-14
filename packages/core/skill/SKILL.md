---
name: agent-tg
description: Send Telegram messages and files to configured channels via the agent-tg CLI
---

# agent-tg

Send text or files to Telegram channels by alias. Channels, bots and tokens
live in ~/.config/agent-tg/config.json — never in the chat.

- List channels: `agent-tg channels`
- Send text: `agent-tg send --to <alias> <text>` (or pipe a message via stdin)
- Send rich-formatted text: `agent-tg send --to <alias> --rich <rich-markdown>`
- Send a file: `agent-tg send --to <alias> --file <path> --caption <text>`

Long messages are split automatically (4096 chars per chunk); files up to
50 MB. Rich markdown (bold, headings, lists, tables) goes out as one
message, up to 32768 chars — call it explicitly with --rich.
An unknown-alias error lists the valid aliases.
If `agent-tg` is not on PATH, install it with `npm i -g agent-tg`.
