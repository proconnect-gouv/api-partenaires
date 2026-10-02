# api-partenaires

🤝 ProConnect OIDC Providers

API permettant aux fournisseurs OIDC proches de ProConnect de modifier une partie
limitée de leur configuration de production.

## Démarrage

Le service nécessite une MongoDB accessible (collections `provider` et
`client`) — variable `MONGODB_URI`. L'image embarque les configurations de
l'ANCT par environnement dans
`/etc/proconnect-gouv/api-partenaires/config` :
`anct/oidc_providers.sandbox.yaml` et `anct/oidc_providers.production.yaml`,
pointées par `OIDC_PROVIDERS_CONFIG` sans montage de volume.

```sh
docker run -p 3000:3000 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/partners \
  -e OIDC_PROVIDERS_CONFIG=/etc/proconnect-gouv/api-partenaires/config/anct/oidc_providers.production.yaml \
  -e OIDC_PROVIDERS_API_SECRET=your-oidc-providers-secret \
  -e OIDC_CLIENTS_API_SECRET=your-oidc-clients-secret \
  -e CLIENT_SECRET_CIPHER_PASS="$(printf '0%.0s' {1..32})" \
  -e FEATURE_ENABLE_SANDBOX_ENDPOINT=true \
  ghcr.io/proconnect-gouv/api-partenaires:latest
```

## Configuration

| Variable                          | Défaut                               | Description                                                     |
| --------------------------------- | ------------------------------------ | --------------------------------------------------------------- |
| `PORT`                            | `3000`                               | Port d'écoute                                                   |
| `MONGODB_URI`                     | `mongodb://127.0.0.1:27017/partners` | Connexion MongoDB (collections `provider` et `client`)          |
| `OIDC_PROVIDERS_CONFIG`           | `oidc_providers.yaml`                | Fichier YAML des uid éditables et attached_email_domains permis |
| `OIDC_PROVIDERS_API_SECRET`       | _(requis)_                           | Secret partagé HMAC pour `/api/oidc_providers/*`                |
| `OIDC_CLIENTS_API_SECRET`         | _(requis)_                           | Secret partagé HMAC pour `/api/oidc_clients/*` (sandbox)        |
| `FEATURE_ENABLE_SANDBOX_ENDPOINT` | `false`                              | Active l'endpoint `/api/oidc_clients` (sinon `403`)             |
| `CLIENT_SECRET_CIPHER_PASS`       | _(requis)_                           | Clé AES-256-GCM (32 octets) pour chiffrer `client_secret`       |
| `MAX_TIMESTAMP_DIFF`              | `300`                                | Fenêtre de validité (secondes) de `X-Timestamp`                 |

L'accès à `/api/*` est authentifié par signature HMAC-SHA256 (`X-Signature` /
`X-Timestamp`), migré depuis `pcdbapi`. Chaque surface utilise son propre
secret : `OIDC_PROVIDERS_API_SECRET` pour `/api/oidc_providers/*`,
`OIDC_CLIENTS_API_SECRET` pour `/api/oidc_clients/*`.

L'endpoint sandbox `/api/oidc_clients*` exige en plus le paramètre `?email=`
dans l'URL — il sert d'identité appelante pour le scoping par `collaborators`.

Chaque requête vers `/api/*` doit porter une signature HMAC-SHA256 hexadécimale
dans `X-Signature`, calculée sur le message
`<timestamp>:<METHOD>:<pathname>?<query>[:<body>]` — le corps n'est inclus que
pour `POST`/`PATCH`/`PUT` non vides — avec `<timestamp>` en secondes posé dans
`X-Timestamp` :

```sh
timestamp=$(date +%s)
message="$timestamp:GET:/api/oidc_providers/uid/configuration?"
signature=$(printf '%s' "$message" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print $NF}')
curl -H "X-Timestamp: $timestamp" -H "X-Signature: $signature" \
  "http://127.0.0.1:3000/api/oidc_providers/uid/configuration"
```

```yaml
# oidc_providers.yaml
oidc_providers:
  - uid: "71144ab3-ee1a-4401-b7b3-79b44f7daeeb"
    allowed_attached_email_domains:
      - moncomptepro.fr
      - polyfi.fr
```

## Routes

| Route                                          | Auth                                  | Description                                                                |
| ---------------------------------------------- | ------------------------------------- | -------------------------------------------------------------------------- |
| `GET /livez`                                   | _(aucune)_                            | Sonde de vie                                                               |
| `GET /readyz`                                  | _(aucune)_                            | Sonde de disponibilité (ping mongo)                                        |
| `GET /api/oidc_providers/:uid/configuration`   | `OIDC_PROVIDERS_API_SECRET`           | Lecture de la configuration                                                |
| `PATCH /api/oidc_providers/:uid/configuration` | `OIDC_PROVIDERS_API_SECRET`           | Modification des attached_email_domains (`{ attached_email_domains: [] }`) |
| `GET /api/oidc_clients`                        | `OIDC_CLIENTS_API_SECRET`             | Liste les clients OIDC                                                     |
| `POST /api/oidc_clients`                       | `OIDC_CLIENTS_API_SECRET` + `?email=` | Crée un client OIDC                                                        |
| `GET /api/oidc_clients/:id`                    | `OIDC_CLIENTS_API_SECRET` + `?email=` | Lecture d'un client OIDC                                                   |
| `PATCH /api/oidc_clients/:id`                  | `OIDC_CLIENTS_API_SECRET` + `?email=` | Mise à jour partielle d'un client OIDC                                     |
| `DELETE /api/oidc_clients/:id`                 | `OIDC_CLIENTS_API_SECRET` + `?email=` | Suppression d'un client OIDC                                               |

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md) : développement, tests, build Docker,
publication des versions.
