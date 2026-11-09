# Customizing with an overlay

The defaults in this repository are meant to be useful to anyone. Your own rules, skills and tool choices go in an **overlay**: a folder outside this repo, usually a private git repository of yours, applied on top with `--overlay`.

```sh
git clone git@github.com:you/claude-config-personal.git ../claude-config-personal
node install.mjs --dry-run --overlay ../claude-config-personal
node install.mjs --overlay ../claude-config-personal
```

Re-run the same command to update. Without `--overlay` you get the plain defaults. A starting point lives in [`examples/overlay/`](../examples/overlay): copy it and edit.

## Three ways to choose an overlay

| How | When |
|---|---|
| `--overlay <dir>` | Any folder, for example your private overlay repository |
| `--profile <name>` | A profile published in this repository under `profiles/<name>` (`--profile sebas` is the author's) |
| `CLAUDE_CONFIG_OVERLAY=<dir>` | Your default on a machine: used when none of the flags above is given, so a plain `node install.mjs` applies your overlay |

`--no-overlay` ignores all of them, and `--overlay` with `--profile` is an error. A profile name can only be a folder name inside `profiles/`.

Set the default once per machine:

```sh
# macOS / Linux (add to ~/.zshrc or ~/.bashrc)
export CLAUDE_CONFIG_OVERLAY="$HOME/Documents/Repos/my-claude-overlay"

# Windows PowerShell (persists for your user)
[Environment]::SetEnvironmentVariable("CLAUDE_CONFIG_OVERLAY", "$HOMEDocumentsReposmy-claude-overlay", "User")
```

## What to keep out of a public overlay

If you publish your overlay (as `profiles/sebas` is), read every file first. Skills and rules describe how you work, and a description of how you work can reveal what you would rather not publish:

- names or details of private projects, customers or employers;
- where your secrets live: secrets-manager project names, CI secret names, which artifact embeds a credential;
- internal URLs, absolute paths on your machine, e-mail addresses (a commit author is also published: use your GitHub no-reply address).

Keep that in a **private** overlay and set it as your default with `CLAUDE_CONFIG_OVERLAY`. This repository's tests can enforce it: list the terms that must never be published, one per line, in an untracked `.privacy-terms` file and `npm test` fails if any tracked file contains one (the file is ignored by git, so the terms are not published either).

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

## Several overlays

One overlay is applied per run, but an overlay can **extend** others, so a private overlay does not have to copy a public profile. In its `overlay.json`:

```json
{ "extends": ["profile:sebas", "../shared-rules"] }
```

- `profile:<name>` is a folder under `profiles/`; any other entry is a path, relative to the overlay that names it.
- Parents are applied first, in the order listed, then the overlay itself. Files with the same name: the later one wins. Deny rules and hooks from every level are united. `CLAUDE.md` is the one from the last level that has one. The retire list and extra sources are merged.
- Loops and nesting deeper than 5 levels are errors.

That is how the author keeps skills in a public profile and only the private details (a different `CLAUDE.md`, extra deny rules, private project notes) in a private overlay.

You can also run the installer twice with different `--overlay` values: the second run adds its files and rules to the first, and `CLAUDE.md` is replaced by the last overlay that has one.

## Fork instead?

If you want to change the defaults for everyone who uses your copy (different sources, different deny rules), edit `sources.lock.json` and `config/` in a fork. Keep your personal content in an overlay anyway, so you can pull updates from here without conflicts.
