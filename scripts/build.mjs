// Construit les applications Android (Trusted Web Activity) décrites dans apps/apps.json.
//
//   node scripts/build.mjs                 génère, compile et signe les 4 APK dans dist/
//   node scripts/build.mjs --generate-only génère seulement les projets Android (vérification)
//   node scripts/build.mjs myshop          une seule application
//
// Signature : clé de la plateforme fournie par les secrets ANDROID_KEYSTORE_BASE64 et ANDROID_KEYSTORE_PASSWORD
// (alias « nexus »). Sans eux, une clé jetable signe les APK de test : ils s'installent, mais NE DOIVENT PAS être
// publiés (une mise à jour signée par la vraie clé serait refusée par le téléphone).
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, copyFileSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import core from '@bubblewrap/core';

const { TwaManifest, TwaGenerator, ConsoleLog } = core;
const root = resolve(new URL('..', import.meta.url).pathname);
const apps = JSON.parse(readFileSync(join(root, 'apps/apps.json'), 'utf8'));
const args = process.argv.slice(2);
const generateOnly = args.includes('--generate-only');
const only = args.filter((a) => !a.startsWith('--'));
const runNumber = Number(process.env.GITHUB_RUN_NUMBER || 1);
const versionName = process.env.APP_VERSION_NAME || `1.0.${runNumber}`;
// Pour les essais hors ligne : remplace l'origine des icônes (ex. http://localhost:9000/myshop).
const iconBase = process.env.ICON_BASE || '';

const log = new ConsoleLog('nexus-apps');
const sh = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { stdio: 'inherit', ...opts });

function manifestFor(app) {
  const icon = (url) => (iconBase ? `${iconBase}/${app.id}/${url.split('/').pop()}` : url);
  return new TwaManifest({
    packageId: app.packageId,
    host: app.host,
    name: app.name,
    launcherName: app.launcherName,
    display: 'standalone',
    themeColor: app.themeColor,
    navigationColor: app.themeColor,
    backgroundColor: app.backgroundColor,
    enableNotifications: true,
    startUrl: app.startUrl,
    iconUrl: icon(app.iconUrl),
    maskableIconUrl: app.maskableIconUrl ? icon(app.maskableIconUrl) : undefined,
    splashScreenFadeOutDuration: 300,
    signingKey: { path: './android.keystore', alias: 'nexus' },
    appVersionCode: runNumber,
    appVersion: versionName,
    shortcuts: (app.shortcuts || []).map((s) => ({ ...s, chosenIconUrl: icon(app.iconUrl) })),
    generatorApp: 'nexus-apps',
    webManifestUrl: iconBase ? undefined : app.webManifestUrl, // essais hors ligne : pas de téléchargement
    fallbackType: 'customtabs',
    enableSiteSettingsShortcut: false,
    orientation: app.orientation || 'default',
    minSdkVersion: 21,
  });
}

/** Outils de signature du SDK Android (dernière version installée de build-tools). */
function buildTools() {
  const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT;
  if (!sdk) throw new Error('ANDROID_HOME manquant : le SDK Android est nécessaire pour compiler.');
  const dir = join(sdk, 'build-tools');
  const versions = readdirSync(dir).filter((v) => /^\d/.test(v)).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  if (!versions.length) throw new Error('Aucun build-tools dans le SDK Android.');
  const bt = join(dir, versions.at(-1));
  return { zipalign: join(bt, 'zipalign'), apksigner: join(bt, 'apksigner') };
}

