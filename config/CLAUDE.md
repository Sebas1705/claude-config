# Working defaults (installed by claude-config)

## Git
- Never skip hooks (`--no-verify`), never force-push to `main`/`master`, never commit secrets (`.env`, keystores, tokens, service-account files).
- Commit, push and open pull requests only when asked.

## Secrets
- Never print or log secret values; refer to them by name. Prefer a secrets manager or environment variables over files in the repository.

## Working style
- Look at what already exists (code, docs, tests, project notes) before proposing something new.
- Run the checks you can before saying something works, and say plainly what you could not verify.
- Ask before destructive or hard-to-reverse actions: deleting data, publishing or releasing, writing to production, merging.

## Skills
- The method skills from superpowers are installed: use `brainstorming` before creative work, `systematic-debugging` for bugs,
  `test-driven-development` for features and fixes, and `verification-before-completion` before claiming success.
