// Копирует браузерные библиотеки из node_modules в public/vendor,
// чтобы студия работала без интернета и без npm на целевой машине.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'public', 'vendor');
mkdirSync(out, { recursive: true });

const files = [
  ['node_modules/echarts/dist/echarts.min.js', 'echarts.min.js'],
  ['node_modules/echarts/i18n/langRU.js', 'echarts-langRU.js'],
  ['node_modules/echarts/LICENSE', 'LICENSE-echarts.txt'],
  ['node_modules/xlsx/dist/xlsx.full.min.js', 'xlsx.full.min.js'],
  ['node_modules/xlsx/LICENSE', 'LICENSE-xlsx.txt'],
];

for (const [src, dst] of files) {
  const from = join(root, src);
  if (!existsSync(from)) {
    console.error(`Не найден ${src}. Выполните npm install на машине с доступом к npm.`);
    process.exit(1);
  }
  copyFileSync(from, join(out, dst));
  console.log(`✓ ${dst}`);
}
