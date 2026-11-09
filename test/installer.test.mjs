import { test, before, after } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { run, mergeClaudeMd, removeClaudeMdBlock, mergeSettings, removeFromSettings, restrictAgent, parseArgs, mergeLock, mergeFragments, resolveOverlay } from '../install.mjs'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const quiet = () => {}
let tmp, sp, pl, lockFile

const sh = (cwd, ...args) => { const r = spawnSync('git', args, { cwd, encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim() }
const write = (f, t) => { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, t) }
const skill = (dir, name) => write(path.join(dir, name, 'SKILL.md'), `---\nname: ${name}\ndescription: test skill ${name}\n---\nbody\n`)
const snapshot = dir => { const out = {}; const walk = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); e.isDirectory() ? walk(p) : (out[path.relative(dir, p)] = fs.readFileSync(p, 'utf8')) } }; if (fs.existsSync(dir)) walk(dir); return out }
function repo(dir) { fs.mkdirSync(dir, { recursive: true }); sh(dir, 'init', '-q', '-b', 'main'); sh(dir, 'config', 'user.email', 't@t'); sh(dir, 'config', 'user.name', 't'); sh(dir, 'config', 'uploadpack.allowAnySHA1InWant', 'true') }
function commit(dir) { sh(dir, 'add', '-A'); sh(dir, 'commit', '-q', '-m', 'fixture'); return sh(dir, 'rev-parse', 'HEAD') }

before(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cc-test-'))
  sp = path.join(tmp, 'sp'); pl = path.join(tmp, 'pl')
  repo(sp)
  skill(path.join(sp, 'skills'), 'using-superpowers'); skill(path.join(sp, 'skills'), 'brainstorming')
  write(path.join(sp, 'hooks', 'run-hook.cmd'), ': noop\n'); write(path.join(sp, 'hooks', 'session-start'), '#!/usr/bin/env bash\n')
  const spSha = commit(sp)
  repo(pl)
  write(path.join(pl, 'plugins', 'p1', 'agents', 'code-reviewer.md'), '---\nname: code-reviewer\nmodel: opus\ndescription: reviews\n---\nP1\n')
  write(path.join(pl, 'plugins', 'p1', 'agents', 'helper.md'), '---\nname: helper\ndescription: helps\n---\nP1\n')
  write(path.join(pl, 'plugins', 'p1', 'commands', 'review.md'), '---\ndescription: review\n---\nP1\n')
  skill(path.join(pl, 'plugins', 'p1', 'skills'), 'plug-skill')
  write(path.join(pl, 'plugins', 'p2', 'agents', 'helper.md'), '---\nname: helper\ndescription: helps\n---\nP2 differs\n')
  write(path.join(pl, 'plugins', 'p3', 'commands', 'ignored.md'), 'no\n'); skill(path.join(pl, 'plugins', 'p3', 'skills'), 'only-skill')
  const plSha = commit(pl)
  lockFile = path.join(tmp, 'lock.json')
  fs.writeFileSync(lockFile, JSON.stringify({
    version: 1,
    sources: {
      superpowers: { repo: sp, commit: spSha, skills: { from: 'skills', names: '*' }, support: [{ from: 'hooks', to: 'superpowers/hooks' }, { from: 'skills/using-superpowers', to: 'superpowers/skills/using-superpowers' }] },
      plugins: { repo: pl, commit: plSha, plugins: { from: 'plugins', names: ['p1', 'p2'] } },
      skillsonly: { repo: pl, commit: plSha, plugins: { from: 'plugins', names: ['p3'], skillsOnly: true } },
    },
    agentToolRestrictions: { tools: 'Read, Grep, Glob, Bash', agents: ['code-reviewer', 'does-not-exist'] },
    retire: { skills: ['old-skill'] },
  }))
})
after(() => fs.rmSync(tmp, { recursive: true, force: true }))

