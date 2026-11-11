import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const guardPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'config', 'hooks', 'guard.js')
const { check, loadConfig, DEFAULTS, splitCommands, tokenize } = createRequire(import.meta.url)(guardPath)

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

  // --- commands an audit got past the first version of the guard ---
  ['git push origin +main', true],
  ['git push -fu origin main', true],
  ['git push origin HEAD:main --force', true],
  ['git push origin :main', true],
  ['git push --delete origin main', true],
  ['git push --mirror', true],
  ['git push --force', true],
  ['git push --force-with-lease origin main', true],
  ['git -c core.hooksPath=/dev/null commit -m x', true],
  ['git -c core.hooksPath=/dev/null push origin feat/x', true],
  ['FOO=1 git commit -n -m x', true],
  ['sudo git commit --no-verify -m x', true],
  ['env GIT_AUTHOR_NAME=x git commit -n -m x', true],
  ['bash -c "git commit --no-verify -m x"', true],
  ["sh -c 'git push -f origin main'", true],
  ['eval "git commit -n -m x"', true],
  ['powershell -Command "git commit --no-verify -m x"', true],
  ['bash -lc "cd repo && git push origin +master"', true],
  ['rm -rf /*', true],
  ['rm -rf ~/', true],
  ['rm -rf "$HOME"', true],
  ['rm -r -f /', true],
  ['rm -rf --no-preserve-root /', true],
  ['sudo rm -rf /', true],
  ['rm -rf C:\\', true],
  ['Remove-Item -Recurse -Force C:\\', true],

  // --- secrets read through the shell (the Read-tool deny rules do not see these) ---
  ['cat .env', true],
  ['cat ~/.ssh/id_rsa', true],
  ['head -n 2 < .env.production', true],
  ['grep -r KEY ~/.aws/credentials', true],
  ['cp app/release.jks /tmp/x.jks', true],
  ['base64 service-account-prod.json', true],
  ['cat ./config/.env.local', true],

  // --- must stay allowed: no false positives ---
  ['git push -f origin feature/main-menu', false],
  ['git push origin feature/main-menu', false],
  ['git push --force-with-lease origin feat/x', false],
  ['git push -u origin feat/x', false],
  ['git -C repo push origin feat/x', false],
  ['git commit -m "-n"', false],
  ['git commit -m "fix: use bash -c carefully and never --no-verify"', false],
  ['git checkout main', false],
  ['git log --oneline', false],
  ['echo "git push -f origin main"', false],
  ['rm -rf build/', false],
  ['rm -rf ./node_modules', false],
  ['rm -r /tmp/mydir', false],
  ['cat .env.example', false],
  ['cat README.md', false],
  ['grep -r TODO src/', false],
  ['bash -c "npm test"', false],
  ['doppler run -p x -c prd -- npm start', false],
]
for (const [cmd, block] of DEFAULT_CASES) test(`defaults ${block ? 'block' : 'allow'}: ${JSON.stringify(cmd).slice(0, 64)}`, () => assert.equal(!!check(cmd), block))

test('the parser splits chains and words without touching quoted text', () => {
  assert.deepEqual(splitCommands('a && b || c; d | e & f'), ['a', 'b', 'c', 'd', 'e', 'f'])
  assert.deepEqual(splitCommands('git commit -m "a && b; c"'), ['git commit -m "a && b; c"'])
  assert.deepEqual(tokenize('git commit -m "two words" \'and more\' plain\\ escaped'), ['git', 'commit', '-m', 'two words', 'and more', 'plain escaped'])
})

test('blockCommitTrailers (opt-in) blocks Co-Authored-By and "Generated with" trailers', () => {
  const cfg = { ...DEFAULTS, blockCommitTrailers: true }
  assert.ok(check('git commit -m "x\n\nCo-Authored-By: Someone <a@b.c>"', cfg))
  assert.ok(check('git commit -m "x" -m "🤖 Generated with Claude Code"', cfg))
  assert.equal(check('git commit -m "plain"', cfg), null)
})

