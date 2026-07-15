# partners

🤝 ProConnect Partners

API permettant aux partenaires proches de ProConnect de modifier une partie
limitée de leur configuration de production.

## Développement

```sh
bun install
bun run dev
```

## Scripts

| Script                 | Description                |
| ---------------------- | -------------------------- |
| `bun run dev`          | Serveur local (hot reload) |
| `bun test`             | Tests unitaires            |
| `bun run typecheck`    | Vérification TypeScript    |
| `bun run format:check` | Vérification du formatage  |

## Docker

```sh
docker build -t partners .
docker run -p 3000:3000 partners
```
