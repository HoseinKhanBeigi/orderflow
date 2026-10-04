import * as esbuild from 'esbuild';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function buildClient(watch = false): Promise<void> {
  const options: esbuild.BuildOptions = {
    absWorkingDir: root,
    entryPoints: {
      'client.bundle': join(root, 'src/client/browser-hub.ts'),
    },
    outdir: join(root, 'public'),
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2022',
    sourcemap: true,
    logLevel: 'warning',
    define: {
      'process.env.NODE_ENV': '"production"',
      'process.env.EXCHANGES': '"binance"',
      'process.env.SPOT_EXCHANGES': '"binance"',
      'process.env.DATABASE_URL': '""',
      'process.env.SYMBOLS': '""',
    },
    alias: {
      ws: join(root, 'src/client/browser-ws.ts'),
    },
    banner: {
      js: 'var process = globalThis.process || { env: {} };',
    },
  };

  if (watch) {
    const ctx = await esbuild.context(options);
    await ctx.watch();
    return;
  }
  await esbuild.build(options);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await buildClient(process.argv.includes('--watch'));
}
