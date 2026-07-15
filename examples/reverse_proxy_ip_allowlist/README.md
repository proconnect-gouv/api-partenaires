# Reverse proxy IP allowlist

Contrat de déploiement exécutable pour `AUTHORIZED_IPS` : la garde IP lit le
premier saut de `X-Forwarded-For`, un en-tête que n'importe quel client peut
écrire. Elle ne vaut donc que si les deux conditions vérifiées ici tiennent.

1. **L'application n'est pas exposée directement** — aucun port publié sur
   `partners`, seul le proxy la joint.
2. **Le proxy pose `X-Forwarded-For` lui-même** — `proxy_set_header
X-Forwarded-For $remote_addr`, jamais `$proxy_add_x_forwarded_for` : un
   proxy qui ajoute (au lieu de remplacer) laisse la première valeur sous le
   contrôle du client et annule la garde.

## Topologie

Trois acteurs sur un sous-réseau fixé (`172.28.0.0/24`, choisi pour rendre
les adresses déterministes) :

```
machine hôte (le test bun)
    │  vue du réseau docker comme 172.28.0.1 (la gateway) → seule IP autorisée
    ▼
127.0.0.1:8080 ──► proxy (nginx) ──► partners:3000 ──► mongo
                        ▲              (aucun port publié)
attacker (172.28.0.66) ─┘  curl parqué sur une IP non autorisée
```

Quoi que le client envoie, nginx réécrit `X-Forwarded-For` avec l'adresse
TCP source qu'il observe. `AUTHORIZED_IPS=172.28.0.1` signifie donc « les
requêtes venant de l'hôte ».

## Ce que chaque test prouve

| Test                                | Preuve                                                                                                      |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| l'application n'est pas joignable…  | condition 1 : `127.0.0.1:3000` refuse la connexion, la seule route passe par le proxy                       |
| une IP autorisée passe sans en-tête | chemin nominal : nginx pose `172.28.0.1`, la garde accepte                                                  |
| un en-tête usurpé … est réécrit     | le client autorisé ment (`X-Forwarded-For: 203.0.113.7`) et reste servi : nginx a jeté le mensonge          |
| une IP non autorisée est refusée…   | `attacker` (172.28.0.66) usurpe l'IP permise via `docker compose exec` et reste 403 : seule l'IP TCP compte |

Les deux derniers tests sont le même théorème dans les deux sens : l'en-tête
envoyé par le client est sans effet, seule l'adresse source vue par le proxy
décide. Le test « réécrit » échouerait le jour où quelqu'un remplace
`proxy_set_header` par `$proxy_add_x_forwarded_for`.

```sh
bun test integration.test.ts
```
