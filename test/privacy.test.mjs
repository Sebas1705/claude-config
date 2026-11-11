import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

// Terms that must never appear in a published file live in an untracked `.privacy-terms` (one per line, case-insensitive),
// so this repository does not have to spell out the names it is protecting. Without the file the test is skipped.
const termsFile = path.join(ROOT, '.privacy-terms')
const terms = fs.existsSync(termsFile) ? fs.readFileSync(termsFile, 'utf8').split(/\r?\n/).map(t => t.trim().toLowerCase()).filter(Boolean) : []

test('published files contain none of the terms in .privacy-terms', { skip: terms.length === 0 && 'no .privacy-terms file (maintainer-only check)' }, () => {
  const files = spawnSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).stdout.split('\0').filter(Boolean)
  assert.ok(files.length > 10)
  const hits = []
  for (const f of files) {
    if (f === '.privacy-terms') continue
    const text = fs.readFileSync(path.join(ROOT, f), 'utf8').toLowerCase()
    for (const t of terms) if (text.includes(t)) hits.push(`${f}: ${t}`)
  }
  assert.deepEqual(hits, [])
})

const PERSONAL = /[A-Za-z]:[\\/]Users[\\/][A-Za-z]|\/Users\/[a-z]+\/|\/home\/[a-z]+\/|@gmail\.com|ghp_[0-9A-Za-z]{20,}|github_pat_|AIza[0-9A-Za-z_-]{20,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/

test('the personal-data pattern matches real paths, addresses and keys (and not ordinary text)', () => {
  // A first version of the Windows-path alternative was mis-escaped and never matched anything.
  for (const hit of ['C:\\Users\\someone\\x', 'D:/Users/someone/x', '/Users/someone/Documents/', '/home/someone/.ssh/', 'someone@gmail.com', 'ghp_' + 'a'.repeat(24), 'BEGIN RSA PRIVATE KEY'])
    assert.match(hit, PERSONAL, hit)
  for (const fine of ['C:\\Program Files\\x', 'users are listed here', 'see /home/ for details', 'user@example.com'])
    assert.doesNotMatch(fine, PERSONAL, fine)
})

test('no published file holds a personal path, e-mail address or token-looking string', () => {
  const files = spawnSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).stdout.split('\0').filter(Boolean)
  const hits = files.filter(f => f !== 'test/privacy.test.mjs' && PERSONAL.test(fs.readFileSync(path.join(ROOT, f), 'utf8')))
  assert.deepEqual(hits, [])
})

// Skills should teach how the owner works, learned from whichever project is open, not name specific repositories.
// The names live in an untracked `.project-names` file (one per line); without it the test is skipped.
const namesFile = path.join(ROOT, '.project-names')
const names = fs.existsSync(namesFile) ? fs.readFileSync(namesFile, 'utf8').split(/\r?\n/).map(t => t.trim().toLowerCase()).filter(Boolean) : []

test('skills in profiles/ do not mention specific projects by name', { skip: names.length === 0 && 'no .project-names file (maintainer-only check)' }, () => {
  const walk = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
  const profiles = path.join(ROOT, 'profiles')
  const files = fs.readdirSync(profiles).flatMap(p => (fs.existsSync(path.join(profiles, p, 'skills')) ? walk(path.join(profiles, p, 'skills')) : []))
  assert.ok(files.length >= 4)
  const hits = []
  for (const f of files) {
    const text = fs.readFileSync(f, 'utf8').toLowerCase()
    for (const n of names) if (new RegExp(`(^|[^a-z0-9])${n.replace(/[-.]/g, '\$&')}([^a-z0-9]|$)`).test(text)) hits.push(`${path.relative(ROOT, f)}: ${n}`)
  }
  assert.deepEqual(hits, [])
})
