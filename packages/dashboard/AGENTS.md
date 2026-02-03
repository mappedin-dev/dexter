# Dashboard

Dashboard for queue monitoring and configuration. Served by the webhook server at `/admin`.

## Stack

Vite, React 19, React Router (HashRouter), TanStack Query, Tailwind CSS

## Routing

Hash-based routing for deep linking. The hash is never sent to the server, so the webhook server serves static files without SPA fallback.

## Pages

Page URLs should follow the format of existing pages.

- `#/` — Home: job counts, success rate
- `#/jobs` — Jobs list with status filtering
- `#/jobs/:id` — Job details with retry/remove
- `#/settings` — Bot name configuration

## Development

Dashboard container runs `vite build --watch`. Output goes to shared Docker volume mounted by webhook.

## Components

When building pages and components. Try and reuse existing components in the `components/` folder within reason. If an existing component doesn't fit, try and create a new reusable components, but do not overload components with too many props. Sometimes it's ok for custom components to be single-use only.
