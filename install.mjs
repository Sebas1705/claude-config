#!/usr/bin/env node
/**
 * Installs a Claude Code configuration (guard hook, deny rules, pinned third-party skills, optional private overlay)
 * into ~/.claude (or $CLAUDE_CONFIG_DIR) on any machine.
 *
 *   node install.mjs                 install or update
 *   node install.mjs --dry-run       print the plan, change nothing in the Claude folder
 *   node install.mjs --status        check that what was installed is still there
 *   node install.mjs --uninstall     remove exactly what the installer added
 *
 * Options: --home <dir>  --lock <file>  --only <source,source>  --overlay <dir>  --profile <name>  --no-overlay  --no-hook
 *          --no-claude-md  --retire  --json
 * An overlay is also picked up from $CLAUDE_CONFIG_OVERLAY when none of --overlay/--profile/--no-overlay is given.
 *
 * Third-party sources are fetched at the commits pinned in sources.lock.json. Nothing fetched is ever executed by this
 * script: it only copies files. Node 18+ and git are the only requirements.
 */
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.dirname(fileURLToPath(import.meta.url))
const BEGIN = '<!-- claude-config:begin -->'
const END = '<!-- claude-config:end -->'

const posix = p => p.replace(/\\/g, '/')
const readJson = f => JSON.parse(fs.readFileSync(f, 'utf8'))
const writeJson = (f, o) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(o, null, 2) + '\n') }
const sameFile = (a, b) => fs.statSync(a).isFile() && fs.statSync(b).isFile() && fs.readFileSync(a).equals(fs.readFileSync(b))
const within = (parent, child) => { const r = path.relative(parent, child); return !!r && !r.startsWith('..') && !path.isAbsolute(r) }

export function parseArgs(argv) {
  const o = { dryRun: false, uninstall: false, status: false, noHook: false, retire: false, json: false, noClaudeMd: false, noOverlay: false, only: null, home: null, lock: null, overlay: null, profile: null }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--dry-run') o.dryRun = true
    else if (a === '--uninstall') o.uninstall = true
    else if (a === '--status') o.status = true
    else if (a === '--no-hook') o.noHook = true
    else if (a === '--no-claude-md') o.noClaudeMd = true
    else if (a === '--overlay') o.overlay = argv[++i]
    else if (a === '--profile') o.profile = argv[++i]
    else if (a === '--no-overlay') o.noOverlay = true
    else if (a === '--retire') o.retire = true
    else if (a === '--json') o.json = true
    else if (a === '--only') o.only = String(argv[++i] || '').split(',').filter(Boolean)
    else if (a === '--home') o.home = argv[++i]
    else if (a === '--lock') o.lock = argv[++i]
    else if (a === '-h' || a === '--help') o.help = true
    else throw new Error(`Unknown option: ${a}`)
  }
  return o
}

/**
 * Which overlay folder applies: --no-overlay wins, then --overlay <dir>, then --profile <name> (a folder under profiles/),
 * then , so a machine can have its own overlay as the default without any flag.
 */
export function resolveOverlay(opts, env = process.env) {
  if (opts.overlay && opts.profile) throw new Error('Use either --overlay or --profile, not both')
  if (opts.noOverlay) return null
  if (opts.overlay) return path.resolve(opts.overlay)
  if (opts.profile) {
    const dir = path.join(ROOT, 'profiles', opts.profile)
    if (!/^[A-Za-z0-9._-]+$/.test(opts.profile) || !fs.existsSync(dir)) {
      const have = fs.existsSync(path.join(ROOT, 'profiles')) ? listDirs(path.join(ROOT, 'profiles')) : []
      throw new Error(`Unknown profile: ${opts.profile} (available: ${have.join(', ') || 'none'})`)
    }
    return dir
  }
  if (env.CLAUDE_CONFIG_OVERLAY) return path.resolve(env.CLAUDE_CONFIG_OVERLAY)
  return null
}

/**
 * Expands an overlay into the folders to apply, parents first. An overlay.json may say "extends": ["profile:<name>", "../other"];
 * a profile is a folder under profiles/, a path is relative to the overlay that names it. Later folders win over earlier ones.
 */
