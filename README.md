# Applications Android — My shop, CV en ligne, Devizo

Vraies applications Android (fichier APK installable, icône dans la liste des applications, écran de démarrage,
plein écran sans barre d'adresse) pour 3 plateformes. **NEXUS Market** a déjà la sienne (`sn.nexusmarket.twa`, servie par le site lui-même sur `/downloads/nexus-market.apk`) : elle n'est pas reconstruite ici, pour ne pas créer une 2ᵉ application chez ceux qui l'ont installée. Technique : **Trusted Web Activity** (méthode de Google
pour publier une application web sur Android, acceptée par le Play Store) générée avec
[Bubblewrap](https://github.com/GoogleChromeLabs/bubblewrap). L'application ouvre le site officiel dans le moteur
de Chrome : tout fonctionne comme sur le site (hors ligne, caméra, impression PDF, notifications), et chaque
amélioration du site arrive dans l'application sans mise à jour.

## Télécharger

| Application | Lien direct (dernière version) |
|---|---|
| My shop | https://github.com/elhadjidiagne002-netizen/nexus-apps/releases/latest/download/myshop.apk |
| CV en ligne | https://github.com/elhadjidiagne002-netizen/nexus-apps/releases/latest/download/cv-en-ligne.apk |
| Devizo | https://github.com/elhadjidiagne002-netizen/nexus-apps/releases/latest/download/devizo.apk |

Chaque site affiche un bouton « Télécharger l'application Android » qui pointe vers ces liens.

## Comment ça marche

- `apps/apps.json` : nom, adresse, couleurs, icônes et raccourcis de chaque application.
- `scripts/build.mjs` : génère le projet Android (Bubblewrap), le compile (Gradle), l'aligne et le signe.
- `.github/workflows/android.yml` : à chaque modification sur `main` (ou « Run workflow »), GitHub construit les
  3 APK et publie une nouvelle version dans *Releases*. Le numéro de version suit le numéro du run.
- **Lien de confiance** : chaque site publie `/.well-known/assetlinks.json` avec l'empreinte de la clé de signature.
  Sans ce fichier, Android afficherait une barre d'adresse en haut de l'application.

Empreinte SHA-256 de la clé de signature (à mettre dans `assetlinks.json` des 3 sites) :

```
FB:1F:0C:50:A1:11:FF:67:D0:EB:28:41:21:24:56:26:55:D7:2D:76:28:B3:29:72:8D:34:3A:02:9C:93:FF:A2
```

## Clé de signature (à garder précieusement)

La clé (`nexus-apps.keystore`, alias `nexus`) n'est **jamais** dans ce dépôt. Elle est fournie à GitHub par deux
secrets du dépôt : `ANDROID_KEYSTORE_BASE64` (le fichier encodé en base64) et `ANDROID_KEYSTORE_PASSWORD`.
Gardez-en une copie hors ligne : **si elle est perdue, les téléphones refuseront toute mise à jour** et il faudra
désinstaller puis réinstaller les applications.

## iPhone (plus tard)

Apple n'autorise pas l'installation d'une application téléchargée depuis un site : il faut un compte Apple Developer
(99 $/an) et la publication sur l'App Store (ou TestFlight). En attendant, sur iPhone, les sites s'ajoutent à
l'écran d'accueil depuis Safari (Partager → « Sur l'écran d'accueil »).

## Play Store (plus tard)

Les mêmes projets se publient sur le Play Store (compte Google Play Console, 25 $ une fois) : il suffira d'ajouter
la construction d'un fichier `.aab` et l'empreinte de la clé de Google Play dans `assetlinks.json`.
