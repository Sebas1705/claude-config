# Reference

## `sources.lock.json`

```json
{
  "version": 1,
  "sources": {
    "<id>": {
      "repo": "https://github.com/owner/name",
      "commit": "<40-character SHA>",
      "license": "MIT",
      "reviewed": "2026-11-09",
      "skills":  { "from": "skills", "names": "*" },
      "support": [{ "from": "hooks", "to": "superpowers/hooks" }],
      "plugins": { "from": "plugins", "names": ["a", "b"], "skillsOnly": false }
    }
  },
  "agentToolRestrictions": { "tools": "Read, Grep, Glob, Bash", "agents": ["code-reviewer"] }
}
```

| Field | Meaning |
|---|---|
| `repo`, `commit` | Where to fetch and the exact commit. The installer runs `git init`, `git fetch --depth 1 origin <commit>`, `git checkout FETCH_HEAD`, then verifies `HEAD` equals `commit` and aborts otherwise. Fetched sources are cached under the OS temp folder (`claude-config-cache`) |
| `license`, `reviewed` | Documentation for humans. `reviewed` is the date someone read that commit |
| `skills.from` / `skills.names` | Folder (relative to the repo root) holding skill folders. `"*"` means every folder that contains a `SKILL.md`; otherwise a list of names. Copied to `<home>/skills/<name>` |
| `support` | Extra folders copied verbatim to `<home>/<to>`. Used for files a hook needs (superpowers' hook reads its own `using-superpowers` skill) |
| `plugins` | A plugin-style layout: `<from>/<name>/{agents,commands,skills}`. Agents and commands (`*.md`) go to `<home>/agents` and `<home>/commands`, skills to `<home>/skills`. With `skillsOnly: true` only the skills are copied (for plugins whose commands need the plugin runtime) |
| `agentToolRestrictions` | After install, each listed agent that exists and has no `tools:` line gets one, so it cannot edit files |

Name clashes: if two plugins in one run ship a file with the same name and different content, the later one is installed as `<plugin>-<file>`. If a file with that name already exists and is not ours, it is left alone (`kept`).

A plugin that needs its own runtime (a workflow script, an MCP server) cannot be installed by copying files; list only plugins that are plain markdown, or use `skillsOnly`.

## Plan actions

`--dry-run` prints one line per file:

| Action | Meaning |
|---|---|
| `add` | The destination does not exist; it will be created |
| `update` | The destination exists and was installed by this tool earlier; it will be replaced |
| `kept` | The destination exists and is not ours; left untouched |
| `same` | Identical duplicate of a file already planned in this run; skipped |

## What gets merged into `settings.json`

Only these, and only if missing:

- `hooks.<Event>[]` entries from `config/settings.fragment.json` (and the overlay's). An entry is considered present if any of its hook commands already appears in that event.
- `permissions.deny[]` rules.

Everything the installer adds is recorded in the manifest and removed again by `--uninstall`. Other keys and other tools' hooks are not read or modified.

## `CLAUDE.md`

The rules are written between `<!-- claude-config:begin -->` and `<!-- claude-config:end -->`. If the file does not exist it is created; if it exists without the block, the block is appended; if the block exists it is replaced in place. `--uninstall` removes the block and deletes the file only if nothing else is left.

## The manifest

`<home>/.claude-config/manifest.json`:

```json
{
  "version": 1,
  "installedAt": "2026-11-09T18:14:47.963Z",
  "backupDir": "<home>/backups/claude-config-...",
  "sources": { "superpowers": "22f0b46..." },
  "installed": [{ "dest": "<home>/skills/brainstorming", "label": "superpowers", "kind": "skill" }],
  "moved": [{ "from": "<home>/skills/old", "to": "<home>/skills-removed/old" }],
  "settings": { "hooks": [{ "event": "PreToolUse", "command": "node \".../guard.js\"" }], "deny": ["Read(~/.ssh/**)"] }
}
```

`--status` exits with code 1 if any `installed` path is missing. `--uninstall` only deletes paths inside the Claude folder.

## Exit codes

| Code | Meaning |
|---|---|
| `0` | Success (`--status`: everything present) |
| `1` | An error (unknown option, fetch failed, overlay not found...) or, for `--status`, something missing |

## Guard hook protocol

Claude Code runs the hook with a JSON document on stdin (`{"tool_input": {"command": "..."}}`). The hook exits `0` to allow, or `2` with a reason on stderr to block. Input that is not valid JSON or has no command is allowed. The config file is read from the folder where the hook file lives.
