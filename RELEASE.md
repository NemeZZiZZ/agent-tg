# Release checklist (manual)

Publishing is deliberately manual. No changesets, no provenance automation.
A human publishes; the agent never does.

## One-time setup

1. npm account with publish rights for the (unscoped, verified free) names
   `agent-tg`, `opencode-tg`, `claude-code-tg` (https://npmjs.com/signup).
2. Add the GitHub remote if not yet done:
   `git remote add origin git@github.com:NemeZZiZZ/agent-tg.git`.

## Per release

1. Bump all three packages to the same `X.Y.Z` (`packages/*/package.json`;
   also `packages/claude-code/.claude-plugin/plugin.json` `version`).
2. `npm test` — must be green on Node 18, 20 and 22 (CI covers this).
3. `npm pack --dry-run -w packages/core -w packages/opencode -w packages/claude-code`
   — check each tarball contains only its whitelisted files:
   - core: `src/`, `bin/`, `skill/`, `README.md` (+ `package.json`, `LICENSE`)
   - opencode: `index.js`, `src/`, `README.md` (+ `package.json`, `LICENSE`)
   - claude-code: `.claude-plugin/`, `skills/`, `README.md`
     (+ `package.json`, `LICENSE`)
4. Publish, core first (the adapters depend on it):
   ```
   npm publish -w packages/core
   npm publish -w packages/opencode
   npm publish -w packages/claude-code
   ```
5. Tag: `git tag vX.Y.Z && git push --tags` (family version = the core
   version being released).

## Post-release (optional smoke test)

1. `npm i -g agent-tg && agent-tg init && agent-tg send --to personal "hi"`
   in a fresh shell.
2. In an OpenCode project: add `"opencode-tg"` to `plugins`, restart, ask
   the agent to send a Telegram message.
