# api-partenaires

🤝 ProConnect OIDC Providers

API permettant aux fournisseurs OIDC proches de ProConnect de modifier une partie
limitée de leur configuration de production.

## Développement

```sh
bun install
bun run dev
```

## Configuration

| Variable                                  | Défaut                               | Description                                                                                                                                                            |
| ----------------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PORT`                                    | `3000`                               | Port d'écoute                                                                                                                                                          |
| `MONGODB_URI`                             | `mongodb://127.0.0.1:27017/partners` | Connexion MongoDB (collections `provider` et `client`)                                                                                                                 |
| `OIDC_PROVIDERS_CONFIG`                   | `oidc_providers.yaml`                | Fichier YAML des uid éditables et attached_email_domains permis                                                                                                        |
| `OIDC_PROVIDERS_API_SECRET`               | _(requis)_                           | Secret partagé HMAC pour `/api/oidc_providers/*`                                                                                                                       |
| `OIDC_CLIENTS_API_SECRET`                 | _(requis)_                           | Secret partagé HMAC pour `/api/oidc_clients/*` (sandbox)                                                                                                               |
| `FEATURE_ENABLE_SANDBOX_ENDPOINT`         | `false`                              | Active l'endpoint `/api/oidc_clients` (sinon `403`)                                                                                                                    |
| `PROCONNECT_ISSUER`                       | _(aucun)_                            | Issuer de la fédération ProConnect (ex. `https://fca.integ01.dev-agentconnect.fr/api/v2`) ; `/token/introspection` et `/userinfo` sont appelés sous cette URL          |
| `PROCONNECT_CLIENT_ID`                    | _(aucun)_                            | `client_id` d'api-partenaires dans la fédération (authentification `client_secret_post` à l'introspection)                                                             |
| `PROCONNECT_CLIENT_SECRET`                | _(aucun)_                            | `client_secret` correspondant                                                                                                                                          |
| `PROCONNECT_ALLOWED_CLIENT_ID`            | _(aucun)_                            | `client_id` de l'Espace Partenaires : seuls les jetons émis pour ce client sont acceptés                                                                               |
| `CLIENT_SECRET_CIPHER_PASS`               | _(requis)_                           | Clé AES-256-GCM (32 octets) pour chiffrer `client_secret`                                                                                                              |
| `MAX_TIMESTAMP_DIFF`                      | `300`                                | Fenêtre de validité (secondes, entier de 1 à 3600) de `X-Timestamp` ; hors bornes, le service refuse de démarrer                                                       |
| `RATE_LIMIT_PER_MINUTE`                   | `60`                                 | Requêtes signées par minute et par secret (sinon `429`)                                                                                                                |
| `RATE_LIMIT_PER_MINUTE_PER_OIDC_PROVIDER` | `10`                                 | Requêtes par minute et par fournisseur `/api/oidc_providers/:uid/*` (sinon `429`)                                                                                      |
| `RATE_LIMIT_PER_MINUTE_PER_USER`          | `10`                                 | Requêtes par minute et par personne (`sub` ProConnect) authentifiée par jeton sur `/api/oidc_clients*` (sinon `429`)                                                   |
| `LOG_LEVEL`                               | `info`                               | `debug`, `info` ou `error` ; `debug` ajoute le corps des réponses en erreur, la raison des `401`/`429`, le verdict DNS par domaine et l'erreur d'un `/readyz` en `503` |

L'accès à `/api/*` est authentifié par signature HMAC-SHA256 (`X-Signature` /
`X-Timestamp`), migré depuis `pcdbapi`. Chaque surface utilise son propre
secret : `OIDC_PROVIDERS_API_SECRET` pour `/api/oidc_providers/*`,
`OIDC_CLIENTS_API_SECRET` pour `/api/oidc_clients/*`.

L'endpoint sandbox `/api/oidc_clients*` accepte deux authentifications ; la
présence de l'en-tête `Authorization` choisit laquelle :

- **Sans `Authorization`** : signature HMAC, plus le paramètre `?email=` dans
  l'URL, qui sert d'identité appelante pour le scoping par `collaborators`.
- **Avec `Authorization: Bearer <access_token>`** : le jeton d'accès
  ProConnect de la personne. La signature et `?email=` sont ignorés.
  api-partenaires introspecte le jeton auprès de la fédération (actif, émis
  pour `PROCONNECT_ALLOWED_CLIENT_ID`, de type `Bearer`, avec un `sub`), puis
  lit l'email sur `/userinfo` (JSON ou JWT signé ; un userinfo chiffré n'est
  pas pris en charge) et agit pour cet email en minuscules. Jeton refusé ou
  en-tête mal formé : `401` avec `WWW-Authenticate`, sans repli sur la
  signature. Fédération injoignable, en erreur ou au-delà de 5 s par appel :
  `503`.

Les quatre variables `PROCONNECT_*` se définissent ensemble ou pas du tout ;
sans elles, toute requête suit le chemin signé. Les journaux
`oidc_client.created|updated|deleted` indiquent l'authentification utilisée
(`auth` : `hmac` ou `token`, plus `client_id` et `sub` pour un jeton).

```yaml
# oidc_providers.yaml
oidc_providers:
  - uid: "71144ab3-ee1a-4401-b7b3-79b44f7daeeb"
    allowed_attached_email_domains:
      - moncomptepro.fr
      - polyfi.fr
```

## Routes

