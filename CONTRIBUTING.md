# Contribuer

## Développement

```sh
bun install
bun run dev
```

Le serveur exige les variables listées dans le [README](README.md#configuration)
(`OIDC_PROVIDERS_API_SECRET`, `OIDC_CLIENTS_API_SECRET`,
`CLIENT_SECRET_CIPHER_PASS` — 32 caractères exactement — et le fichier
`oidc_providers.yaml`) : il refuse de démarrer sans elles.

## Scripts

| Script                    | Description                         |
| ------------------------- | ----------------------------------- |
| `bun run dev`             | Serveur local (hot reload)          |
| `bun test src`            | Tests unitaires                     |
| `bun run typecheck`       | Vérification TypeScript             |
| `bun run format`          | Formatage (Prettier)                |
| `bun run format:check`    | Vérification du formatage           |
| `bun run lint`            | Formatage + TypeScript              |
| `bun run lint:config`     | Validation de la configuration      |
| `bun run lint:apotropaic` | Garde-fou sur la configuration      |
| `bun run release`         | Publier une version (voir plus bas) |

## Tests d'intégration

Chaque dossier de `examples/` est un scénario docker compose exécuté en CI
contre l'image construite :

```sh
cd examples/edit_provider_attached_email_domains
bun test integration.test.ts
```

## Docker

Construire l'image localement :

```sh
docker build -t api-partenaires .
```

Pour lancer le service, voir la section [Docker](README.md#docker) du README.

En CI, chaque push sur `main` publie l'image sur
`ghcr.io/proconnect-gouv/api-partenaires` (tags `main`, `sha-<sha>`, `latest`),
et chaque tag de version ajoute le tag `<version>` correspondant.

## Publier une version

Le versionnage suit le _calendar versioning_ au cycle mensuel (`YYYY.MM.PATCH`) :
la première version d'un mois est `2026.10.0`, les releases du même mois
incrémentent le patch (`2026.10.1`, `2026.10.2`, …) et le compteur repart à
`0` le mois suivant (`2026.11.0`).

Deux façons de déclencher une release :

1. **En local**, depuis `main` à jour et un répertoire de travail propre :

   ```sh
   bun run release
   ```

2. **Depuis GitHub** : workflow **🚢 Release It !** (`workflow_dispatch`),
   à lancer sur `main`.

Dans les deux cas, release-it :

- met à jour le champ `version` de `package.json` ;
- crée le commit `:bookmark: release <version>` ;
- pose le tag sur la version (sans préfixe `v`, ex. `2026.10.0`) et le pousse
  (`--follow-tags`) ;
- publie une GitHub release avec les notes de version.

Le push du tag déclenche le build Docker : l'image est publiée sur
`ghcr.io/proconnect-gouv/api-partenaires:<version>` (multi-arch amd64/arm64).

La publication npm est désactivée : ce dépôt ne publie pas de paquet npm.