export function overlayChain(dir, seen = [], depth = 0) {
  if (!fs.existsSync(dir)) throw new Error(`Overlay folder not found: ${dir}`)
  if (depth > 5) throw new Error(`Overlay "extends" is nested too deeply at ${dir}`)
  if (seen.includes(dir)) throw new Error(`Overlay "extends" loops back to ${dir}`)
  const meta = fs.existsSync(path.join(dir, 'overlay.json')) ? readJson(path.join(dir, 'overlay.json')) : {}
  const parents = []
  for (const ref of meta.extends || []) {
    const target = ref.startsWith('profile:') ? resolveOverlay({ profile: ref.slice(8) }, {}) : path.resolve(dir, ref)
    parents.push(...overlayChain(target, [...seen, dir], depth + 1))
  }
  return [...parents.filter(p => p.dir !== dir), { dir, meta }]
}

export function resolveHome(opts) {
  return path.resolve(opts.home || process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), '.claude'))
}

// ---------- sources ----------
function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
  if (r.error) throw new Error(`git is required: ${r.error.message}`)
  return r
}

/** Fetches exactly `commit` of `repo` into a cache folder and returns its path. Verifies the commit afterwards. */
export function fetchSource(id, src, cacheRoot, log = () => {}) {
  const dir = path.join(cacheRoot, `${id}-${src.commit.slice(0, 12)}`)
  if (fs.existsSync(path.join(dir, '.git'))) {
    const head = git(['rev-parse', 'HEAD'], dir)
    if (head.status === 0 && head.stdout.trim() === src.commit) return dir
    fs.rmSync(dir, { recursive: true, force: true })
  }
  fs.mkdirSync(dir, { recursive: true })
  log(`  fetching ${id} @ ${src.commit.slice(0, 12)}`)
  for (const args of [['init', '-q'], ['remote', 'add', 'origin', src.repo], ['fetch', '-q', '--depth', '1', 'origin', src.commit], ['checkout', '-q', 'FETCH_HEAD']]) {
    const r = git(args, dir)
    if (r.status !== 0) { fs.rmSync(dir, { recursive: true, force: true }); throw new Error(`git ${args[0]} failed for ${id}: ${(r.stderr || '').trim()}`) }
  }
  const head = git(['rev-parse', 'HEAD'], dir).stdout.trim()
  if (head !== src.commit) { fs.rmSync(dir, { recursive: true, force: true }); throw new Error(`${id}: fetched ${head}, expected ${src.commit}`) }
  return dir
}

// ---------- planning ----------
const listDirs = d => fs.readdirSync(d, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name)

/** Builds the list of copy operations for one fetched source. */
export function planSource(id, s, root, home, ownedBefore) {
  const ops = []
  const add = (kind, src, dest, label) => ops.push({ kind, src, dest, label })
  if (s.skills) {
    const base = path.join(root, s.skills.from)
    const names = s.skills.names === '*' ? listDirs(base).filter(n => fs.existsSync(path.join(base, n, 'SKILL.md'))) : s.skills.names
    for (const n of names) add('skill', path.join(base, n), path.join(home, 'skills', n), id)
  }
  for (const sup of s.support || []) add('support', path.join(root, sup.from), path.join(home, sup.to), id)
  if (s.plugins) {
    for (const name of s.plugins.names) {
      const p = path.join(root, s.plugins.from, name)
      if (!fs.existsSync(p)) throw new Error(`${id}: plugin ${name} not found at the pinned commit`)
      if (!s.plugins.skillsOnly) {
        for (const kind of ['agents', 'commands']) {
          const d = path.join(p, kind)
          if (!fs.existsSync(d)) continue
          for (const f of fs.readdirSync(d).filter(x => x.endsWith('.md'))) add(kind === 'agents' ? 'agent' : 'command', path.join(d, f), path.join(home, kind, f), `${id}/${name}`)
        }
      }
      const sk = path.join(p, 'skills')
      if (fs.existsSync(sk)) for (const n of listDirs(sk)) add('skill', path.join(sk, n), path.join(home, 'skills', n), `${id}/${name}`)
    }
  }
  return ops
}

/**
 * Decides what happens to each op, looking at the disk AND at the ops already planned in this run, so two plugins that ship
 * an agent with the same file name cannot overwrite each other: the later one gets its plugin name as a prefix.
 */
