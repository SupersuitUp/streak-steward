#!/usr/bin/env node
// Builds test/consumer, a minimal Next.js 16 app that installs this package the way an app does:
// from the packed tarball, not from the source tree. A package whose tests pass but which breaks an
// app's build (a lost 'use client', a server import reaching the client entry) fails here, before
// it is published. The band styles itself inline, so there is no stylesheet to check.
import { execFileSync } from 'node:child_process'
import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const APP = join(ROOT, 'test/consumer')
const PACK = join(APP, '.pack')
const run = (cmd, args, cwd) => execFileSync(cmd, args, { cwd, stdio: 'inherit' })

rmSync(PACK, { recursive: true, force: true })
mkdirSync(PACK)
run('npm', ['pack', '--pack-destination', PACK], ROOT)
const tgz = readdirSync(PACK).find((f) => f.endsWith('.tgz'))
if (!tgz) { console.error('npm pack produced no tarball'); process.exit(1) }
run('npm', ['install', '--no-audit', '--no-fund'], APP)
run('npm', ['install', '--no-save', '--no-audit', '--no-fund', join(PACK, tgz)], APP)
rmSync(join(APP, '.next'), { recursive: true, force: true })
run('npx', ['next', 'build'], APP)

console.log('the consumer app built against the packed package')