function makeHome(name) {
  const home = path.join(tmp, name)
  write(path.join(home, 'settings.json'), JSON.stringify({ theme: 'dark', hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'orca-hook' }] }], PreToolUse: [{ matcher: 'Bash', hooks: [{ type: 'command', command: 'orca-pre' }] }] }, permissions: { allow: ['Bash(ls)'] } }, null, 2))
  write(path.join(home, 'CLAUDE.md'), '# My own notes\n\nKeep me.\n')
  skill(path.join(home, 'skills'), 'brainstorming') // a skill that is not ours
  skill(path.join(home, 'skills'), 'old-skill')
  return home
}
const opts = (home, extra = {}) => ({ home, lock: lockFile, ...extra })

test('parseArgs accepts the documented flags and rejects unknown ones', () => {
  assert.deepEqual(parseArgs(['--dry-run', '--only', 'a,b', '--no-hook', '--retire']).only, ['a', 'b'])
  assert.throws(() => parseArgs(['--nope']))
})

test('dry run plans everything and changes nothing in the Claude folder', () => {
  const home = makeHome('h-dry'); const before = snapshot(home)
  const res = run(opts(home, { dryRun: true }), quiet)
  assert.ok(res.ops.length >= 8)
  assert.deepEqual(snapshot(home), before)
})

test('install adds skills, agents, commands, hook files, settings, CLAUDE.md block and a manifest', () => {
  const home = makeHome('h-install')
  run(opts(home), quiet)
  for (const f of ['skills/using-superpowers/SKILL.md', 'skills/plug-skill/SKILL.md', 'skills/only-skill/SKILL.md', 'agents/code-reviewer.md', 'agents/helper.md', 'commands/review.md', 'superpowers/hooks/run-hook.cmd', 'superpowers/skills/using-superpowers/SKILL.md', 'hooks/guard.js', '.claude-config/manifest.json'])
    assert.ok(fs.existsSync(path.join(home, f)), `missing ${f}`)
  assert.ok(!fs.existsSync(path.join(home, 'commands', 'ignored.md')), 'skillsOnly must not install commands')
  // clashing agent from the second plugin keeps its own name with a plugin prefix
  assert.match(fs.readFileSync(path.join(home, 'agents', 'p2-helper.md'), 'utf8'), /P2 differs/)
  assert.match(fs.readFileSync(path.join(home, 'agents', 'helper.md'), 'utf8'), /P1/)
  // a skill that was already there and is not ours is untouched
  assert.match(fs.readFileSync(path.join(home, 'skills', 'brainstorming', 'SKILL.md'), 'utf8'), /test skill brainstorming/)
  // review agent got a tools line right after model
  assert.match(fs.readFileSync(path.join(home, 'agents', 'code-reviewer.md'), 'utf8'), /model: opus\r?\ntools: Read, Grep, Glob, Bash/)
  // CLAUDE.md keeps the user's text and gains one block
  const md = fs.readFileSync(path.join(home, 'CLAUDE.md'), 'utf8')
  assert.match(md, /Keep me\./); assert.equal(md.split('claude-config:begin').length - 1, 1)
  // settings keep foreign keys and gain our hooks and deny rules
  const s = JSON.parse(fs.readFileSync(path.join(home, 'settings.json'), 'utf8'))
  assert.equal(s.theme, 'dark'); assert.deepEqual(s.permissions.allow, ['Bash(ls)'])
  assert.ok(s.hooks.SessionStart.some(e => e.hooks.some(h => h.command === 'orca-hook')))
  assert.ok(s.hooks.SessionStart.some(e => e.hooks.some(h => /superpowers\/hooks\/run-hook\.cmd/.test(h.command) && !h.command.includes('{{'))))
  assert.ok(s.hooks.PreToolUse.some(e => e.hooks.some(h => /hooks\/guard\.js/.test(h.command))))
  assert.ok(s.permissions.deny.includes('Read(~/.ssh/**)'))
  assert.ok(!JSON.stringify(s).includes('_requires'))
  // a backup of the previous settings and CLAUDE.md exists
  assert.ok(fs.readdirSync(path.join(home, 'backups')).length === 1)
})

