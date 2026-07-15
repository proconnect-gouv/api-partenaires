# Edit provider fqdns

Scénario nominal de l'API contre l'image construite depuis la racine du
dépôt : lecture puis modification des fqdns d'un fournisseur, dans les
limites posées par le fichier YAML.

## Topologie

```
machine hôte (le test bun)
    │  fetch avec X-Forwarded-For: 10.0.0.42 (l'IP autorisée par l'env)
    ▼
127.0.0.1:3000 ──► partners ──► mongo:8.2.11
                      ▲             ▲
        partners.yaml ┘             └ initdb.d/providers.js (seed)
```

- `initdb.d/providers.js` seed deux fournisseurs : `moncomptepro`
  (`71144ab3-…`) et `intruder` (`e2d5f1c0-…`), volontairement **absent** de
  `partners.yaml`.
- `partners.yaml` (monté dans le conteneur) n'autorise l'édition que de
  `moncomptepro`, pour les domaines `moncomptepro.fr`, `polyfi.fr`,
  `fifi.fr`.
- Ici l'application est publiée directement (pas de proxy) : le test pose
  lui-même `X-Forwarded-For` — voir `reverse_proxy_ip_allowlist` pour le
  déploiement réel de la garde IP.

## Ce que chaque test prouve

| Test                                | Preuve                                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------------- |
| livez et readyz répondent 200       | le binaire compilé démarre et le ping mongo passe à travers le vrai driver                   |
| refuse une IP non autorisée         | la garde IP est active sur `/partners/*` (403 sans en-tête accepté)                          |
| retourne la configuration seedée    | `docker-entrypoint-initdb.d` a bien peuplé la collection `providers`                         |
| retourne 404 pour un uid inconnu    | un `findOne` réel qui ne trouve rien                                                         |
| refuse … un provider absent du YAML | c'est le **fichier monté** qui pilote l'allowlist : `intruder` existe en base mais reste 403 |
| refuse un domaine hors liste        | `evil.fr` → 422, la validation s'appuie sur les `allowed_fqdns` du YAML                      |
| ajoute fifi.fr aux fqdns autorisés  | le PATCH nominal écrit en base et renvoie le document mis à jour                             |
| reflète la modification persistée   | un GET relit `fifi.fr` depuis mongo : l'écriture a bien traversé le driver                   |

La logique de branchement (validations, spoof de l'en-tête, corps
malformés…) vit dans les tests unitaires de `src/` ; ce scénario ne teste
que ce que la vraie pile — image, mongo, YAML monté — peut prouver.

```sh
bun test integration.test.ts
```
