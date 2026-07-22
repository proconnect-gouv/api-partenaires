# OIDC clients (migration pcdbapi)

Scénario nominal de `/api/oidc_clients*` contre l'image construite depuis la
racine du dépôt, avec un accent particulier sur le point de compatibilité le
plus risqué de la migration : déchiffrer un `client_secret` déjà chiffré par
pcdbapi lui-même.

## Topologie

```
machine hôte (le test bun, signe les requêtes en HMAC-SHA256)
    │  fetch
    ▼
127.0.0.1:3000 ──► partners ──► mongo:8.2.11
                      ▲             ▲
 oidc_providers.yaml ──┘             └ initdb.d/client.js (seed)
```

- `initdb.d/client.js` seed un document `client` dont le `client_secret` est
  la valeur chiffrée **exacte** utilisée par le fixture de test de pcdbapi
  (`federation/pcdbapi/test_crypt.py`) — pas une valeur régénérée par ce
  code TypeScript.
- `CLIENT_SECRET_CIPHER_PASS` dans `compose.yaml` est la même clé que celle
  du fixture pcdbapi, pour que le déchiffrement soit vérifiable de bout en
  bout à travers le vrai binaire compilé.
- `oidc_providers.yaml` est vide : ce scénario ne couvre pas `/api/oidc_providers/*`, déjà
  couvert par `examples/edit_provider_fqdns`.

## Ce que chaque test prouve

| Test                                           | Preuve                                                                                                                                                   |
| ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| livez et readyz répondent 200                  | le binaire compilé démarre avec les nouvelles variables d'env requises (`API_SECRET`, …)                                                                 |
| refuse une requête sans signature              | le middleware HMAC est bien monté sur `/api/*` dans le vrai serveur                                                                                      |
| déchiffre un client_secret chiffré par pcdbapi | **le point de compatibilité le plus risqué** : AES-256-GCM produit par pcdbapi (Python) se déchiffre correctement via `node:crypto` dans le binaire réel |
| un autre email n'a pas accès                   | le scoping par `collaborators` s'appuie sur une vraie requête Mongo, pas un fake                                                                         |
| cycle de vie complet (create/get/patch/delete) | le vrai driver Mongo persiste l'`ObjectId`, les updates et les suppressions correctement                                                                 |

La logique de branchement (validations de champs, formats d'email, timestamps
expirés…) vit dans les tests unitaires de `src/` ; ce scénario ne teste que ce
que la vraie pile — image, mongo, chiffrement cross-langage — peut prouver.

```sh
bun test integration.test.ts
```