test('install is idempotent: a second run changes neither settings nor CLAUDE.md', () => {
  const home = makeHome('h-idem')
  run(opts(home), quiet)
  const s1 = fs.readFileSync(path.join(home, 'settings.json'), 'utf8'); const m1 = fs.readFileSync(path.join(home, 'CLAUDE.md'), 'utf8')
  const res = run(opts(home), quiet)
  assert.equal(fs.readFileSync(path.join(home, 'settings.json'), 'utf8'), s1)
  assert.equal(fs.readFileSync(path.join(home, 'CLAUDE.md'), 'utf8'), m1)
  assert.equal(res.settings.hooks.length, 0); assert.equal(res.settings.deny.length, 0)
  const manifest = JSON.parse(fs.readFileSync(path.join(home, '.claude-config', 'manifest.json'), 'utf8'))
  assert.equal(new Set(manifest.installed.map(i => i.dest)).size, manifest.installed.length, 'no duplicate manifest entries')
})

test('--no-hook skips the superpowers hook but keeps the guard', () => {
  const home = makeHome('h-nohook')
  run(opts(home, { noHook: true }), quiet)
  const s = JSON.parse(fs.readFileSync(path.join(home, 'settings.json'), 'utf8'))
  assert.ok(!JSON.stringify(s).includes('run-hook.cmd'))
  assert.ok(JSON.stringify(s).includes('guard.js'))
})

test('--only limits which sources are installed, and unknown ids fail', () => {
  const home = makeHome('h-only')
  run(opts(home, { only: ['plugins'] }), quiet)
  assert.ok(fs.existsSync(path.join(home, 'skills', 'plug-skill')))
  assert.ok(!fs.existsSync(path.join(home, 'skills', 'using-superpowers')))
  assert.ok(!JSON.stringify(JSON.parse(fs.readFileSync(path.join(home, 'settings.json'), 'utf8'))).includes('run-hook.cmd'), 'no superpowers source, so no superpowers hook')
  assert.throws(() => run(opts(home, { only: ['nope'] }), quiet), /Unknown source/)
})

test('status reports missing files', () => {
  const home = makeHome('h-status')
  run(opts(home), quiet)
  assert.equal(run(opts(home, { status: true }), quiet).missing.length, 0)
  fs.rmSync(path.join(home, 'skills', 'plug-skill'), { recursive: true })
  assert.equal(run(opts(home, { status: true }), quiet).missing.length, 1)
})

test('--retire moves listed skills to skills-removed and uninstall restores them', () => {
  const home = makeHome('h-retire')
  run(opts(home, { retire: true }), quiet)
  assert.ok(!fs.existsSync(path.join(home, 'skills', 'old-skill')))
  assert.ok(fs.existsSync(path.join(home, 'skills-removed', 'old-skill', 'SKILL.md')))
  run(opts(home, { uninstall: true }), quiet)
  assert.ok(fs.existsSync(path.join(home, 'skills', 'old-skill', 'SKILL.md')))
})

test('uninstall removes exactly what was added and restores settings and CLAUDE.md', () => {
  const home = makeHome('h-uninstall')
  const settings0 = JSON.parse(fs.readFileSync(path.join(home, 'settings.json'), 'utf8')); const md0 = fs.readFileSync(path.join(home, 'CLAUDE.md'), 'utf8')
  run(opts(home), quiet)
  run(opts(home, { uninstall: true, dryRun: true }), quiet)
  assert.ok(fs.existsSync(path.join(home, 'skills', 'plug-skill')), 'dry-run uninstall must not remove anything')
  run(opts(home, { uninstall: true }), quiet)
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(home, 'settings.json'), 'utf8')), settings0)
  assert.equal(fs.readFileSync(path.join(home, 'CLAUDE.md'), 'utf8').trim(), md0.trim())
  for (const f of ['skills/plug-skill', 'skills/using-superpowers', 'agents/helper.md', 'hooks/guard.js', 'superpowers', '.claude-config/manifest.json'])
    assert.ok(!fs.existsSync(path.join(home, f)), `still there: ${f}`)
  assert.ok(fs.existsSync(path.join(home, 'skills', 'brainstorming', 'SKILL.md')), 'a skill we did not install stays')
})

