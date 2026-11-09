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

test('no published file holds a personal path, e-mail address or token-looking string', () => {
  const files = spawnSync('git', ['ls-files', '-z'], { cwd: ROOT, encoding: 'utf8' }).stdout.split('\0').filter(Boolean)
  const bad = /[A-Za-z]:\Users\[A-Za-z]|\/Users\/[a-z]+\/|\/home\/[a-z]+\/|@gmail\.com|ghp_[0-9A-Za-z]{20,}|github_pat_|AIza[0-9A-Za-z_-]{20,}|BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY/
  const hits = files.filter(f => f !== 'test/privacy.test.mjs' && bad.test(fs.readFileSync(path.join(ROOT, f), 'utf8')))
  assert.deepEqual(hits, [])
})
