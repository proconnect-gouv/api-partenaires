# partners

🤝 ProConnect Partners

API permettant aux partenaires proches de ProConnect de modifier une partie
limitée de leur configuration de production.

## Développement

```sh
bun install
bun run dev
```

## Configuration

| Variable                    | Défaut                               | Description                                               |
| --------------------------- | ------------------------------------ | --------------------------------------------------------- |
| `PORT`                      | `3000`                               | Port d'écoute                                             |
| `MONGODB_URI`               | `mongodb://127.0.0.1:27017/partners` | Connexion MongoDB (collections `provider` et `client`)    |
| `PARTNERS_CONFIG_FILE`      | `partners.yaml`                      | Fichier YAML des uid éditables et fqdns permis            |
| `API_SECRET`                | _(requis)_                           | Secret partagé HMAC pour `/api/*`                         |
| `CLIENT_SECRET_CIPHER_PASS` | _(requis)_                           | Clé AES-256-GCM (32 octets) pour chiffrer `client_secret` |
| `MAX_TIMESTAMP_DIFF`        | `300`                                | Fenêtre de validité (secondes) de `X-Timestamp`           |

L'accès à `/partners/*` est restreint au niveau de l'ingress, via l'annotation
`nginx.ingress.kubernetes.io/whitelist-source-range`.

L'accès à `/api/*` est authentifié par signature HMAC-SHA256 (`X-Signature` /
`X-Timestamp` + `?email=`), migré depuis `pcdbapi`.

```yaml
# partners.yaml
partners:
  - uid: "71144ab3-ee1a-4401-b7b3-79b44f7daeeb"
    allowed_fqdns:
      - moncomptepro.fr
      - polyfi.fr
```

## Routes

| Route                                | Description                                            |
| ------------------------------------ | ------------------------------------------------------ |
| `GET /livez`                         | Sonde de vie                                           |
| `GET /readyz`                        | Sonde de disponibilité (ping mongo)                    |
| `GET /partners/:uid/configuration`   | Lecture de la configuration                            |
| `PATCH /partners/:uid/configuration` | Modification des fqdns (`{ fqdns: [] }`)               |
| `GET /api/oidc_clients`              | Liste les clients OIDC du collaborateur (`?email=`)    |
| `POST /api/oidc_clients`             | Crée un client OIDC pour le collaborateur              |
| `GET /api/oidc_clients/:id`          | Lecture d'un client OIDC (scopé au collaborateur)      |
| `PATCH /api/oidc_clients/:id`        | Mise à jour partielle d'un client OIDC                 |
| `DELETE /api/oidc_clients/:id`       | Suppression d'un client OIDC (scopée au collaborateur) |

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
docker build -t partners .
docker run -p 3000:3000 \
  -e MONGODB_URI=mongodb://host.docker.internal:27017/partners \
  -v ./partners.yaml:/partners.yaml:ro \
  -e PARTNERS_CONFIG_FILE=/partners.yaml \
  partners
```