test('a fetch that does not return the pinned commit fails loudly', () => {
  const lock = JSON.parse(fs.readFileSync(lockFile, 'utf8'))
  lock.sources.superpowers.commit = '0'.repeat(40)
  const bad = path.join(tmp, 'bad-lock.json'); fs.writeFileSync(bad, JSON.stringify(lock))
  assert.throws(() => run({ home: makeHome('h-bad'), lock: bad }, quiet), /git fetch failed/)
})

test('CLAUDE.md helpers replace and remove only their own block', () => {
  const a = mergeClaudeMd('mine\n', 'v1'); const b = mergeClaudeMd(a, 'v2')
  assert.match(b, /v2/); assert.doesNotMatch(b, /v1/); assert.match(b, /^mine/)
  assert.equal(removeClaudeMdBlock(b).trim(), 'mine')
  assert.equal(mergeClaudeMd(null, 'x').includes('claude-config:begin'), true)
})

test('settings helpers are symmetric', () => {
  const frag = JSON.parse(fs.readFileSync(path.join(ROOT, 'config', 'settings.fragment.json'), 'utf8'))
  const s = { keep: 1 }; const added = mergeSettings(s, frag, '/h', { noHook: false, hasSuperpowers: true })
  assert.equal(added.hooks.length, 2); assert.ok(added.deny.length >= 10)
  assert.deepEqual(removeFromSettings(s, added), { keep: 1 })
})

test('restrictAgent adds tools once and respects an existing tools line', () => {
  const t = '---\nname: a\nmodel: opus\ndescription: d\n---\nbody'
  const p = restrictAgent(t, 'Read'); assert.match(p, /model: opus\ntools: Read/)
  assert.equal(restrictAgent(p, 'Read'), null)
  assert.match(restrictAgent('---\r\nname: a\r\ndescription: d\r\n---\r\nb', 'Read'), /\r\ntools: Read/)
})

