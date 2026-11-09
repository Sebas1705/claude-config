# Customizing with an overlay

The defaults in this repository are meant to be useful to anyone. Your own rules, skills and tool choices go in an **overlay**: a folder outside this repo, usually a private git repository of yours, applied on top with `--overlay`.

```sh
git clone git@github.com:you/claude-config-personal.git ../claude-config-personal
node install.mjs --dry-run --overlay ../claude-config-personal
node install.mjs --overlay ../claude-config-personal
```

Re-run the same command to update. Without `--overlay` you get the plain defaults. A starting point lives in [`examples/overlay/`](../examples/overlay): copy it and edit.

## Layout of an overlay

Every file is optional.

```
my-overlay/
  overlay.json              extra third-party sources, retire list, more restricted agents
  CLAUDE.md                 replaces the default rules block inside your CLAUDE.md
  settings.fragment.json    more hooks and deny rules, merged with the defaults
  hooks/                    files copied to <home>/hooks/ (for example guard.config.json)
  skills/<name>/SKILL.md    your skills, copied to <home>/skills/
  agents/<name>.md          your agents, copied to <home>/agents/
  commands/<name>.md        your commands, copied to <home>/commands/
```

How each part combines with the defaults:

| Overlay file | Effect |
|---|---|
| `CLAUDE.md` | **Replaces** the default block. The block is delimited by `<!-- claude-config:begin/end -->`; text you wrote outside it is never touched. Use `--no-claude-md` to skip `CLAUDE.md` entirely |
| `settings.fragment.json` | Hook entries are **appended**, deny rules are **united** with the defaults. Same placeholders as the default fragment |
| `hooks/*`, `skills/*`, `agents/*`, `commands/*` | Copied. If a name matches a default file, the **overlay wins** |
| `overlay.json` | Merged into the lock (see below) |

Files that already exist in your Claude folder and were not installed by this tool are never overwritten.

## `overlay.json`

```json
{
  "sources": {
    "my-skills": {
      "repo": "https://github.com/you/my-skills",
      "commit": "0123456789abcdef0123456789abcdef01234567",
      "license": "MIT",
      "reviewed": "2026-11-09",
      "skills": { "from": "skills", "names": "*" }
    }
  },
  "retire": { "skills": ["some-old-skill"] },
  "agentToolRestrictions": { "agents": ["my-reviewer"] }
}
```

- **`sources`** adds third-party sources (same schema as `sources.lock.json`, see [REFERENCE.md](REFERENCE.md)). A source with the same id as a default one replaces it.
- **`retire.skills`** lists skills already in your Claude folder that you want moved aside when you run with `--retire`. They go to `<home>/skills-removed/`, never deleted, and `--uninstall` puts them back.
- **`agentToolRestrictions.agents`** adds agents that get `tools: Read, Grep, Glob, Bash` in their front matter, so they cannot edit files. The tool list itself can be changed with `"tools"`.

## Placeholders in `settings.fragment.json`

`{{HOME}}` is replaced by the absolute Claude folder with forward slashes (on every OS), so a hook command can point at a file you installed:

```json
{
  "hooks": {
    "PreToolUse": [
      { "matcher": "Bash", "hooks": [{ "type": "command", "command": "node \"{{HOME}}/hooks/my-hook.js\"" }] }
    ]
  },
  "permissions": { "deny": ["Read(~/.private/**)"] }
}
```

A hook entry that depends on a source being installed can carry `"_requires": "superpowers"`: it is skipped when that source is not installed or when you pass `--no-hook`. The `_requires` key is removed before the entry is written.

## Change the guard hook

Put `hooks/guard.config.json` in your overlay:

```json
{ "blockCommitTrailers": true, "protectedBranches": ["main", "master", "release"] }
```

See the rule table in the [README](../README.md#the-guard-hook).

## Fork instead?

If you want to change the defaults for everyone who uses your copy (different sources, different deny rules), edit `sources.lock.json` and `config/` in a fork. Keep your personal content in an overlay anyway, so you can pull updates from here without conflicts.
