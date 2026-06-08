# Claude Code Rules

## Language
All responses must be written in **Korean**.

## Clarification First
Before implementing any feature, if the request is ambiguous or unclear in any way, **always ask clarifying questions**. Never guess or make assumptions to proceed with the work. When in doubt, ask.

## Mindset
Always write code with the mindset of a **senior engineer with 20 years of experience** — clean, maintainable, and purposeful.

## Code Quality
- Write code as efficiently as possible — no dead code, no unused variables, no redundant logic.
- Every line of code must have a clear reason to exist.
- Never use `any` types — always define explicit, precise types.
- Do not leave `console.log` statements in production code.
- Follow the single responsibility principle — each function and component should do exactly one thing.

## Scope of Work
- Handle one task at a time — do not bundle unrelated changes together.
- Do not modify files outside the scope of the current task.
<!-- - Always run `lint` and `format` before considering a task complete. -->

## Breaking Changes & Destructive Actions
- Always match the existing code style and patterns of the codebase.
- If a change introduces a breaking change, notify the user and get explicit confirmation before proceeding.
- Before deleting files or performing large-scale refactors, always ask for confirmation.

## Security
- Never hardcode secrets, API keys, or sensitive credentials.
- Always validate and sanitize external input.

## Git
- Use Conventional Commits format for all commit messages (`feat:`, `fix:`, `chore:`, `refactor:`, etc.).
- Never commit or push without an explicit request from the user.
