import { isBuiltin } from 'node:module';
import { buildCli, buildReleasePlugin } from './cliPackage.js';

const root = process.cwd();
const record = await buildCli(root);
await buildReleasePlugin(root);
console.log(
  `Built CLI from ${record.inputs.length} client modules; runtime packages: ${record.externals.filter((name: string): boolean => !isBuiltin(name)).join(', ')}`,
);
