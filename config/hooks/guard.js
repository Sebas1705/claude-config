#!/usr/bin/env node
/**
 * PreToolUse guard for Claude Code's Bash tool. Reads the hook JSON on stdin and exits 2 with a reason on stderr when the
 * command breaks a rule; exit 0 lets it run. Local only: no network, nothing written.
 *
 * It is a guardrail against accidents, not a security boundary: it parses the command (quotes, env prefixes, wrappers such as
 * `sudo`, `bash -c "..."`, git's `-c`/`-C` options, push refspecs) but cannot follow variables, scripts or obfuscation.
 *
 * Rules (all on by default except the commit-trailer one):
 *  - blockNoVerify          git commit --no-verify / -n, and `git -c core.hooksPath=...` which disables the hooks the same way
 *  - blockForcePush         force or delete pushes to a protected branch, --mirror, and a bare force push that names no branch
 *  - blockSecretStaging     git add of keystores, .env files or key material
 *  - blockSecretReads       cat/head/cp/grep... of .env files, ~/.ssh, ~/.aws, keystores (the Read-tool deny rules do not cover Bash)
 *  - blockRmRoot            recursive rm of /, ~, $HOME, a drive root or a top-level system folder
 *  - blockCommitTrailers    Co-Authored-By / "Generated with" trailers (OFF by default: it is a taste, not safety)
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
  blockSecretReads: true,
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

// ---------- parsing ----------

/** Splits a command line into simple commands at && || ; | & and newlines, never inside quotes. */
function splitCommands(cmd) {
  const out = []
  let cur = ''
  let quote = null
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i]
    if (quote) { cur += c; if (c === quote && cmd[i - 1] !== '\\') quote = null; continue }
    if (c === '"' || c === "'") { quote = c; cur += c; continue }
    if (c === '\n' || c === ';') { out.push(cur); cur = ''; continue }
    if ((c === '&' && cmd[i + 1] === '&') || (c === '|' && cmd[i + 1] === '|')) { out.push(cur); cur = ''; i++; continue }
    if (c === '|' || c === '&') { out.push(cur); cur = ''; continue }
    cur += c
  }
  out.push(cur)
  return out.map(s => s.trim()).filter(Boolean)
}

/** Shell-like words: quotes removed, backslash escapes honoured. */
function tokenize(s) {
  const tokens = []
  let cur = ''
  let quote = null
  let has = false
  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (quote) {
      if (c === quote) quote = null
      else if (c === '\\' && quote === '"' && i + 1 < s.length) cur += s[++i]
      else cur += c
      continue
    }
    if (c === '"' || c === "'") { quote = c; has = true; continue }
    if (c === '\\' && i + 1 < s.length) { cur += s[++i]; has = true; continue }
    if (/\s/.test(c)) { if (has || cur) { tokens.push(cur); cur = ''; has = false } continue }
    cur += c
    has = true
  }
  if (has || cur) tokens.push(cur)
  return tokens
}

const WRAPPERS = new Set(['sudo', 'doas', 'env', 'command', 'exec', 'time', 'nohup', 'nice', 'builtin'])
const SHELLS = new Set(['sh', 'bash', 'zsh', 'dash', 'ksh', 'fish'])
const POWERSHELLS = new Set(['powershell', 'pwsh'])

/** Drops leading VAR=value assignments and wrappers (and their flags) to reach the real program. */
function stripPrefix(tokens) {
  const t = [...tokens]
  for (;;) {
    if (t.length && /^[A-Za-z_][A-Za-z0-9_]*=/.test(t[0])) { t.shift(); continue }
    if (t.length && WRAPPERS.has(path.basename(t[0]))) {
      t.shift()
      while (t.length && (t[0].startsWith('-') || /^[A-Za-z_][A-Za-z0-9_]*=/.test(t[0]))) t.shift()
      continue
    }
    return t
  }
}

const programOf = token => path.basename(token).replace(/\.(exe|cmd|bat)$/i, '')

// ---------- git ----------

const COMMIT_VALUE_FLAGS = new Set(['-m', '--message', '-F', '--file', '-C', '-c', '--reuse-message', '--reedit-message', '--author', '--date', '-t', '--template', '--cleanup', '--fixup', '--squash'])
const PUSH_VALUE_FLAGS = new Set(['-o', '--push-option', '--repo', '--receive-pack', '--exec'])

