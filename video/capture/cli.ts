// pnpm capture <shot ...>        capture the named shots (files in shots/, without .ts)
// pnpm capture all               every shot
// pnpm capture <shot> --url http://localhost:5173   against a server already running
// pnpm capture <shot> --dev      against a Vite dev server this starts (default: a production build,
//                                reused until the app's sources change; --rebuild forces a new one)
//
// Each shot writes public/clips/<name>.mp4 (the footage), <name>.json (pointer
// track, marks) and <name>.sheet.jpg (a contact sheet to check the take at a glance).
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { createServer as netServer } from 'node:net';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { CLIPS_DIR, closeBrowser, runShot, type Shot } from './director';

const here = dirname(fileURLToPath(import.meta.url));
const videoRoot = resolve(here, '..');
const repoRoot = resolve(videoRoot, '..');
const shotsDir = join(videoRoot, 'shots');

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  if (i < 0) return undefined;
  const v = args[i + 1];
  args.splice(i, v && !v.startsWith('--') ? 2 : 1);
  return v && !v.startsWith('--') ? v : true;
};
const url = flag('--url') as string | undefined;
const dev = !!flag('--dev');
const rebuild = !!flag('--rebuild');
let names = args;
if (!names.length) {
  console.error('usage: pnpm capture <shot ...|all> [--url <base>] [--dev] [--rebuild]');
  process.exit(1);
}
const available = readdirSync(shotsDir)
  .filter((f) => f.endsWith('.ts') && !f.startsWith('_'))
  .map((f) => f.slice(0, -3));
if (names.includes('all')) names = available;
for (const n of names) {
  if (!available.includes(n)) {
    console.error(`no shot "${n}"; have: ${available.join(', ')}`);
    process.exit(1);
  }
}

const freePort = () =>
  new Promise<number>((res) => {
    const s = netServer().listen(0, () => {
      const p = (s.address() as { port: number }).port;
      s.close(() => res(p));
    });
  });

/** The newest modification time among the app's sources, to tell whether the last build is stale. */
function newestSource() {
  let newest = 0;
  const visit = (p: string) => {
    if (!existsSync(p)) return;
    const st = statSync(p);
    if (st.isDirectory()) {
      for (const f of readdirSync(p))
        if (f !== 'node_modules' && !f.startsWith('.')) visit(join(p, f));
    } else newest = Math.max(newest, st.mtimeMs);
  };
  for (const p of ['src', 'public', 'index.html', 'vite.config.ts', 'package.json', 'pnpm-lock.yaml'])
    visit(join(repoRoot, p));
  return newest;
}

/** Serve the app: an existing server, a fresh dev server, or a production build (default). */
async function serve(): Promise<{ base: string; close: () => Promise<void> }> {
  if (url) return { base: url, close: async () => {} };
  // the app's own Vite, so the build is exactly the one that ships
  const req = createRequire(join(repoRoot, 'package.json'));
  const vite = (await import(pathToFileURL(req.resolve('vite')).href)) as typeof import('vite');
  const port = await freePort();
  if (dev) {
    const server = await vite.createServer({
      root: repoRoot,
      logLevel: 'warn',
      server: { port, strictPort: true },
    });
    await server.listen();
    return { base: `http://localhost:${port}`, close: () => server.close() };
  }
  // the last build is reused while no source is newer than it (--rebuild forces one)
  const outDir = join(videoRoot, '.cache', 'site');
  const built = join(outDir, 'index.html');
  if (rebuild || !existsSync(built) || statSync(built).mtimeMs < newestSource()) {
    console.log('building the app…');
    await vite.build({ root: repoRoot, logLevel: 'warn', build: { outDir, emptyOutDir: true } });
  } else console.log('app unchanged since the last build; reusing it');
  const server = await vite.preview({
    root: repoRoot,
    logLevel: 'warn',
    build: { outDir },
    preview: { port, strictPort: true },
  });
  return {
    base: `http://localhost:${port}`,
    close: () => new Promise((r) => server.httpServer.close(() => r())),
  };
}

/** A 4×3 grid of evenly spaced frames, for checking a take without playing it. */
function contactSheet(name: string, frames: number) {
  const mp4 = join(CLIPS_DIR, `${name}.mp4`);
  if (!existsSync(mp4)) return;
  const every = Math.max(1, Math.floor(frames / 12));
  execFileSync('ffmpeg', [
    '-y',
    '-loglevel',
    'error',
    '-i',
    mp4,
    '-vf',
    `select='not(mod(n\\,${every}))',scale=640:-2,tile=4x3:padding=4`,
    '-frames:v',
    '1',
    '-q:v',
    '3',
    join(CLIPS_DIR, `${name}.sheet.jpg`),
  ]);
}

const { base, close } = await serve();
console.log(`capturing from ${base}`);
let failed = false;
try {
  for (const name of names) {
    const mod = (await import(pathToFileURL(join(shotsDir, `${name}.ts`)).href)) as { default: Shot };
    try {
      const meta = await runShot({ ...mod.default, name }, base);
      try {
        contactSheet(name, meta.frames);
      } catch (e) {
        console.warn(`  (no contact sheet: ${(e as Error).message.split('\n')[0]})`);
      }
    } catch (e) {
      failed = true;
      console.error(`✗ ${name}: ${(e as Error).stack}`);
    }
  }
} finally {
  await closeBrowser();
  await close();
}
process.exit(failed ? 1 : 0);
