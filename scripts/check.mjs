// Vérifie apps/apps.json (identifiants, adresses, couleurs) sans rien télécharger.
import { readFileSync } from 'node:fs';
const apps = JSON.parse(readFileSync(new URL('../apps/apps.json', import.meta.url), 'utf8'));
const errors = [];
const ids = new Set();
for (const a of apps) {
  if (ids.has(a.id)) errors.push(`id en double : ${a.id}`);
  ids.add(a.id);
  if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){2,}$/.test(a.packageId)) errors.push(`${a.id} : packageId invalide`);
  if (!/^[a-z0-9.-]+$/.test(a.host)) errors.push(`${a.id} : host invalide`);
  if (!a.startUrl?.startsWith('/')) errors.push(`${a.id} : startUrl doit commencer par /`);
  for (const k of ['themeColor', 'backgroundColor']) if (!/^#[0-9a-f]{6}$/i.test(a[k] || '')) errors.push(`${a.id} : ${k} invalide`);
  for (const k of ['iconUrl', 'maskableIconUrl']) if (a[k] && !a[k].startsWith(`https://${a.host}/`)) errors.push(`${a.id} : ${k} hors du site`);
}
if (errors.length) { console.error(errors.join('\n')); process.exit(1); }
console.log(`${apps.length} applications valides : ${apps.map((a) => a.id).join(', ')}`);