/** Clé de signature : celle de la plateforme (secrets) ou, à défaut, une clé jetable pour les essais. */
function signingKey(work) {
  const path = join(work, 'signing.keystore');
  if (process.env.ANDROID_KEYSTORE_BASE64 && process.env.ANDROID_KEYSTORE_PASSWORD) {
    // Tolère les espaces, retours à la ligne et guillemets laissés par un copier-coller.
    const text = process.env.ANDROID_KEYSTORE_BASE64.replace(/\s+/g, '').replace(/^["']|["']$/g, '');
    const password = process.env.ANDROID_KEYSTORE_PASSWORD.trim();
    const bytes = Buffer.from(text, 'base64');
    // Une clé PKCS12 commence par une séquence DER (octet 0x30) et pèse quelques Ko.
    if (!/^[A-Za-z0-9+/]+=*$/.test(text) || bytes[0] !== 0x30 || bytes.length < 1000) {
      throw new Error(`Le secret ANDROID_KEYSTORE_BASE64 ne contient pas la clé attendue : ${text.length} caractères `
        + `(attendu : environ 3 552, tout le contenu du fichier nexus-apps.keystore.base64), ${bytes.length} octets une fois décodé `
        + `(attendu : 2 662). Recopiez le contenu du fichier .base64 (pas le fichier .keystore ni le mot de passe).`);
    }
    writeFileSync(path, bytes);
    try {
      const out = execFileSync('keytool', ['-list', '-v', '-keystore', path, '-storepass', password, '-alias', 'nexus'], { encoding: 'utf8' });
      console.log('Clé de signature : ' + (out.match(/SHA256:\s*([0-9A-F:]+)/) || [])[1]);
    } catch {
      throw new Error('Le mot de passe du secret ANDROID_KEYSTORE_PASSWORD ne correspond pas à la clé (contenu de mot-de-passe.txt attendu).');
    }
    return { path, password, official: true };
  }
  const password = 'essai-non-publiable';
  if (!existsSync(path)) {
    sh('keytool', ['-genkeypair', '-keystore', path, '-alias', 'nexus', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '30',
      '-storepass', password, '-keypass', password, '-dname', 'CN=Essai, O=NEXUS, C=SN'], { stdio: 'ignore' });
  }
  console.warn('⚠ Secrets de signature absents : APK signés avec une clé d’ESSAI (à ne pas publier).');
  return { path, password, official: false };
}

const work = join(root, 'build');
const dist = join(root, 'dist');
mkdirSync(work, { recursive: true });
mkdirSync(dist, { recursive: true });
const key = generateOnly ? null : signingKey(work);
const tools = generateOnly ? null : buildTools();
const report = [];

for (const app of apps.filter((a) => !only.length || only.includes(a.id))) {
  console.log(`\n━━ ${app.launcherName} (${app.packageId}) — version ${versionName} (${runNumber})`);
  const dir = join(work, app.id);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  await new TwaGenerator().createTwaProject(dir, manifestFor(app), log);
  if (generateOnly) { report.push({ id: app.id, generated: true }); continue; }

  sh(join(dir, 'gradlew'), ['assembleRelease', '--no-daemon', '--stacktrace'], { cwd: dir });
  const unsigned = join(dir, 'app/build/outputs/apk/release/app-release-unsigned.apk');
  const aligned = join(dir, 'aligned.apk');
  const out = join(dist, `${app.id}.apk`);
  sh(tools.zipalign, ['-p', '-f', '4', unsigned, aligned]);
  sh(tools.apksigner, ['sign', '--ks', key.path, '--ks-key-alias', 'nexus', '--ks-pass', `pass:${key.password}`, '--key-pass', `pass:${key.password}`, '--out', out, aligned]);
  sh(tools.apksigner, ['verify', '--print-certs', out]);
  const bytes = readFileSync(out);
  report.push({ id: app.id, name: app.launcherName, packageId: app.packageId, file: `${app.id}.apk`, versionName, versionCode: runNumber,
    size: statSync(out).size, sha256: createHash('sha256').update(bytes).digest('hex'), officialKey: key.official });
}

writeFileSync(join(dist, 'versions.json'), JSON.stringify({ built_at: new Date().toISOString(), apps: report }, null, 2));
console.log('\n' + JSON.stringify(report, null, 2));
if (key && !key.official) copyFileSync(join(dist, 'versions.json'), join(dist, 'ESSAI-NE-PAS-PUBLIER.json'));