test('the real lock file and config are well formed', () => {
  const lock = JSON.parse(fs.readFileSync(path.join(ROOT, 'sources.lock.json'), 'utf8'))
  for (const [id, s] of Object.entries(lock.sources)) {
    assert.match(s.commit, /^[0-9a-f]{40}$/, `${id}: commit must be a full SHA`)
    assert.match(s.repo, /^https:\/\/github\.com\//)
    assert.ok(s.license && s.reviewed)
  }
  for (const f of ['config/CLAUDE.md', 'config/hooks/guard.js', 'config/settings.fragment.json']) assert.ok(fs.existsSync(path.join(ROOT, f)), f)
  assert.ok(!fs.existsSync(path.join(ROOT, 'config', 'skills')), 'personal skills belong in an overlay, not in this repo')
  const text = ['config/CLAUDE.md', 'config/settings.fragment.json', 'sources.lock.json', 'README.md', 'SECURITY.md', 'CONTRIBUTING.md', 'CHANGELOG.md', 'docs/CUSTOMIZING.md', 'docs/REFERENCE.md', 'examples/overlay/CLAUDE.md', 'examples/overlay/overlay.json'].map(f => fs.readFileSync(path.join(ROOT, f), 'utf8')).join('\n')
  assert.doesNotMatch(text, /[A-Za-z]:\\Users\\|\/Users\/[a-z]|\/home\/[a-z]|@gmail\.com/i, 'no personal paths or e-mail addresses in the public files')
})

// ---------- overlay ----------
function makeOverlay(name) {
  const o = path.join(tmp, name)
  write(path.join(o, 'CLAUDE.md'), '# Overlay rules\n\nPrivate rule.\n')
  skill(path.join(o, 'skills'), 'overlay-skill')
  write(path.join(o, 'hooks', 'guard.config.json'), '{ "blockCommitTrailers": true }\n')
  write(path.join(o, 'settings.fragment.json'), JSON.stringify({ permissions: { deny: ['Read(~/.private/**)'] } }))
  write(path.join(o, 'overlay.json'), JSON.stringify({ retire: { skills: ['brainstorming'] }, agentToolRestrictions: { agents: ['helper'] } }))
  return o
}

test('overlay: its CLAUDE.md replaces the default, its skills, hook config, deny rules and restrictions are applied', () => {
  const home = makeHome('h-overlay'); const overlay = makeOverlay('overlay-1')
  const res = run(opts(home, { overlay }), quiet)
  assert.ok(res.ops.some(o => o.label === 'overlay'))
  assert.ok(fs.existsSync(path.join(home, 'skills', 'overlay-skill', 'SKILL.md')))
  assert.match(fs.readFileSync(path.join(home, 'hooks', 'guard.config.json'), 'utf8'), /blockCommitTrailers/)
  const md = fs.readFileSync(path.join(home, 'CLAUDE.md'), 'utf8')
  assert.match(md, /Private rule\./); assert.doesNotMatch(md, /Working defaults/); assert.match(md, /Keep me\./)
  const s = JSON.parse(fs.readFileSync(path.join(home, 'settings.json'), 'utf8'))
  assert.ok(s.permissions.deny.includes('Read(~/.private/**)') && s.permissions.deny.includes('Read(~/.ssh/**)'), 'deny rules are united')
  assert.match(fs.readFileSync(path.join(home, 'agents', 'helper.md'), 'utf8'), /tools: Read, Grep, Glob, Bash/, 'overlay can restrict more agents')
})

test('overlay: --retire uses the overlay list, and uninstall removes everything the overlay added', () => {
  const home = makeHome('h-overlay-2'); const overlay = makeOverlay('overlay-2')
  fs.rmSync(path.join(home, 'skills', 'brainstorming'), { recursive: true }) // the fixture skill that is not ours, so retire has no clash with the installed one
  run(opts(home, { overlay, retire: true }), quiet)
  assert.ok(fs.existsSync(path.join(home, 'skills-removed', 'brainstorming')), 'retired from the overlay list')
  run(opts(home, { overlay, uninstall: true }), quiet)
  for (const f of ['skills/overlay-skill', 'hooks/guard.config.json', 'hooks']) assert.ok(!fs.existsSync(path.join(home, f)), `still there: ${f}`)
  const s = JSON.parse(fs.readFileSync(path.join(home, 'settings.json'), 'utf8'))
  assert.ok(!(s.permissions.deny || []).length, 'deny rules added by the installer are gone')
})

test('the example overlay shipped in examples/ installs and uninstalls cleanly', () => {
  const home = makeHome('h-example'); const overlay = path.join(ROOT, 'examples', 'overlay')
  run(opts(home, { overlay }), quiet)
  assert.ok(fs.existsSync(path.join(home, 'skills', 'team-conventions', 'SKILL.md')))
  assert.match(fs.readFileSync(path.join(home, 'CLAUDE.md'), 'utf8'), /# My rules/)
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(home, 'hooks', 'guard.config.json'), 'utf8')).protectedBranches, ['main', 'master', 'release'])
  run(opts(home, { overlay, uninstall: true }), quiet)
  assert.ok(!fs.existsSync(path.join(home, 'skills', 'team-conventions')))
})

