/**
 * Copy prebuilt docx IIFE bundle into vendor/.
 * npm run build:word-export
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'node_modules', 'docx', 'dist', 'index.iife.js');
const dest = path.join(root, 'vendor', 'docx-bundle.js');

if (!fs.existsSync(src)) {
    console.error('docx IIFE not found. Run: npm install docx');
    process.exit(1);
}

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.copyFileSync(src, dest);
console.log('Copied vendor/docx-bundle.js');