export function decide(ops, ownedBefore) {
  const claimed = new Map() // dest -> src of the op that will write it in this run
  const free = d => !claimed.has(d) && (!fs.existsSync(d) || ownedBefore.has(d))
  for (const op of ops) {
    if (op.action) { claimed.set(op.dest, op.src); continue } // own files were decided by planOwn
    if (claimed.has(op.dest)) {
      if (sameFile(op.src, claimed.get(op.dest))) { op.action = 'same'; continue } // identical copy from another plugin
      if (op.kind === 'agent' || op.kind === 'command') {
        const alt = path.join(path.dirname(op.dest), `${op.label.split('/')[1] || op.label}-${path.basename(op.dest)}`)
        if (free(alt)) op.dest = alt
        else { op.action = 'kept'; continue }
      } else { op.action = 'kept'; continue }
    }
    if (!fs.existsSync(op.dest)) op.action = 'add'
    else if (ownedBefore.has(op.dest)) op.action = 'update'
    else if ((op.kind === 'agent' || op.kind === 'command') && !sameFile(op.src, op.dest)) {
      const alt = path.join(path.dirname(op.dest), `${op.label.split('/')[1] || op.label}-${path.basename(op.dest)}`)
      if (free(alt)) { op.dest = alt; op.action = fs.existsSync(alt) ? 'update' : 'add' } else op.action = 'kept'
    } else op.action = 'kept' // exists and is not ours: never overwrite
    if (op.action !== 'kept') claimed.set(op.dest, op.src)
  }
  return ops
}

/**
 * Files that come from a config folder (this repo's `config/`, or an overlay): skills/, agents/, commands/ and hooks/.
 * Later folders win over earlier ones, so an overlay can replace a default file. Own files are always refreshed.
 */
export function planOwn(folders, home) {
  const byDest = new Map()
  for (const { dir, label } of folders) {
    const add = (kind, src, dest) => byDest.set(dest, { kind, src, dest, label })
    const skills = path.join(dir, 'skills')
    if (fs.existsSync(skills)) for (const n of listDirs(skills)) add('skill', path.join(skills, n), path.join(home, 'skills', n))
    for (const [folder, kind] of [['agents', 'agent'], ['commands', 'command']]) {
      const d = path.join(dir, folder)
      if (fs.existsSync(d)) for (const f of fs.readdirSync(d).filter(x => x.endsWith('.md'))) add(kind, path.join(d, f), path.join(home, folder, f))
    }
    const hooks = path.join(dir, 'hooks')
    if (fs.existsSync(hooks)) for (const f of fs.readdirSync(hooks).filter(x => x !== 'package.json' && fs.statSync(path.join(hooks, x)).isFile())) add('hook', path.join(hooks, f), path.join(home, 'hooks', f))
  }
  const ops = [...byDest.values()]
  for (const op of ops) op.action = !fs.existsSync(op.dest) ? 'add' : 'update'
  return ops
}

/** Merges an overlay's lock additions into the base lock: extra sources, extra retire list, extra restricted agents. */
export function mergeLock(base, extra) {
  if (!extra) return base
  const out = JSON.parse(JSON.stringify(base))
  out.sources = { ...out.sources, ...(extra.sources || {}) }
  if (extra.retire) out.retire = { ...(out.retire || {}), skills: [...new Set([...((out.retire || {}).skills || []), ...(extra.retire.skills || [])])] }
  if (extra.agentToolRestrictions) {
    const r = out.agentToolRestrictions || { tools: extra.agentToolRestrictions.tools, agents: [] }
    out.agentToolRestrictions = { tools: extra.agentToolRestrictions.tools || r.tools, agents: [...new Set([...r.agents, ...(extra.agentToolRestrictions.agents || [])])] }
  }
  return out
}

/** Merges two settings fragments: hook entries are appended, deny rules are united. */
export function mergeFragments(a, b) {
  if (!b) return a
  const out = JSON.parse(JSON.stringify(a))
  for (const [event, entries] of Object.entries(b.hooks || {})) out.hooks = { ...(out.hooks || {}), [event]: [...((out.hooks || {})[event] || []), ...entries] }
  const deny = [...new Set([...((a.permissions || {}).deny || []), ...((b.permissions || {}).deny || [])])]
  if (deny.length) out.permissions = { ...(out.permissions || {}), deny }
  return out
}

function applyOp(op) {
  if (op.action === 'kept' || op.action === 'same') return
  if (op.action === 'update') fs.rmSync(op.dest, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(op.dest), { recursive: true })
  fs.cpSync(op.src, op.dest, { recursive: true })
}