test('a commit message read from a file cannot be checked for trailers, so that rule asks for -m', () => {
  const cfg = { ...DEFAULTS, blockCommitTrailers: true }
  assert.ok(check('git commit -F msg.txt', cfg))
  assert.ok(check('git commit --file=msg.txt', cfg))
  assert.equal(check('git commit -F msg.txt', DEFAULTS), null)
})

test('shell wrappers are followed a few levels deep and never loop', () => {
  assert.ok(check('bash -c "bash -c \\"git commit -n -m x\\""', DEFAULTS))
  const deep = 'bash -c "'.repeat(6) + 'git commit -n' + '"'.repeat(6)
  assert.doesNotThrow(() => check(deep, DEFAULTS))
})

test('protectedBranches is configurable and matched exactly, never as a substring', () => {
  assert.equal(check('git push --force origin release', DEFAULTS), null)
  assert.ok(check('git push --force origin release', { ...DEFAULTS, protectedBranches: ['release'] }))
  assert.equal(check('git push --force origin main', { ...DEFAULTS, protectedBranches: [] }), null)
  assert.equal(check('git push --force origin maintenance', DEFAULTS), null)
  assert.ok(check('git push origin refs/heads/main --force', DEFAULTS))
})

test('each rule can be switched off', () => {
  assert.equal(check('git commit --no-verify -m x', { ...DEFAULTS, blockNoVerify: false }), null)
  assert.equal(check('git push -f origin main', { ...DEFAULTS, blockForcePush: false }), null)
  assert.equal(check('git add .env', { ...DEFAULTS, blockSecretStaging: false }), null)
  assert.equal(check('rm -rf /', { ...DEFAULTS, blockRmRoot: false }), null)
  assert.equal(check('cat .env', { ...DEFAULTS, blockSecretReads: false }), null)
})

test('loadConfig reads guard.config.json, ignores a missing or broken file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-cfg-'))
  assert.deepEqual(loadConfig(dir), DEFAULTS)
  fs.writeFileSync(path.join(dir, 'guard.config.json'), '{ "blockCommitTrailers": true }')
  assert.equal(loadConfig(dir).blockCommitTrailers, true)
  assert.equal(loadConfig(dir).blockNoVerify, true)
  fs.writeFileSync(path.join(dir, 'guard.config.json'), '{ not json')
  assert.deepEqual(loadConfig(dir), DEFAULTS)
  fs.rmSync(dir, { recursive: true, force: true })
})

test('hook protocol: exit 2 blocks with a reason, exit 0 allows, garbage input is ignored; config file is honoured', () => {
  // The test runner marks its children with NODE_TEST_CONTEXT; a nested node must not inherit it
  const env = { ...process.env }
  delete env.NODE_TEST_CONTEXT
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'guard-proto-'))
  fs.copyFileSync(guardPath, path.join(dir, 'guard.js'))
  const run = input => spawnSync(process.execPath, [path.join(dir, 'guard.js')], { input, encoding: 'utf8', env, timeout: 15000 })
  const blocked = run(JSON.stringify({ tool_input: { command: 'git commit --no-verify -m x' } }))
  assert.equal(blocked.status, 2)
  assert.match(blocked.stderr, /Blocked by/)
  assert.equal(run(JSON.stringify({ tool_input: { command: 'ls' } })).status, 0)
  assert.equal(run('not json').status, 0)
  const trailer = JSON.stringify({ tool_input: { command: 'git commit -m "x\n\nCo-Authored-By: A <a@b.c>"' } })
  assert.equal(run(trailer).status, 0, 'off by default')
  fs.writeFileSync(path.join(dir, 'guard.config.json'), '{ "blockCommitTrailers": true }')
  assert.equal(run(trailer).status, 2, 'on with the config file next to the hook')
  fs.rmSync(dir, { recursive: true, force: true })
})
