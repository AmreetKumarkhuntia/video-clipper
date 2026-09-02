import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Architecture test enforcing the service-boundary rules from
 * docs/plans/services-refactor.md:
 *
 *  1. `src/lib/types/` is a leaf — no `@lib/*` or `@app/*` imports.
 *  2. Nothing under `src/lib/` imports `@app/*`.
 *  3. From outside a service, only its barrel (`@lib/services/<svc>/index.js`)
 *     may be imported — no deep paths, alias or relative.
 *  4. `services/`, `orchestration/`, and `pipeline/` never import `@lib/config`
 *     — config is injected by the apps.
 *  5. Cross-service imports are limited to the documented edges:
 *     `audio → video` and `* → modelFactory`.
 *  6. Within `src/lib/`, only `orchestration/` (and the public barrel
 *     `index.ts`) imports `services/db` — app code may use the db barrel.
 */

const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src');
const SERVICES_DIR = path.join(SRC, 'lib', 'services');

const ALLOWED_CROSS_SERVICE = [
  { from: 'audio', to: 'video' },
  { from: '*', to: 'modelFactory' },
];

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(ts|svelte)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function importSpecifiers(file: string): string[] {
  const text = fs.readFileSync(file, 'utf8');
  const specs: string[] = [];
  const re = /(?:from\s+|import\s*\(\s*|^\s*import\s+)['"]([^'"]+)['"]/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) specs.push(m[1]);
  return specs;
}

/** Service name if the absolute path is inside src/lib/services/<svc>, else null. */
function serviceOf(absPath: string): string | null {
  const rel = path.relative(SERVICES_DIR, absPath);
  if (rel.startsWith('..')) return null;
  return rel.split(path.sep)[0] ?? null;
}

/** Resolve a specifier to an absolute path when it points inside the repo. */
function resolveSpecifier(file: string, spec: string): string | null {
  if (spec.startsWith('@lib/')) return path.join(SRC, 'lib', spec.slice('@lib/'.length));
  if (spec.startsWith('@app/')) return path.join(SRC, 'app', spec.slice('@app/'.length));
  if (spec.startsWith('.')) return path.resolve(path.dirname(file), spec);
  return null; // external package
}

function crossServiceAllowed(from: string, to: string): boolean {
  return ALLOWED_CROSS_SERVICE.some(
    (edge) => (edge.from === '*' || edge.from === from) && edge.to === to,
  );
}

const files = walk(SRC);
const rel = (f: string) => path.relative(path.join(SRC, '..'), f);

describe('service boundaries', () => {
  it('src/lib/types is a leaf (no @lib or @app imports)', () => {
    const violations: string[] = [];
    for (const file of files) {
      if (!file.startsWith(path.join(SRC, 'lib', 'types') + path.sep)) continue;
      for (const spec of importSpecifiers(file)) {
        if (spec.startsWith('@lib/') || spec.startsWith('@app/')) {
          violations.push(`${rel(file)} -> ${spec}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('src/lib never imports from @app', () => {
    const violations: string[] = [];
    for (const file of files) {
      if (!file.startsWith(path.join(SRC, 'lib') + path.sep)) continue;
      for (const spec of importSpecifiers(file)) {
        if (spec.startsWith('@app/')) violations.push(`${rel(file)} -> ${spec}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('services are only entered through their barrel from outside', () => {
    const violations: string[] = [];
    for (const file of files) {
      const ownService = serviceOf(file);
      for (const spec of importSpecifiers(file)) {
        const resolved = resolveSpecifier(file, spec);
        if (!resolved) continue;
        const targetService = serviceOf(resolved);
        if (!targetService || targetService === ownService) continue;
        const barrel = path.join(SERVICES_DIR, targetService, 'index.js');
        if (resolved !== barrel) violations.push(`${rel(file)} -> ${spec}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('services, orchestration, and pipeline never import @lib/config', () => {
    const layers = ['services', 'orchestration', 'pipeline'].map(
      (d) => path.join(SRC, 'lib', d) + path.sep,
    );
    const violations: string[] = [];
    for (const file of files) {
      if (!layers.some((layer) => file.startsWith(layer))) continue;
      for (const spec of importSpecifiers(file)) {
        if (spec === '@lib/config' || spec.startsWith('@lib/config/')) {
          violations.push(`${rel(file)} -> ${spec}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('cross-service imports stay on the documented edges', () => {
    const violations: string[] = [];
    for (const file of files) {
      const ownService = serviceOf(file);
      if (!ownService) continue;
      for (const spec of importSpecifiers(file)) {
        const resolved = resolveSpecifier(file, spec);
        if (!resolved) continue;
        const targetService = serviceOf(resolved);
        if (!targetService || targetService === ownService) continue;
        if (!crossServiceAllowed(ownService, targetService)) {
          violations.push(`${rel(file)} (${ownService} -> ${targetService}) ${spec}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it('within src/lib, only orchestration and the public barrel import services/db', () => {
    const libDir = path.join(SRC, 'lib') + path.sep;
    const dbDir = path.join(SERVICES_DIR, 'db') + path.sep;
    const allowed = [
      path.join(SRC, 'lib', 'orchestration') + path.sep,
      path.join(SRC, 'lib', 'index.ts'),
    ];
    const violations: string[] = [];
    for (const file of files) {
      if (!file.startsWith(libDir) || file.startsWith(dbDir)) continue;
      if (allowed.some((a) => file === a || file.startsWith(a))) continue;
      for (const spec of importSpecifiers(file)) {
        const resolved = resolveSpecifier(file, spec);
        if (resolved && resolved.startsWith(dbDir)) violations.push(`${rel(file)} -> ${spec}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