| Route                                                            | Auth                                  | Description                                                                                                                                                                                                                                                              |
| ---------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /livez`                                                     | _(aucune)_                            | Sonde de vie                                                                                                                                                                                                                                                             |
| `GET /readyz`                                                    | _(aucune)_                            | Sonde de disponibilité (ping mongo)                                                                                                                                                                                                                                      |
| `GET /api/oidc_providers/:uid/configuration`                     | `OIDC_PROVIDERS_API_SECRET`           | Lecture de la configuration                                                                                                                                                                                                                                              |
| `PATCH /api/oidc_providers/:uid/configuration`                   | `OIDC_PROVIDERS_API_SECRET`           | **Dépréciée, retirée après le 17 janvier 2027** (en-têtes `Deprecation` et `Sunset`) : remplace toute la liste des attached_email_domains (`{ attached_email_domains: [] }`), les nouveaux domaines (1000 max par appel) doivent résoudre via `dns.google` (MX, sinon A) |
| `GET /api/oidc_providers/:uid/attached_email_domains`            | `OIDC_PROVIDERS_API_SECRET`           | Liste des attached_email_domains (`[{ domain }]`)                                                                                                                                                                                                                        |
| `GET /api/oidc_providers/:uid/attached_email_domains/:domain`    | `OIDC_PROVIDERS_API_SECRET`           | Lecture d'un domaine rattaché (`404` s'il ne l'est pas)                                                                                                                                                                                                                  |
| `PUT /api/oidc_providers/:uid/attached_email_domains/:domain`    | `OIDC_PROVIDERS_API_SECRET`           | Rattache un domaine : `201` s'il est nouveau (autorisé, libre et résolvant via `dns.google`), `204` s'il l'était déjà                                                                                                                                                    |
| `DELETE /api/oidc_providers/:uid/attached_email_domains/:domain` | `OIDC_PROVIDERS_API_SECRET`           | Détache un domaine (`204`, `404` s'il n'était pas rattaché)                                                                                                                                                                                                              |
| `GET /api/oidc_clients`                                          | `OIDC_CLIENTS_API_SECRET`             | Liste les clients OIDC                                                                                                                                                                                                                                                   |
| `POST /api/oidc_clients`                                         | `OIDC_CLIENTS_API_SECRET` + `?email=` | Crée un client OIDC                                                                                                                                                                                                                                                      |
| `GET /api/oidc_clients/:id`                                      | `OIDC_CLIENTS_API_SECRET` + `?email=` | Lecture d'un client OIDC                                                                                                                                                                                                                                                 |
| `PATCH /api/oidc_clients/:id`                                    | `OIDC_CLIENTS_API_SECRET` + `?email=` | Mise à jour partielle d'un client OIDC                                                                                                                                                                                                                                   |
| `DELETE /api/oidc_clients/:id`                                   | `OIDC_CLIENTS_API_SECRET` + `?email=` | Suppression d'un client OIDC                                                                                                                                                                                                                                             |

## Scripts

| Script                                    | Description                                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------------------- |
| `bun run dev`                             | Serveur local (hot reload)                                                         |
| `bun test src`                            | Tests unitaires                                                                    |
| `bun run typecheck`                       | Vérification TypeScript                                                            |
| `bun run format:check`                    | Vérification du formatage                                                          |
| `bun run explain:domain <domaine\|email>` | Explique pourquoi un domaine est accepté ou refusé (liste, DILA, RPNT, fiche, nom) |

## Tests d'intégration

Chaque dossier de `examples/` est un scénario docker compose exécuté en CI
contre l'image construite. Ses services étendent (`extends`) ceux de
`examples/compose.yaml`, seul fichier où figurent les images tierces :

```sh
cd examples/edit_provider_attached_email_domains
bun test integration.test.ts
```

`examples/oidc_clients` authentifie chaque requête par un jeton d'accès
ProConnect. La fédération y est simulée par `examples/mock_proconnect.ts`
(service `proconnect` de `examples/compose.yaml`), qui reproduit les réponses
observées sur l'intégration (`fca.integ01.dev-agentconnect.fr`) :
introspection en `client_secret_post`, userinfo en JSON ou en JWT signé,
révocation. Les tests y obtiennent leurs jetons par `POST /test/access_tokens`,
sans navigateur ni accès réseau extérieur.

`examples/oidc_clients_hmac_legacy` couvre l'ancien chemin signé (HMAC et
`?email=`), à supprimer avec lui.

## Docker

L'image embarque le contenu de `config/` dans
`/etc/proconnect-gouv/api-partenaires/config` — dont les configurations de
l'ANCT par environnement,
`/etc/proconnect-gouv/api-partenaires/config/anct/oidc_providers.sandbox.yaml`
et `oidc_providers.production.yaml`. Pointer `OIDC_PROVIDERS_CONFIG` vers le
chemin correspondant à l'environnement pour l'utiliser sans montage de
volume.

```sh
docker build -t api-partenaires .
docker run -p 3000:3000 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/partners \
  -e OIDC_PROVIDERS_CONFIG=/etc/proconnect-gouv/api-partenaires/config/anct/oidc_providers.production.yaml \
  -e OIDC_PROVIDERS_API_SECRET=your-oidc-providers-secret \
  -e OIDC_CLIENTS_API_SECRET=your-oidc-clients-secret \
  -e CLIENT_SECRET_CIPHER_PASS="$(printf '0%.0s' {1..32})" \
  -e FEATURE_ENABLE_SANDBOX_ENDPOINT=true \
  api-partenaires
```
