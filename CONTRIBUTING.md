# Contribuer

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
