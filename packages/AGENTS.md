# Packages

Monorepo packages containing production code.

## Structure

- `shared/` — Common code: BullMQ queue config, TypeScript types, JIRA client utilities
- `webhook/` — HTTP server receiving JIRA webhooks, enqueues jobs to Redis
- `poller/` — Polls JIRA API for @dexter comments, alternative to webhook for local dev
- `worker/` — BullMQ worker processing jobs via Claude Code CLI + MCP servers

## Development

When adding a new package, make sure to update the root `package.json` with a `--filter` script.

Do not alias scripts that are already in the package unnecessarily, because they can be accessed with the filter.
