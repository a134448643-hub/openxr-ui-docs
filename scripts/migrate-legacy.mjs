import path from 'node:path';
import { migrateLegacyDocument } from '../server/project-document-store.mjs';

const source = process.argv[2];
if (!source) {
  console.error('Usage: npm run migrate -- "C:\\path\\Documentation.json"');
  process.exit(1);
}

const result = await migrateLegacyDocument(path.resolve(source));
console.log(`Migrated ${result.pages} pages and extracted ${result.assets} assets.`);
console.log(`Source preserved at: ${result.source}`);