// ---------- CLAUDE.md, settings, agents ----------
export function mergeClaudeMd(existing, block) {
  const wrapped = `${BEGIN}\n${block.trim()}\n${END}\n`
  if (existing == null || existing.trim() === '') return wrapped
  const a = existing.indexOf(BEGIN), b = existing.indexOf(END)
  if (a !== -1 && b > a) return existing.slice(0, a) + wrapped + existing.slice(b + END.length).replace(/^\r?\n/, '')
  return existing.replace(/\s*$/, '\n\n') + wrapped
}
export function removeClaudeMdBlock(existing) {
  const a = existing.indexOf(BEGIN), b = existing.indexOf(END)
  if (a === -1 || b < a) return existing
  return (existing.slice(0, a).replace(/\s*$/, '\n') + existing.slice(b + END.length).replace(/^\r?\n/, '')).replace(/^\s*\n$/, '')
}

/** Adds the fragment's hooks and deny rules to a settings object without touching any other key. Returns what was added. */
export function mergeSettings(settings, fragment, home, { noHook, hasSuperpowers }) {
  const added = { hooks: [], deny: [] }
  const sub = s => s.replaceAll('{{HOME}}', posix(home))
  settings.hooks = settings.hooks || {}
  for (const [event, entries] of Object.entries(fragment.hooks || {})) {
    for (const raw of entries) {
      if (raw._requires === 'superpowers' && (noHook || !hasSuperpowers)) continue
      const entry = JSON.parse(sub(JSON.stringify(raw)))
      delete entry._requires
      const list = (settings.hooks[event] = settings.hooks[event] || [])
      const cmds = entry.hooks.map(h => h.command)
      if (list.some(e => (e.hooks || []).some(h => cmds.includes(h.command)))) continue
      list.push(entry)
      added.hooks.push({ event, command: cmds[0] })
    }
  }
  const deny = (fragment.permissions && fragment.permissions.deny) || []
  if (deny.length) {
    settings.permissions = settings.permissions || {}
    const cur = (settings.permissions.deny = settings.permissions.deny || [])
    for (const d of deny) if (!cur.includes(d)) { cur.push(d); added.deny.push(d) }
  }
  return added
}
export function removeFromSettings(settings, added) {
  for (const { event, command } of added.hooks || []) {
    const list = settings.hooks && settings.hooks[event]
    if (!list) continue
    settings.hooks[event] = list.filter(e => !(e.hooks || []).some(h => h.command === command))
    if (!settings.hooks[event].length) delete settings.hooks[event]
  }
  if (settings.hooks && !Object.keys(settings.hooks).length) delete settings.hooks
  if (settings.permissions && settings.permissions.deny) {
    settings.permissions.deny = settings.permissions.deny.filter(d => !(added.deny || []).includes(d))
    if (!settings.permissions.deny.length) delete settings.permissions.deny
    if (!Object.keys(settings.permissions).length) delete settings.permissions
  }
  return settings
}

/** Adds a `tools:` line to review-only agents so they cannot write files or use MCP tools. */
export function restrictAgent(text, tools) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!m || /^tools:/m.test(m[1])) return null
  const nl = text.includes('\r\n') ? '\r\n' : '\n'
  const line = `tools: ${tools}`
  const fm = /^model:.*$/m.test(m[1]) ? m[1].replace(/^(model:.*)$/m, `$1${nl}${line}`) : `${m[1]}${nl}${line}`
  return text.replace(m[1], fm)
}

