# AGENTS.md

## Tool Use

Use available plugins, apps, MCPs, and skills proactively. Select the best tool automatically based on the task:

- Use Context7 for current library, framework, SDK, API, CLI, and cloud-service documentation.
- Use Superpowers for feature design, debugging, implementation plans, TDD, execution workflows, and verification before completion.
- Use MagicPath for UI design, components, themes, canvas selection, and repo-to-canvas workflows.
- Use Supabase tools and skills for Supabase auth, database, storage, realtime, RLS, and migrations.
- Use Vercel tools and skills for deployments, logs, environment variables, domains, and browser verification.
- Use GitHub tools and skills for PRs, issues, CI failures, and review comments.

Do not ask the user to choose tools unless credentials, destructive changes, paid/external actions, or major scope tradeoffs require confirmation. Prefer using the right tool automatically and briefly mention why.

## MagicPath

MagicPath has been authenticated on this machine. `npx -y magicpath-ai whoami -o json` verified a logged-in MagicPath user for `aldwin.gotingco475@gmail.com`.

Do not ask the user to authenticate MagicPath again unless a MagicPath command reports an authentication failure.

## PB Finance Signature Design System

For all future UI and UX work, use the canonical tokens and usage rules in `docs/design-system/pb-signature-colors.md`. Do not introduce raw brand hex values or page-owned status colors when a semantic token or shared UI primitive exists.