/** Finds the git subcommand past its global options, noting a `-c core.hooksPath=...` override. */
function gitParts(tokens) {
  let i = 1
  let overridesHooks = false
  while (i < tokens.length && tokens[i].startsWith('-')) {
    const t = tokens[i]
    if (t === '-c') { if (/^core\.hookspath=/i.test(tokens[i + 1] || '')) overridesHooks = true; i += 2; continue }
    if (/^-c.+/.test(t)) { if (/^-ccore\.hookspath=/i.test(t)) overridesHooks = true; i++; continue }
    if (t === '-C' || t === '--git-dir' || t === '--work-tree' || t === '--namespace' || t === '--exec-path' || t === '--config-env') { i += 2; continue }
    i++
  }
  return { sub: tokens[i], args: tokens.slice(i + 1), overridesHooks }
}

const isShortCluster = t => /^-[A-Za-z]+$/.test(t)

function checkCommit(args, overridesHooks, cmd, cfg) {
  let noVerify = false
  let fromFile = false
  for (let i = 0; i < args.length; i++) {
    const t = args[i]
    if (t === '--no-verify') noVerify = true
    else if (isShortCluster(t) && t.includes('n')) noVerify = true
    if (t === '-F' || t === '--file' || /^--file=/.test(t) || (isShortCluster(t) && t.endsWith('F'))) fromFile = true
    // The word after a flag that takes a value is that value (a message may be "-n"), not a flag.
    if (COMMIT_VALUE_FLAGS.has(t) || (isShortCluster(t) && 'mFCct'.includes(t[t.length - 1]))) i++
  }
  if (cfg.blockNoVerify && (noVerify || overridesHooks)) return 'git commit --no-verify (or -c core.hooksPath) skips the hooks; fix the failing hook instead.'
  if (cfg.blockCommitTrailers) {
    if (/co-authored-by:|generated with \[?claude|🤖 generated/i.test(cmd)) return 'commits must not carry a Co-Authored-By or "Generated with" trailer.'
    if (fromFile) return 'a commit message read from a file cannot be checked for trailers; use -m.'
  }
  return null
}

const refDestination = ref => {
  const bare = ref.replace(/^\+/, '')
  const k = bare.lastIndexOf(':')

  return (k >= 0 ? bare.slice(k + 1) : bare).replace(/^refs\/heads\//, '')
}

function checkPush(args, overridesHooks, cfg) {
  if (!cfg.blockForcePush) return null
  const flags = []
  const positional = []
  for (let i = 0; i < args.length; i++) {
    const t = args[i]
    if (t.startsWith('-')) { flags.push(t); if (PUSH_VALUE_FLAGS.has(t)) i++ } else positional.push(t)
  }
  const isForce = flags.some(f => f === '--force' || (isShortCluster(f) && f.includes('f')))
  const isLease = flags.some(f => f.startsWith('--force-with-lease') || f === '--force-if-includes')
  const isDelete = flags.some(f => f === '--delete' || f === '-d')
  const protectedBranches = new Set(cfg.protectedBranches || [])
  if (flags.includes('--mirror')) return '`git push --mirror` overwrites every remote ref.'
  for (const ref of positional) {
    const dest = refDestination(ref)
    if (!protectedBranches.has(dest)) continue
    if (isForce || isLease || ref.startsWith('+')) return `force-pushing to a protected branch (${[...protectedBranches].join(', ')}) is not allowed.`
    if (ref.startsWith(':') || isDelete) return `deleting a protected branch (${[...protectedBranches].join(', ')}) is not allowed.`
  }
  // `git push -f` with no refspec pushes whatever branch is current: it cannot be checked, so name the branch.
  if (isForce && !isLease && positional.length <= 1) return 'a force push must name the branch (git push --force origin <branch>) so the guard can check it.'
  if (isForce && flags.includes('--all')) return 'force-pushing --all includes the protected branches.'

  return null
}

// ---------- paths ----------

const SECRET_EXAMPLE = /\.(example|sample|template|dist|tpl)$/i
const SECRET_STAGE = /(\.jks|\.keystore|\.p12|\.pfx|\.pem|(^|[\\/])id_(rsa|dsa|ecdsa|ed25519)(\.pub)?|(^|[\\/])\.env(\.[^\\/]+)?|service-account[^\\/]*\.json)$/i
const SECRET_READ = new RegExp(
  '(^|[\\\\/])\\.env(\\.[^\\\\/]+)?$|[\\\\/]\\.ssh([\\\\/]|$)|^~?[\\\\/]?\\.ssh([\\\\/]|$)|[\\\\/]\\.aws([\\\\/]|$)|[\\\\/]\\.doppler([\\\\/]|$)|[\\\\/]\\.config[\\\\/]gh([\\\\/]|$)|\\.(jks|keystore|p12|pfx|pem)$|(^|[\\\\/])id_(rsa|dsa|ecdsa|ed25519)$|service-account[^\\\\/]*\\.json$',
  'i',
)
const READERS = new Set(['cat', 'less', 'more', 'head', 'tail', 'type', 'bat', 'nl', 'xxd', 'od', 'strings', 'base64', 'get-content', 'gc', 'cp', 'scp', 'rsync', 'tar', 'zip', 'grep', 'rg', 'awk', 'sed', 'curl', 'wget'])

const isSecretStage = t => SECRET_STAGE.test(t) && !SECRET_EXAMPLE.test(t)
const isSecretRead = t => SECRET_READ.test(t.replace(/^@/, '')) && !SECRET_EXAMPLE.test(t)

const ROOTISH = new Set(['/', '/*', '~', '~/', '~/*', '$HOME', '${HOME}', '$HOME/', '$HOME/*', '${HOME}/', '${HOME}/*', '/home', '/Users', '/etc', '/usr', '/var', '/bin', '/boot', '/root', '/opt', '/lib', '/sbin'])
const isRootish = t => ROOTISH.has(t.replace(/\/+$/, '') || '/') || ROOTISH.has(t) || /^[A-Za-z]:[\\/]*\*?$/.test(t)

// ---------- the check ----------

/** Returns the reason a command must not run, or null. `depth` bounds the `bash -c "..."` recursion. */
function check(cmd, cfg = DEFAULTS, depth = 0) {
  if (depth > 3) return null
  for (const part of splitCommands(cmd)) {
    const tokens = stripPrefix(tokenize(part))
    if (!tokens.length) continue
    const prog = programOf(tokens[0])
    const lower = prog.toLowerCase()

    // A shell given a command string: judge that string too.
    if (SHELLS.has(prog) || POWERSHELLS.has(lower) || lower === 'cmd') {
      const at = tokens.findIndex(t => /^-[A-Za-z]*c[A-Za-z]*$/.test(t) || /^-command$/i.test(t) || /^\/c$/i.test(t))
      if (at >= 0 && tokens[at + 1]) { const inner = check(tokens.slice(at + 1).join(' '), cfg, depth + 1); if (inner) return inner }
      continue
    }
    if (prog === 'eval') { const inner = check(tokens.slice(1).join(' '), cfg, depth + 1); if (inner) return inner; continue }

    if (prog === 'git') {
      const { sub, args, overridesHooks } = gitParts(tokens)
      if (sub === 'commit') { const r = checkCommit(args, overridesHooks, cmd, cfg); if (r) return r }
      else if (sub === 'push') {
        if (cfg.blockNoVerify && overridesHooks) return 'git -c core.hooksPath=... disables the hooks; fix the failing hook instead.'
        const r = checkPush(args, overridesHooks, cfg)
        if (r) return r
      } else if (sub === 'add' && cfg.blockSecretStaging && args.some(isSecretStage)) return 'refusing to stage keystores, .env files or key material.'
      continue
    }

    if (cfg.blockRmRoot && (prog === 'rm' || lower === 'remove-item' || lower === 'ri' || lower === 'rd' || lower === 'rmdir' || lower === 'del')) {
      const flags = tokens.slice(1).filter(t => t.startsWith('-'))
      const isRecursive = flags.some(f => /^--recursive$/i.test(f) || /^-recurse$/i.test(f) || (isShortCluster(f) && /[rR]/.test(f)))
      if (isRecursive && tokens.slice(1).filter(t => !t.startsWith('-')).some(isRootish)) return 'recursive delete of a root, home or system directory.'
    }

    if (cfg.blockSecretReads && (READERS.has(lower) || READERS.has(prog)) && tokens.slice(1).some(isSecretRead)) return 'reading secrets (.env, ~/.ssh, ~/.aws, keystores, key files) through the shell is blocked.'
  }

  return null
}

module.exports = { check, loadConfig, DEFAULTS, splitCommands, tokenize }
