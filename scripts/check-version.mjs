import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
assert.match(pkg.version, /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/, 'Use MAYOR.MENOR.PARCHE sin ceros iniciales');
assert.equal(lock.version, pkg.version, 'La versión raíz del lockfile debe coincidir');
assert.equal(lock.packages[''].version, pkg.version, 'La versión del paquete raíz debe coincidir');
const changelog = readFileSync('CHANGELOG.md', 'utf8');
assert.ok(changelog.split(/\r?\n/).some((line) => line.startsWith(`## [${pkg.version}] - `)), 'Falta la entrada de la versión en CHANGELOG.md');
console.log(`Versionamiento coherente: ${pkg.version}`);