// ---------- main ----------
export function run(opts, log = console.log) {
  const home = resolveHome(opts)
  const configDir = path.join(ROOT, 'config')
  const lockFile = path.resolve(opts.lock || path.join(ROOT, 'sources.lock.json'))
  const stateDir = path.join(home, '.claude-config')
  const manifestFile = path.join(stateDir, 'manifest.json')
  const prev = fs.existsSync(manifestFile) ? readJson(manifestFile) : null
  const result = { home, dryRun: opts.dryRun, ops: [], moved: [], settings: { hooks: [], deny: [] }, restricted: [], missing: [] }

  if (opts.status) return status(home, prev, log, result)
  if (opts.uninstall) return uninstall(home, prev, manifestFile, log, result, opts.dryRun)

  // An overlay is a private folder with the same layout as config/ (plus an optional overlay.json for extra sources)
  const overlayDir = resolveOverlay(opts)
  const chain = overlayDir ? overlayChain(overlayDir) : []
  const lock = chain.reduce((l, o) => mergeLock(l, o.meta), readJson(lockFile))
  const only = opts.only
  const ids = Object.keys(lock.sources).filter(id => !only || only.includes(id))
  if (only) for (const o of only) if (!lock.sources[o]) throw new Error(`Unknown source: ${o} (have: ${Object.keys(lock.sources).join(', ')})`)
  const ownedBefore = new Set((prev ? prev.installed : []).map(i => i.dest))

  log(`${opts.dryRun ? '[dry run] ' : ''}Claude folder: ${home}`)
  if (overlayDir) log(`Overlay: ${chain.map(o => o.dir).join(' <- ')}`)
  const cacheRoot = path.join(os.tmpdir(), 'claude-config-cache')
  const ops = []
  for (const id of ids) ops.push(...planSource(id, lock.sources[id], fetchSource(id, lock.sources[id], cacheRoot, log), home, ownedBefore))
  ops.push(...planOwn([{ dir: configDir, label: 'own' }, ...chain.map(o => ({ dir: o.dir, label: 'overlay' }))], home))
  decide(ops, ownedBefore)
  result.ops = ops

  const count = a => ops.filter(o => o.action === a).length
  for (const op of ops) log(`  ${op.action.padEnd(6)} ${op.kind.padEnd(8)} ${path.relative(home, op.dest)}  (${op.label})`)
  log(`Plan: ${count('add')} to add, ${count('update')} to update, ${count('kept')} kept (already there, not ours), ${count('same')} identical duplicates skipped.`)

  const hasSuperpowers = ids.includes('superpowers')
  const fragmentOf = d => (fs.existsSync(path.join(d, 'settings.fragment.json')) ? readJson(path.join(d, 'settings.fragment.json')) : null)
  const fragment = chain.reduce((f, o) => mergeFragments(f, fragmentOf(o.dir)), fragmentOf(configDir) || {})
  const settingsFile = path.join(home, 'settings.json')
  const settings = fs.existsSync(settingsFile) ? readJson(settingsFile) : {}
  const probe = mergeSettings(JSON.parse(JSON.stringify(settings)), fragment, home, { noHook: opts.noHook, hasSuperpowers })
  result.settings = probe
  log(`Settings: ${probe.hooks.length} hook(s) and ${probe.deny.length} deny rule(s) to add.`)
  if (opts.dryRun) return result

  // backup, then apply
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupDir = path.join(home, 'backups', `claude-config-${stamp}`)
  for (const f of ['settings.json', 'CLAUDE.md']) if (fs.existsSync(path.join(home, f))) { fs.mkdirSync(backupDir, { recursive: true }); fs.copyFileSync(path.join(home, f), path.join(backupDir, f)) }
  for (const op of ops) applyOp(op)

  const claudeMd = path.join(home, 'CLAUDE.md')
  // The overlay's CLAUDE.md replaces the default one
  const mdSource = [...chain.map(o => path.join(o.dir, 'CLAUDE.md')).reverse(), path.join(configDir, 'CLAUDE.md')].find(f => fs.existsSync(f))
  if (!opts.noClaudeMd && mdSource) fs.writeFileSync(claudeMd, mergeClaudeMd(fs.existsSync(claudeMd) ? fs.readFileSync(claudeMd, 'utf8') : null, fs.readFileSync(mdSource, 'utf8')))

  const added = mergeSettings(settings, fragment, home, { noHook: opts.noHook, hasSuperpowers })
  if (added.hooks.length || added.deny.length) writeJson(settingsFile, settings)

  const restr = lock.agentToolRestrictions
  if (restr) for (const name of restr.agents) {
    const f = path.join(home, 'agents', `${name}.md`)
    if (!fs.existsSync(f)) continue
    const patched = restrictAgent(fs.readFileSync(f, 'utf8'), restr.tools)
    if (patched) { fs.writeFileSync(f, patched); result.restricted.push(name) }
  }

  const moved = prev ? [...prev.moved] : []
  if (opts.retire && lock.retire) for (const n of lock.retire.skills) {
    const from = path.join(home, 'skills', n), to = path.join(home, 'skills-removed', n)
    if (fs.existsSync(from) && !fs.existsSync(to)) { fs.mkdirSync(path.dirname(to), { recursive: true }); fs.renameSync(from, to); moved.push({ from, to }); result.moved.push(n) }
  }

  const prevAdded = prev ? prev.settings : { hooks: [], deny: [] }
  const keep = new Map((prev ? prev.installed : []).filter(i => !ops.some(o => o.dest === i.dest)).map(i => [i.dest, i]))
  for (const op of ops) if (op.action !== 'kept' && op.action !== 'same') keep.set(op.dest, { dest: op.dest, label: op.label, kind: op.kind })
  writeJson(manifestFile, {
    version: 1, installedAt: new Date().toISOString(), backupDir: fs.existsSync(backupDir) ? backupDir : null,
    sources: Object.fromEntries(ids.map(id => [id, lock.sources[id].commit])),
    installed: [...keep.values()], moved,
    settings: { hooks: [...prevAdded.hooks, ...added.hooks], deny: [...prevAdded.deny, ...added.deny] },
    claudeMd: true,
  })
  log(`Done. ${ops.filter(o => o.action !== 'kept').length} item(s) installed, ${result.restricted.length} agent(s) restricted${result.moved.length ? `, ${result.moved.length} skill(s) moved to skills-removed/` : ''}. Backup: ${fs.existsSync(backupDir) ? backupDir : 'nothing to back up'}. Start a new Claude Code session to load the skills.`)
  return result
}