test('resolveOverlay: --no-overlay beats everything, then --overlay, --profile and CLAUDE_CONFIG_OVERLAY', () => {
  const env = { CLAUDE_CONFIG_OVERLAY: path.join(tmp, 'from-env') }
  assert.equal(resolveOverlay({}, {}), null)
  assert.equal(resolveOverlay({}, env), path.resolve(env.CLAUDE_CONFIG_OVERLAY))
  assert.equal(resolveOverlay({ overlay: 'x' }, env), path.resolve('x'))
  assert.equal(resolveOverlay({ profile: 'sebas' }, env), path.join(ROOT, 'profiles', 'sebas'))
  assert.equal(resolveOverlay({ noOverlay: true, overlay: 'x' }, env), null)
  assert.throws(() => resolveOverlay({ overlay: 'x', profile: 'sebas' }, {}), /either/)
  assert.throws(() => resolveOverlay({ profile: 'nope' }, {}), /Unknown profile: nope \(available: sebas/)
  assert.throws(() => resolveOverlay({ profile: '../x' }, {}), /Unknown profile/, 'a profile name cannot escape the profiles folder')
})

test('every shipped profile installs and uninstalls cleanly, with valid skills', () => {
  for (const name of fs.readdirSync(path.join(ROOT, 'profiles'))) {
    const home = makeHome('h-profile-' + name)
    run(opts(home, { overlay: path.join(ROOT, 'profiles', name) }), quiet)
    for (const n of fs.readdirSync(path.join(ROOT, 'profiles', name, 'skills'))) {
      const t = fs.readFileSync(path.join(home, 'skills', n, 'SKILL.md'), 'utf8')
      assert.match(t, new RegExp(`^---\\r?\\nname: ${n}\\r?\\n`)); assert.match(t, /\ndescription: .{20,}/)
    }
    run(opts(home, { overlay: path.join(ROOT, 'profiles', name), uninstall: true }), quiet)
    assert.ok(!fs.existsSync(path.join(home, 'skills', fs.readdirSync(path.join(ROOT, 'profiles', name, 'skills'))[0])))
  }
})

test('two overlays applied one after the other both stay installed, and one uninstall removes both', () => {
  const home = makeHome('h-two'); const a = makeOverlay('overlay-a'); const b = path.join(tmp, 'overlay-b')
  skill(path.join(b, 'skills'), 'second-skill')
  write(path.join(b, 'settings.fragment.json'), JSON.stringify({ permissions: { deny: ['Read(~/.second/**)'] } }))
  run(opts(home, { overlay: a }), quiet); run(opts(home, { overlay: b }), quiet)
  assert.ok(fs.existsSync(path.join(home, 'skills', 'overlay-skill')) && fs.existsSync(path.join(home, 'skills', 'second-skill')))
  const s = JSON.parse(fs.readFileSync(path.join(home, 'settings.json'), 'utf8'))
  assert.ok(s.permissions.deny.includes('Read(~/.private/**)') && s.permissions.deny.includes('Read(~/.second/**)'))
  run(opts(home, { uninstall: true }), quiet)
  assert.ok(!fs.existsSync(path.join(home, 'skills', 'overlay-skill')) && !fs.existsSync(path.join(home, 'skills', 'second-skill')))
  assert.ok(!(JSON.parse(fs.readFileSync(path.join(home, 'settings.json'), 'utf8')).permissions || {}).deny, 'all deny rules added by either run are gone')
})

test('a missing overlay folder is an error, not a silent skip', () => {
  assert.throws(() => run(opts(makeHome('h-no-overlay'), { overlay: path.join(tmp, 'nope') }), quiet), /Overlay folder not found/)
})

test('--no-claude-md leaves CLAUDE.md alone', () => {
  const home = makeHome('h-nomd'); const before = fs.readFileSync(path.join(home, 'CLAUDE.md'), 'utf8')
  run(opts(home, { noClaudeMd: true }), quiet)
  assert.equal(fs.readFileSync(path.join(home, 'CLAUDE.md'), 'utf8'), before)
})

test('mergeLock and mergeFragments combine without mutating the base', () => {
  const base = { sources: { a: 1 }, retire: { skills: ['x'] }, agentToolRestrictions: { tools: 'Read', agents: ['a1'] } }
  const merged = mergeLock(base, { sources: { b: 2 }, retire: { skills: ['x', 'y'] }, agentToolRestrictions: { agents: ['a2'] } })
  assert.deepEqual(merged.sources, { a: 1, b: 2 }); assert.deepEqual(merged.retire.skills, ['x', 'y']); assert.deepEqual(merged.agentToolRestrictions, { tools: 'Read', agents: ['a1', 'a2'] })
  assert.deepEqual(base.sources, { a: 1 })
  const f = mergeFragments({ hooks: { PreToolUse: [{ n: 1 }] }, permissions: { deny: ['a'] } }, { hooks: { PreToolUse: [{ n: 2 }], Stop: [{ n: 3 }] }, permissions: { deny: ['a', 'b'] } })
  assert.deepEqual(f.hooks.PreToolUse, [{ n: 1 }, { n: 2 }]); assert.deepEqual(f.hooks.Stop, [{ n: 3 }]); assert.deepEqual(f.permissions.deny, ['a', 'b'])
})
