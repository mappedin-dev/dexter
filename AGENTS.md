# Architecture

Follow the project [architecture](./docs/architecture.md).

Minor changes should adhere to the architecture completely.

Major changes should be discussed, and if implemented, should be documented in the architecture file(s).

# README.md

Ensure the [README](./README.md) is updated with any new project requirements.

If unsure about whether a change should be reflected in the README, ask.

# AGENTS.md

When adding new AGENTS.md files, keep the contents as concise as possible.

AGENTS.md files should be optimized for agents, but remain human readable.

Outline and summarize content so context overhead in minimized.

# Shared Types

Use types from `@mapthew/shared` whenever possible:

- API request/response types live in `packages/shared/src/api-types.ts`
- All types (`JiraJob`, `GitHubJob`, `AdminJob`, `AppConfig`, `ClaudeModel`, etc.) live in `packages/shared/src/types.ts`
- Runtime utility functions live in `packages/shared/src/utils.ts`

Do not duplicate types across packages. If a type is needed in multiple packages, add it to shared.

# Claude Code

If you are Claude Code, read `AGENTS.md` and `.cursor/rules/*.(md|mdc)` files in this repo for architecture and development guidelines.

# Tests

Always double check tests are passing when making functional changes.

After fixing a bug that isn't purely styling, always add a test case to make sure the bug doesn't happen anymore.