/** Removes now-empty parent folders up to (never including) the Claude folder. */
function pruneEmpty(home, dir) {
  while (within(home, dir) && fs.existsSync(dir) && fs.readdirSync(dir).length === 0) { fs.rmdirSync(dir); dir = path.dirname(dir) }
}

function status(home, prev, log, result) {
  if (!prev) { log('Not installed by claude-config (no manifest).'); result.missing = ['manifest']; return result }
  result.missing = prev.installed.filter(i => !fs.existsSync(i.dest)).map(i => i.dest)
  log(`Installed ${prev.installedAt}: ${prev.installed.length} item(s); sources: ${Object.entries(prev.sources).map(([k, v]) => `${k}@${v.slice(0, 7)}`).join(', ')}`)
  if (result.missing.length) log(`Missing ${result.missing.length}:\n  ${result.missing.join('\n  ')}`); else log('Everything the manifest lists is present.')
  return result
}

function uninstall(home, prev, manifestFile, log, result, dryRun) {
  if (!prev) { log('Nothing to uninstall (no manifest).'); return result }
  log(`${dryRun ? '[dry run] ' : ''}Uninstalling from ${home}`)
  let removed = 0
  for (const i of prev.installed) {
    if (!within(home, i.dest)) continue
    if (fs.existsSync(i.dest)) {
      removed++; log(`  remove ${path.relative(home, i.dest)}`)
      if (!dryRun) { fs.rmSync(i.dest, { recursive: true, force: true }); pruneEmpty(home, path.dirname(i.dest)) }
    }
  }
  for (const m of prev.moved) if (fs.existsSync(m.to) && !fs.existsSync(m.from)) {
    log(`  restore ${path.relative(home, m.from)}`)
    if (!dryRun) { fs.mkdirSync(path.dirname(m.from), { recursive: true }); fs.renameSync(m.to, m.from); pruneEmpty(home, path.dirname(m.to)) }
  }
  const settingsFile = path.join(home, 'settings.json')
  if (!dryRun && fs.existsSync(settingsFile)) writeJson(settingsFile, removeFromSettings(readJson(settingsFile), prev.settings))
  const claudeMd = path.join(home, 'CLAUDE.md')
  if (!dryRun && fs.existsSync(claudeMd)) {
    const rest = removeClaudeMdBlock(fs.readFileSync(claudeMd, 'utf8'))
    if (rest.trim() === '') fs.rmSync(claudeMd); else fs.writeFileSync(claudeMd, rest)
  }
  if (!dryRun) fs.rmSync(manifestFile, { force: true })
  log(`Done. ${removed} item(s) removed; settings.json and CLAUDE.md cleaned of what we added.`)
  return result
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const opts = parseArgs(process.argv.slice(2))
    if (opts.help) { console.log(fs.readFileSync(fileURLToPath(import.meta.url), 'utf8').split('*/')[0]); process.exit(0) }
    const res = run(opts, opts.json ? () => {} : console.log)
    if (opts.json) console.log(JSON.stringify({ home: res.home, ops: res.ops.map(o => ({ action: o.action, kind: o.kind, dest: o.dest, label: o.label })), settings: res.settings, missing: res.missing }, null, 2))
    process.exit(opts.status && res.missing.length ? 1 : 0)
  } catch (e) { console.error(`claude-config: ${e.message}`); process.exit(1) }
}
