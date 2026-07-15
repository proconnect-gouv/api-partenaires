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

| Variable               | Défaut                               | Description                                    |
| ---------------------- | ------------------------------------ | ---------------------------------------------- |
| `PORT`                 | `3000`                               | Port d'écoute                                  |
| `MONGODB_URI`          | `mongodb://127.0.0.1:27017/partners` | Connexion MongoDB (collection `providers`)     |
| `AUTHORIZED_IPS`       | `127.0.0.1`                          | IPs autorisées, séparées par des virgules      |
| `PARTNERS_CONFIG_FILE` | `partners.yaml`                      | Fichier YAML des uid éditables et fqdns permis |

```yaml
# partners.yaml
partners:
  - uid: "71144ab3-ee1a-4401-b7b3-79b44f7daeeb"
    allowed_fqdns:
      - moncomptepro.fr
      - polyfi.fr
```

## Routes

| Route                                | Description                              |
| ------------------------------------ | ---------------------------------------- |
| `GET /livez`                         | Sonde de vie                             |
| `GET /readyz`                        | Sonde de disponibilité (ping mongo)      |
| `GET /partners/:uid/configuration`   | Lecture de la configuration              |
| `PATCH /partners/:uid/configuration` | Modification des fqdns (`{ fqdns: [] }`) |

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
  -e AUTHORIZED_IPS=203.0.113.7 \
  -v ./partners.yaml:/partners.yaml:ro \
  -e PARTNERS_CONFIG_FILE=/partners.yaml \
  partners
```
