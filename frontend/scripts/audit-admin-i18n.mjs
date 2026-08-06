import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const sourceRoots = [join(root, 'src/app/admin'), join(root, 'src/components/admin')];
const zhPath = join(root, 'src/components/admin/messages/zh-CN.ts');
const esPath = join(root, 'src/components/admin/messages/es-CL.ts');

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (path.includes(`${join('components', 'admin', 'messages')}`)) return [];
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.[jt]sx?$/.test(name) ? [path] : [];
  });
}

function catalogKeys(path) {
  const source = readFileSync(path, 'utf8');
  return new Set([...source.matchAll(/^\s*'([^']+)'\s*:/gm)].map((match) => match[1]));
}

function catalogEntries(path) {
  const source = readFileSync(path, 'utf8');
  return [...source.matchAll(/^\s*'([^']+)'\s*:\s*'((?:\\'|[^'])*)'/gm)].map((match) => [match[1], match[2]]);
}

const files = sourceRoots.flatMap(sourceFiles);
const violations = [];
let translatedUsages = 0;
let hardcodedRuns = 0;

for (const file of files) {
  const source = readFileSync(file, 'utf8');
  translatedUsages += [...source.matchAll(/\bt\s*\(/g)].length;
  source.split(/\r?\n/).forEach((line, index) => {
    const matches = [...line.matchAll(/[\u3400-\u9fff]+/g)];
    hardcodedRuns += matches.length;
    if (matches.length) violations.push(`${relative(root, file)}:${index + 1}: ${matches.map((match) => match[0]).join(', ')}`);
  });
}

const zhKeys = catalogKeys(zhPath);
const esKeys = catalogKeys(esPath);
const missingSpanish = [...zhKeys].filter((key) => !esKeys.has(key));
const extraSpanish = [...esKeys].filter((key) => !zhKeys.has(key));
const spanishHanViolations = catalogEntries(esPath).filter(([key, value]) => key !== 'language.zh-CN' && /[\u3400-\u9fff]/.test(value));
const coverage = translatedUsages + hardcodedRuns === 0 ? 100 : translatedUsages * 100 / (translatedUsages + hardcodedRuns);

console.log(`Admin i18n coverage: ${coverage.toFixed(2)}% (${translatedUsages} translated usages, ${hardcodedRuns} hardcoded Chinese runs)`);
console.log(`Catalog parity: zh-CN=${zhKeys.size}, es-CL=${esKeys.size}`);

if (violations.length) console.error(`Hardcoded Chinese outside catalogs:\n${violations.join('\n')}`);
if (missingSpanish.length) console.error(`Missing es-CL keys: ${missingSpanish.join(', ')}`);
if (extraSpanish.length) console.error(`Unexpected es-CL keys: ${extraSpanish.join(', ')}`);
if (spanishHanViolations.length) console.error(`Chinese text in es-CL catalog: ${spanishHanViolations.map(([key]) => key).join(', ')}`);

if (coverage < 99 || violations.length || missingSpanish.length || extraSpanish.length || spanishHanViolations.length) process.exit(1);
