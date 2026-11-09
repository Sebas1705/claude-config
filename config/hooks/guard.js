#!/usr/bin/env node
/**
 * PreToolUse guard for Claude Code's Bash tool. Reads the hook JSON on stdin and exits 2 with a reason on stderr when the
 * command breaks a rule; exit 0 lets it run. Local only: no network, nothing written.
 *
 * Rules (all on by default except the commit-trailer one):
 *  - blockNoVerify          git commit --no-verify / -n                          (hooks must run)
 *  - blockForcePush         git push --force / -f to a protected branch          (--force-with-lease is allowed)
 *  - blockSecretStaging     git add of keystores, .env files or key material
 *  - blockRmRoot            rm -rf on /, ~ or a drive root
 *  - blockCommitTrailers    git commit with a Co-Authored-By / "Generated with" trailer   (OFF by default: it is a taste, not safety)
 *
 * To change a rule, put a guard.config.json next to this file, for example:
 *   { "blockCommitTrailers": true, "protectedBranches": ["main", "master", "release"] }
 */
'use strict'

const fs = require('fs')
const path = require('path')

const DEFAULTS = {
  blockNoVerify: true,
  blockForcePush: true,
  blockSecretStaging: true,
  blockRmRoot: true,
  blockCommitTrailers: false,
  protectedBranches: ['main', 'master'],
}

/** Defaults overridden by guard.config.json next to this file (a missing or broken file means defaults). */
function loadConfig(dir = __dirname) {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(path.join(dir, 'guard.config.json'), 'utf8')) } } catch { return { ...DEFAULTS } }
}

// Only read stdin when run as the hook; requiring this file (tests) must not touch stdin
if (require.main === module) {
  let raw = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', c => { raw += c })
  process.stdin.on('end', () => {
    let cmd = ''
    try { cmd = String((JSON.parse(raw).tool_input || {}).command || '') } catch { process.exit(0) }
    const reason = check(cmd, loadConfig())
    if (reason) { process.stderr.write(`Blocked by the Claude Code guard hook: ${reason}\n`); process.exit(2) }
    process.exit(0)
  })
}

function check(cmd, cfg = DEFAULTS) {
  const protectedRe = new RegExp(`\\b(${(cfg.protectedBranches || []).map(b => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') || '(?!)'})\\b`)
  // Look at each simple command of a chain (&&, ||, ;, |, newline) on its own
  for (const part of cmd.split(/&&|\|\||;|\n|\|/)) {
    const c = part.trim()
    if (/^git\s+(?:-C\s+\S+\s+)?commit\b/.test(c)) {
      // Flags are judged with quoted text removed, so a message that mentions -n or --no-verify does not trip it
      const flags = c.replace(/"[^"]*"|'[^']*'/g, '""')
      if (cfg.blockNoVerify && /\s--no-verify\b|\s-[a-zA-Z]*n[a-zA-Z]*(?=\s|$)/.test(flags)) return 'git commit --no-verify skips the hooks; fix the failing hook instead.'
      if (cfg.blockCommitTrailers && /co-authored-by:|generated with \[?claude|🤖 generated/i.test(cmd)) return 'commits must not carry a Co-Authored-By or "Generated with" trailer.'
    }
    if (cfg.blockForcePush && /^git\s+(?:-C\s+\S+\s+)?push\b/.test(c) && /(\s--force\b|\s-f\b)(?!-with-lease)/.test(c) && protectedRe.test(c)) return `force-pushing to a protected branch (${(cfg.protectedBranches || []).join(', ')}) is not allowed.`
    if (cfg.blockSecretStaging && /^git\s+(?:-C\s+\S+\s+)?add\b/.test(c) && /(\.jks|\.keystore|\.p12|\.pfx|\.pem|id_rsa|(^|[\s/])\.env(\.(local|production|prod|development))?(\s|$)|service-account.*\.json)/i.test(c)) return 'refusing to stage keystores, .env files or key material.'
    if (cfg.blockRmRoot && /^rm\s+(-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r)[a-zA-Z]*\s+(\/|~|\$HOME|[A-Za-z]:[\\/]?)(\s|$)/.test(c)) return 'rm -rf on a root or home directory.'
  }
  return null
}

module.exports = { check, loadConfig, DEFAULTS }
