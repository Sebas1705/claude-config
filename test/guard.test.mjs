import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const guardPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'config', 'hooks', 'guard.js')
const { check, loadConfig, DEFAULTS } = createRequire(import.meta.url)(guardPath)

// [command, blocked with the defaults]
const DEFAULT_CASES = [
  ['git commit -m "feat: x"', false],
  ['git commit -am "fix: y"', false],
  ['git commit --no-verify -m "x"', true],
  ['git commit -n -m "x"', true],
  ['git commit -m "mention --no-verify and -n in text"', false],
  ['git -C repo commit --no-verify -m x', true],
  ['git push origin main', false],
  ['git push --force origin main', true],
  ['git push -f origin master', true],
  ['git push --force-with-lease origin feat/x', false],
  ['git push --force origin feat/x', false],
  ['git add app/release.jks', true],
  ['git add .env', true],
  ['git add .env.example', false],
  ['git add src/main.kt', false],
  ['rm -rf /', true],
  ['rm -rf ~', true],
  ['rm -rf node_modules', false],
  ['npm test && git commit -m "ok"', false],
  ['npm test && git commit --no-verify -m "bad"', true],
  // commit trailers are a preference, so they are allowed unless the config turns the rule on
  ['git commit -m "x\n\nCo-Authored-By: Someone <a@b.c>"', false],
]
for (const [cmd, block] of DEFAULT_CASES) test(`defaults ${block ? 'block' : 'allow'}: ${JSON.stringify(cmd).slice(0, 64)}`, () => assert.equal(!!check(cmd), block))

test('blockCommitTrailers (opt-in) blocks Co-Authored-By and "Generated with" trailers', () => {
  const cfg = { ...DEFAULTS, blockCommitTrailers: true }
  assert.ok(check('git commit -m "x\n\nCo-Authored-By: Someone <a@b.c>"', cfg))
  assert.ok(check('git commit -m "x" -m "🤖 Generated with Claude Code"', cfg))
  assert.equal(check('git commit -m "plain"', cfg), null)
})

test('protectedBranches is configurable', () => {
  assert.equal(check('git push --force origin release', DEFAULTS), null)
  assert.ok(check('git push --force origin release', { ...DEFAULTS, protectedBranches: ['release'] }))
  assert.equal(check('git push --force origin main', { ...DEFAULTS, protectedBranches: [] }), null)
})

test('each rule can be switched off', () => {
  assert.equal(check('git commit --no-verify -m x', { ...DEFAULTS, blockNoVerify: false }), null)
  assert.equal(check('git push -f origin main', { ...DEFAULTS, blockForcePush: false }), null)
  assert.equal(check('git add .env', { ...DEFAULTS, blockSecretStaging: false }), null)
  assert.equal(check('rm -rf /', { ...DEFAULTS, blockRmRoot: false }), null)
})

test('loadConfig reads guard.config.json, ignores a missing or broken file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-cfg-'))
  assert.deepEqual(loadConfig(dir), DEFAULTS)
  fs.writeFileSync(path.join(dir, 'guard.config.json'), '{ "blockCommitTrailers": true }')
  assert.equal(loadConfig(dir).blockCommitTrailers, true); assert.equal(loadConfig(dir).blockNoVerify, true)
  fs.writeFileSync(path.join(dir, 'guard.config.json'), '{ not json')
  assert.deepEqual(loadConfig(dir), DEFAULTS)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('hook protocol: exit 2 blocks with a reason, exit 0 allows, garbage input is ignored; config file is honoured', () => {
  // The test runner marks its children with NODE_TEST_CONTEXT; a nested node must not inherit it
  const env = { ...process.env }; delete env.NODE_TEST_CONTEXT
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-proto-'))
  fs.copyFileSync(guardPath, path.join(dir, 'guard.js'))
  const run = input => spawnSync(process.execPath, [path.join(dir, 'guard.js')], { input, encoding: 'utf8', env, timeout: 15000 })
  const blocked = run(JSON.stringify({ tool_input: { command: 'git commit --no-verify -m x' } }))
  assert.equal(blocked.status, 2); assert.match(blocked.stderr, /Blocked by/)
  assert.equal(run(JSON.stringify({ tool_input: { command: 'ls' } })).status, 0)
  assert.equal(run('not json').status, 0)
  const trailer = JSON.stringify({ tool_input: { command: 'git commit -m "x\n\nCo-Authored-By: A <a@b.c>"' } })
  assert.equal(run(trailer).status, 0, 'off by default')
  fs.writeFileSync(path.join(dir, 'guard.config.json'), '{ "blockCommitTrailers": true }')
  assert.equal(run(trailer).status, 2, 'on with the config file next to the hook')
  fs.rmSync(dir, { recursive: true, force: true })
})
