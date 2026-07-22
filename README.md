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

| Variable                          | Défaut                               | Description                                               |
| --------------------------------- | ------------------------------------ | --------------------------------------------------------- |
| `PORT`                            | `3000`                               | Port d'écoute                                             |
| `MONGODB_URI`                     | `mongodb://127.0.0.1:27017/partners` | Connexion MongoDB (collections `provider` et `client`)    |
| `OIDC_PROVIDERS_CONFIG_FILE`      | `oidc_providers.yaml`                | Fichier YAML des uid éditables et fqdns permis            |
| `OIDC_PROVIDERS_API_SECRET`       | _(requis)_                           | Secret partagé HMAC pour `/api/oidc_providers/*`          |
| `SANDBOX_API_SECRET`              | _(requis)_                           | Secret partagé HMAC pour `/api/oidc_clients/*` (sandbox)  |
| `FEATURE_ENABLE_SANDBOX_ENDPOINT` | `false`                              | Active l'endpoint `/api/oidc_clients` (sinon `403`)       |
| `CLIENT_SECRET_CIPHER_PASS`       | _(requis)_                           | Clé AES-256-GCM (32 octets) pour chiffrer `client_secret` |
| `MAX_TIMESTAMP_DIFF`              | `300`                                | Fenêtre de validité (secondes) de `X-Timestamp`           |

L'accès à `/api/*` est authentifié par signature HMAC-SHA256 (`X-Signature` /
`X-Timestamp`), migré depuis `pcdbapi`. Chaque surface utilise son propre
secret : `OIDC_PROVIDERS_API_SECRET` pour `/api/oidc_providers/*`,
`SANDBOX_API_SECRET` pour `/api/oidc_clients/*`.

L'endpoint sandbox `/api/oidc_clients*` exige en plus le paramètre `?email=`
dans l'URL — il sert d'identité appelante pour le scoping par `collaborators`.

```yaml
# oidc_providers.yaml
oidc_providers:
  - uid: "71144ab3-ee1a-4401-b7b3-79b44f7daeeb"
    allowed_fqdns:
      - moncomptepro.fr
      - polyfi.fr
```

## Routes

| Route                                          | Auth                             | Description                              |
| ---------------------------------------------- | -------------------------------- | ---------------------------------------- |
| `GET /livez`                                   | _(aucune)_                       | Sonde de vie                             |
| `GET /readyz`                                  | _(aucune)_                       | Sonde de disponibilité (ping mongo)      |
| `GET /api/oidc_providers/:uid/configuration`   | `OIDC_PROVIDERS_API_SECRET`      | Lecture de la configuration              |
| `PATCH /api/oidc_providers/:uid/configuration` | `OIDC_PROVIDERS_API_SECRET`      | Modification des fqdns (`{ fqdns: [] }`) |
| `GET /api/oidc_clients`                        | `SANDBOX_API_SECRET`             | Liste les clients OIDC                   |
| `POST /api/oidc_clients`                       | `SANDBOX_API_SECRET` + `?email=` | Crée un client OIDC                      |
| `GET /api/oidc_clients/:id`                    | `SANDBOX_API_SECRET` + `?email=` | Lecture d'un client OIDC                 |
| `PATCH /api/oidc_clients/:id`                  | `SANDBOX_API_SECRET` + `?email=` | Mise à jour partielle d'un client OIDC   |
| `DELETE /api/oidc_clients/:id`                 | `SANDBOX_API_SECRET` + `?email=` | Suppression d'un client OIDC             |

## Scripts

| Script                 | Description                |
| ---------------------- | -------------------------- |
| `bun run dev`          | Serveur local (hot reload) |
| `bun test src`         | Tests unitaires            |
| `bun run typecheck`    | Vérification TypeScript    |
| `bun run format:check` | Vérification du formatage  |

## Tests d'intégration

Chaque dossier de `examples/` est un scénario docker compose exécuté en CI
contre l'image construite :

```sh
cd examples/edit_provider_fqdns
bun test integration.test.ts
```

## Docker

```sh
docker build -t api-partenaires .
docker run -p 3000:3000 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/partners \
  -v ./oidc_providers.yaml:/oidc_providers.yaml:ro \
  -e OIDC_PROVIDERS_CONFIG_FILE=/oidc_providers.yaml \
  -e OIDC_PROVIDERS_API_SECRET=your-oidc-providers-secret \
  -e SANDBOX_API_SECRET=your-sandbox-secret \
  -e CLIENT_SECRET_CIPHER_PASS="$(printf '0%.0s' {1..32})" \
  -e FEATURE_ENABLE_SANDBOX_ENDPOINT=true \
  api-partenaires
```
