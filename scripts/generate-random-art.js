import fs from 'fs';
import path from 'path';

const artDir = path.resolve('public/assets/team-art/random');
const outFile = path.resolve('src/offseasonArtManifest.json');

const files = fs.existsSync(artDir)
  ? fs.readdirSync(artDir).filter((f) => /\.(png|jpe?g)$/i.test(f))
  : [];

const urls = files.map((f) => `/assets/team-art/random/${f}`);
fs.writeFileSync(outFile, JSON.stringify(urls, null, 2));
console.log(`[art-manifest] wrote ${urls.length} files to ${outFile}`);