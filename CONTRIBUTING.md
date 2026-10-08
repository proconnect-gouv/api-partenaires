# Contribuer

## Publier une version

Le versionnage suit le _calendar versioning_ au cycle mensuel (`YYYY.MM.PATCH`) :
la première version d'un mois est `2026.10.0`, les releases du même mois
incrémentent le patch (`2026.10.1`, `2026.10.2`, …) et le compteur repart à
`0` le mois suivant (`2026.11.0`).

Les releases passent par
[`proconnect-gouv/release-action`](https://github.com/proconnect-gouv/release-action)
(workflow **🚢 Release It !**, à chaque push sur `main`) :

1. Après chaque merge sur `main`, l'action ouvre ou met à jour la pull request
   `🔖 release <version>` depuis la branche `release-it/next`. Elle met à jour
   le champ `version` de `package.json` et ajoute la section de la version en
   tête de `CHANGELOG.md` (commits groupés par gitmoji).
2. Pour publier, relire puis merger cette pull request. L'action pose alors le
   tag (sans préfixe `v`, ex. `2026.10.0`) et publie une GitHub release avec la
   section du `CHANGELOG.md` comme notes.
3. Le job de publication lance ensuite le build Docker sur le tag : l'image est
   publiée sur `ghcr.io/proconnect-gouv/api-partenaires:<version>`
   (multi-arch amd64/arm64).

Pour décrire un changement visible des utilisateurs, ajouter un fichier
Markdown dans `.release-it-changeset/` (voir la
[documentation de l'action](https://github.com/proconnect-gouv/release-action#%EF%B8%8F-changesets)).

La publication npm est désactivée : ce dépôt ne publie pas de paquet npm.
