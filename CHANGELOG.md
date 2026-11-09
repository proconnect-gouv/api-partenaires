# Changelog

## [2026.11.2](https://github.com/proconnect-gouv/api-partenaires/compare/2026.11.1...2026.11.2) (2026-11-09)

### Changements

- Retrait de l’allowlist de 1 lignes que l’annuaire DILA n’atteste plus : `68290-rimbach-pres-masevaux.fr` (fournisseur `f5154035`).

### Modifié

- 🔧 drop 1 rows DILA no longer attests ([#247](https://github.com/proconnect-gouv/api-partenaires/issues/247)) ([caee4b5](https://github.com/proconnect-gouv/api-partenaires/commit/caee4b5ed3e18eb84c8fa511807955442b486696))

## [2026.11.1](https://github.com/proconnect-gouv/api-partenaires/compare/2026.11.0...2026.11.1) (2026-11-06)

### Changements

- Retrait de l’allowlist de 7 lignes que l’annuaire DILA n’atteste plus : `mairiedelachavanne.fr` (fournisseurs `c268fac9` et `f5154035`), `mairiedesaintfrancoisdesales.fr` (fournisseurs `c268fac9` et `f5154035`), `mairiedeboulc.fr`, `communedepierrefittedeux-sevres.com` et `s582979323.onlinehome.fr` (fournisseur `f5154035`).
- Re-clé le fournisseur ANCT d’Auvergne-Rhône-Alpes sur son nouvel identifiant (`4d6fb724`) ; les communes rattachées conservent exactement les mêmes domaines.

### Modifié

- 🔧(anct) re-key Auvergne-Rhône-Alpes provider to its new uid ([#246](https://github.com/proconnect-gouv/api-partenaires/issues/246)) ([7814ceb](https://github.com/proconnect-gouv/api-partenaires/commit/7814ceb594a83499166bea9f4fbcc4d088424f95))
- 🔧 format with bun fmt instead of prettier ([#245](https://github.com/proconnect-gouv/api-partenaires/issues/245)) ([14bcc5f](https://github.com/proconnect-gouv/api-partenaires/commit/14bcc5fd47c6df3deafc191a0b6e469ba192a0c0))
- 🔧(anct) regenerate the proconnect allowlist ([#234](https://github.com/proconnect-gouv/api-partenaires/issues/234)) ([7efecde](https://github.com/proconnect-gouv/api-partenaires/commit/7efecde6184f3e0d27bf0e6ebfbecabd0190560b))

### Dépendances

- ⬆️ Lock file maintenance ([#244](https://github.com/proconnect-gouv/api-partenaires/issues/244)) ([563741e](https://github.com/proconnect-gouv/api-partenaires/commit/563741e26efec16d0adb3b3177cafa22e8f28780))
- ⬆️ Bump docker/login-action from v4.7.0 to v4.8.0 ([#243](https://github.com/proconnect-gouv/api-partenaires/issues/243)) ([4d68c21](https://github.com/proconnect-gouv/api-partenaires/commit/4d68c21ee88cbcf77537ef332eb7e7c8044db209))
- ⬆️ Bump hono from 4.13.14 to 4.13.16 ([#242](https://github.com/proconnect-gouv/api-partenaires/issues/242)) ([526f1e5](https://github.com/proconnect-gouv/api-partenaires/commit/526f1e554d78d2620a82381ff32e4de706e92e98))
- ⬆️ Bump alpine to v3.24.4 ([#241](https://github.com/proconnect-gouv/api-partenaires/issues/241)) ([4d4cd25](https://github.com/proconnect-gouv/api-partenaires/commit/4d4cd256098ef30d11592b720662c87cf53d7c67))
- ⬆️ Lock file maintenance ([#240](https://github.com/proconnect-gouv/api-partenaires/issues/240)) ([986c699](https://github.com/proconnect-gouv/api-partenaires/commit/986c699a95853c09065b5a21ff784c65f5a008fc))
- ⬆️ Bump bun from 1.4.2 to 1.4.4 ([#238](https://github.com/proconnect-gouv/api-partenaires/issues/238)) ([c22e49d](https://github.com/proconnect-gouv/api-partenaires/commit/c22e49d480ee581f4d9ca758efa086913676b770))
- ⬆️ Bump ubuntu from 22.04 to 26.04 ([#239](https://github.com/proconnect-gouv/api-partenaires/issues/239)) ([e01a9be](https://github.com/proconnect-gouv/api-partenaires/commit/e01a9be668a6c2835457b1530a2cf4851e2c62fc))

### CI/CD

- 👷 Configure Renovate ([#236](https://github.com/proconnect-gouv/api-partenaires/issues/236)) ([b191658](https://github.com/proconnect-gouv/api-partenaires/commit/b191658f258ed02a1074ff2585071413fd25c0bb))

## [2026.11.0](https://github.com/proconnect-gouv/api-partenaires/compare/2026.10.8...2026.11.0) (2026-11-04)

### Modifié

- 🔧 drop 7 rows DILA no longer attests ([#231](https://github.com/proconnect-gouv/api-partenaires/issues/231)) ([1930591](https://github.com/proconnect-gouv/api-partenaires/commit/1930591815a3aee66737efe2c7786e077c3e9aeb))
- ♻️ organize the source by domain ([#218](https://github.com/proconnect-gouv/api-partenaires/issues/218)) ([79be0ed](https://github.com/proconnect-gouv/api-partenaires/commit/79be0edb12c8294612f3c3c38d3e4149f54204a1))

### Corrigé

- 🐛 drop malformed DILA domains instead of crashing the allowlist lint ([#225](https://github.com/proconnect-gouv/api-partenaires/issues/225)) ([9d6daec](https://github.com/proconnect-gouv/api-partenaires/commit/9d6daec9a3fb96585504cc842587d6c96a59e0eb))

### Dépendances

- :arrow_upper_right: [patch](deps): Bump mongodb from 7.7.0 to 7.8.0 ([#221](https://github.com/proconnect-gouv/api-partenaires/issues/221)) ([b2c42be](https://github.com/proconnect-gouv/api-partenaires/commit/b2c42bec901e228d3a6ab1acc53cdfa95c7d8535))
- :arrow_upper_right: [patch](deps): Bump @proconnect-gouv/proconnect.core ([#219](https://github.com/proconnect-gouv/api-partenaires/issues/219)) ([44fcec9](https://github.com/proconnect-gouv/api-partenaires/commit/44fcec9ea4b16db5f9284ac7ae06c14cd029f22a))
- :arrow_upper_right: [patch](deps): Bump hono from 4.13.13 to 4.13.14 ([#220](https://github.com/proconnect-gouv/api-partenaires/issues/220)) ([ffefce2](https://github.com/proconnect-gouv/api-partenaires/commit/ffefce2645d6aac768db4e9f7d3a556fb0a7fb2a))
- :arrow_upper_right: [patch](deps): Bump zod from 4.6.6 to 4.6.7 ([#207](https://github.com/proconnect-gouv/api-partenaires/issues/207)) ([96d8d0c](https://github.com/proconnect-gouv/api-partenaires/commit/96d8d0cd60a9673c6a3c00991d36eb45d06277df))
- :arrow_upper_right: [patch](deps): Bump mongo in /examples ([#212](https://github.com/proconnect-gouv/api-partenaires/issues/212)) ([1c752f7](https://github.com/proconnect-gouv/api-partenaires/commit/1c752f7a7e46ce60617bf5a45bbc9f26eced80dc))
- :arrow_upper_right: [patch](deps): Bump oven/bun ([#213](https://github.com/proconnect-gouv/api-partenaires/issues/213)) ([4e9aa13](https://github.com/proconnect-gouv/api-partenaires/commit/4e9aa139dbd1c46e54b59ad463cafdd3a46a5a0c))
- :arrow_upper_right: [patch](deps): Bump alpine from 3.24.2 to 3.24.3 ([#214](https://github.com/proconnect-gouv/api-partenaires/issues/214)) ([e920000](https://github.com/proconnect-gouv/api-partenaires/commit/e920000df39f15b0318190cc68951cc9833fd3b8))
- :arrow_upper_right: [patch](deps-dev): Bump @types/bun ([#215](https://github.com/proconnect-gouv/api-partenaires/issues/215)) ([0960cfb](https://github.com/proconnect-gouv/api-partenaires/commit/0960cfb4b16b5e496beff5ad7ee50c6319c84274))
- :arrow_upper_right: [patch](deps): Bump docker/login-action ([#216](https://github.com/proconnect-gouv/api-partenaires/issues/216)) ([5ffe001](https://github.com/proconnect-gouv/api-partenaires/commit/5ffe0011748d290e8dd273558e062a1fef040690))

### CI/CD

- 👷 add a release note to the cron's drop pull requests ([#232](https://github.com/proconnect-gouv/api-partenaires/issues/232)) ([0fcc769](https://github.com/proconnect-gouv/api-partenaires/commit/0fcc769ae4e807a7a5682cb75de702cef2d6f36a))
- 👷 sign the cron's fix commit despite the 62 MB allowlist ([#229](https://github.com/proconnect-gouv/api-partenaires/issues/229)) ([294eb60](https://github.com/proconnect-gouv/api-partenaires/commit/294eb60808e8cac09d2d8996e7381422b902fe4c))
- 👷 sign the cron's fix commits and record their provenance ([#227](https://github.com/proconnect-gouv/api-partenaires/issues/227)) ([757e540](https://github.com/proconnect-gouv/api-partenaires/commit/757e5406ad8d298f9ad793cf84585f6fc37446cc))
- 👷 alert the team when the apotropaic cron fails ([#224](https://github.com/proconnect-gouv/api-partenaires/issues/224)) ([43488cd](https://github.com/proconnect-gouv/api-partenaires/commit/43488cdc31395a1201d6983d70bc715920e746f5))

## [2026.10.8](https://github.com/proconnect-gouv/api-partenaires/compare/2026.10.7...2026.10.8) (2026-10-21)

### Changements

- L'erreur `502 dns_unavailable` des routes `PUT /api/oidc_providers/:uid/attached_email_domains/:domain` et `PATCH /api/oidc_providers/:uid/configuration` est remplacée par une erreur par cause d'échec de la résolution via `dns.google`, avec le domaine en cause (`{ error, domain }`) : `502 dns_bad_response` (réponse illisible), `502 dns_http_error` (statut HTTP d'erreur), `502 dns_request_failed` (requête échouée) et `504 dns_timeout` (pas de réponse en 5 secondes). Les journaux deviennent `dns.domain.reachable`, `dns.domain.unreachable` et `dns.lookup.failed`, avec `record_type` et, en cas d'échec, `error_type`.

### Ajouté

- ✨ answer each dns lookup failure with its own error ([#209](https://github.com/proconnect-gouv/api-partenaires/issues/209)) ([e729a3b](https://github.com/proconnect-gouv/api-partenaires/commit/e729a3b1ed09bfe9dd550b34c57233dc1f988aea))

### Modifié

- 🔧 share one base compose file across examples ([#211](https://github.com/proconnect-gouv/api-partenaires/issues/211)) ([3ec1eb0](https://github.com/proconnect-gouv/api-partenaires/commit/3ec1eb0de9f9870f617b5a3dfe97e697dcf81fba))
- 🔧 run integration tests on a kernel mongo 9.0.2 accepts ([#210](https://github.com/proconnect-gouv/api-partenaires/issues/210)) ([6900b96](https://github.com/proconnect-gouv/api-partenaires/commit/6900b969862df41a310a807d4c3cd45683634f98))

### Corrigé

- 🐛 Set `isXdaEnabled` when creating an OIDC client ([#202](https://github.com/proconnect-gouv/api-partenaires/issues/202)) ([ff74bfb](https://github.com/proconnect-gouv/api-partenaires/commit/ff74bfb6d3ec66c7916eedb7f918594c5c3d8f6a))

### Dépendances

- :arrow_upper_right: [patch](deps-dev): Bump @types/bun ([#206](https://github.com/proconnect-gouv/api-partenaires/issues/206)) ([6adbf3c](https://github.com/proconnect-gouv/api-partenaires/commit/6adbf3c51da404a4adc2995a1ae45cf03a5ab56e))
- :arrow_upper_right: [patch](deps): Bump @proconnect-gouv/proconnect.core ([#208](https://github.com/proconnect-gouv/api-partenaires/issues/208)) ([7792656](https://github.com/proconnect-gouv/api-partenaires/commit/7792656dd9dc9a5fa283d525fea5a19c7448792a))

## [2026.10.7](https://github.com/proconnect-gouv/api-partenaires/compare/2026.10.6...2026.10.7) (2026-10-20)

### Changements

- Un fournisseur d'identité dont le document Mongo n'a pas de champ `attachedEmailDomains` (ou le met à `null`) est désormais lu comme n'ayant aucun domaine rattaché, au lieu de répondre `500` ; son premier domaine peut être rattaché par `PUT`.

### Modifié

- 🔧(anct) regenerate the proconnect allowlist ([#201](https://github.com/proconnect-gouv/api-partenaires/issues/201)) ([28a3a21](https://github.com/proconnect-gouv/api-partenaires/commit/28a3a2130f91b70955a54269a792f129a85c1f01))

### Corrigé

- 🐛 read a provider without attachedEmailDomains as having none ([#196](https://github.com/proconnect-gouv/api-partenaires/issues/196)) ([a54fe6d](https://github.com/proconnect-gouv/api-partenaires/commit/a54fe6dc886a2ee0d2292fad625e859a730a5f4f))

## [2026.10.6](https://github.com/proconnect-gouv/api-partenaires/compare/2026.10.5...2026.10.6) (2026-10-20)

### Changements

- Nouvelles routes `GET`, `PUT` et `DELETE` sur `/api/oidc_providers/:uid/attached_email_domains[/:domain]` pour lister, rattacher ou détacher un domaine à la fois, sans écraser les modifications concurrentes. `PATCH /api/oidc_providers/:uid/configuration` est dépréciée (en-têtes `Deprecation` et `Sunset`) et sera retirée après le 17 janvier 2027.
- `MAX_TIMESTAMP_DIFF` doit être un entier de 1 à 3600 secondes : une valeur hors bornes (par exemple `1e9`, qui désactivait de fait la protection contre le rejeu, ou `0`) empêche désormais le service de démarrer.
- Les domaines de `oidc_providers.yaml` sont désormais bornés : 63 caractères au plus par label, 253 pour le nom entier, sans tiret en début ou en fin de label ; un fichier hors bornes empêche le service de démarrer.

### Ajouté

- ✨ attach and detach one email domain at a time ([#191](https://github.com/proconnect-gouv/api-partenaires/issues/191)) ([d7e49b0](https://github.com/proconnect-gouv/api-partenaires/commit/d7e49b0e388d657c608aa5d953c06a7791ca2ce2))
- ✨ make the allowlist digest say what a reviewer must check ([#190](https://github.com/proconnect-gouv/api-partenaires/issues/190)) ([975f123](https://github.com/proconnect-gouv/api-partenaires/commit/975f1235d76cb09b8d243b79a24c1bf44a185ce5))
- ✨ report dila rows short of RPNT 1.2 or 2.2 as info, not refusals ([#189](https://github.com/proconnect-gouv/api-partenaires/issues/189)) ([ca902f9](https://github.com/proconnect-gouv/api-partenaires/commit/ca902f9e6a77d2618314f92c2aeaebb0eed7cd03))

### Modifié

- 🔧(anct) regenerate the proconnect allowlist ([#185](https://github.com/proconnect-gouv/api-partenaires/issues/185)) ([092c28d](https://github.com/proconnect-gouv/api-partenaires/commit/092c28dcbf3e3f1803842926425c554f17cc7498))
- ♻️ name route factories routers, one router.ts per route folder ([#193](https://github.com/proconnect-gouv/api-partenaires/issues/193)) ([31e0d8f](https://github.com/proconnect-gouv/api-partenaires/commit/31e0d8fdb10933eba411eca071cdf58f06c9d777))
- ♻️ split the oidc providers router into resource files and a pure admission core ([#192](https://github.com/proconnect-gouv/api-partenaires/issues/192)) ([b1f72bd](https://github.com/proconnect-gouv/api-partenaires/commit/b1f72bd5945eae7ee0326cee155088d10fa84fdd))

### Corrigé

- 🔒 bound domain labels and names in domain_schema ([#195](https://github.com/proconnect-gouv/api-partenaires/issues/195)) ([3d0c99f](https://github.com/proconnect-gouv/api-partenaires/commit/3d0c99f87c46794d7f5b2f9be96d9e2e98cdcfe5))
- 🔒 refuse to boot with a MAX_TIMESTAMP_DIFF outside 1 to 3600 seconds ([#194](https://github.com/proconnect-gouv/api-partenaires/issues/194)) ([ca14111](https://github.com/proconnect-gouv/api-partenaires/commit/ca14111561d65ab2776dca1eb41e5dac60fcf591))

## [2026.10.5](https://github.com/proconnect-gouv/api-partenaires/compare/2026.10.4...2026.10.5) (2026-10-16)

### Ajouté

- ✨ post a digest of allowlist changes vs main on pull requests ([#184](https://github.com/proconnect-gouv/api-partenaires/issues/184)) ([c6985a5](https://github.com/proconnect-gouv/api-partenaires/commit/c6985a5e9cfd2cef8cfb6cd29793bcba39b10871))

## [2026.10.4](https://github.com/proconnect-gouv/api-partenaires/compare/2026.10.3...2026.10.4) (2026-10-16)

### Modifié

- 🔧 filter out candidate rows where another collectivite is dila or routed ([#180](https://github.com/proconnect-gouv/api-partenaires/issues/180)) ([5bbb08f](https://github.com/proconnect-gouv/api-partenaires/commit/5bbb08f9870658dc581e7de3f71f0d84523942c2))

## [2026.10.3](https://github.com/proconnect-gouv/api-partenaires/compare/2026.10.2...2026.10.3) (2026-10-15)

### Ajouté

- ✨ log domain and client changes ([#178](https://github.com/proconnect-gouv/api-partenaires/issues/178)) ([4ef2e08](https://github.com/proconnect-gouv/api-partenaires/commit/4ef2e08ba04202b77c8c1c0af95990cabded7729))

## [2026.10.2](https://github.com/proconnect-gouv/api-partenaires/compare/2026.10.1...2026.10.2) (2026-10-15)

### Ajouté

- ✨ accept rows whose domain rebuilds their fiche's name, [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42) order ([#177](https://github.com/proconnect-gouv/api-partenaires/issues/177)) ([1f915cb](https://github.com/proconnect-gouv/api-partenaires/commit/1f915cbff881094faca7483d894a8e3abed604a7))
- ✨ accept dila rows carrying their collectivité's saint head ([#176](https://github.com/proconnect-gouv/api-partenaires/issues/176)) ([e897202](https://github.com/proconnect-gouv/api-partenaires/commit/e8972029b3f909b9359f9aff33c75df9adae527a))
- ✨ accept renamed communes' former names from INSEE movements ([#175](https://github.com/proconnect-gouv/api-partenaires/issues/175)) ([e2fb9dc](https://github.com/proconnect-gouv/api-partenaires/commit/e2fb9dcbf147811e96a99e473182000e5a7b4d1f))
- ✨ refuse candidate rows whose domain DILA gives to another collectivité ([#171](https://github.com/proconnect-gouv/api-partenaires/issues/171)) ([b8a4770](https://github.com/proconnect-gouv/api-partenaires/commit/b8a4770eae515fc58a7add8a104da121898321a4))
- ✨ accept and check candidate allowlist rows ([#146](https://github.com/proconnect-gouv/api-partenaires/issues/146)) ([b8ccce6](https://github.com/proconnect-gouv/api-partenaires/commit/b8ccce6803b207ca5fb4d2386b0b5edbb888e84f))
- ✨ refuse a domain listed under several providers ([#138](https://github.com/proconnect-gouv/api-partenaires/issues/138)) ([14bdbfe](https://github.com/proconnect-gouv/api-partenaires/commit/14bdbfe78c2cfe37275c6495a30cc63aeba0affc))
- ✨ refuse attaching a domain that does not resolve ([#130](https://github.com/proconnect-gouv/api-partenaires/issues/130)) ([488a4de](https://github.com/proconnect-gouv/api-partenaires/commit/488a4de7e28207515c4155ab281cff3dc32ab87f))
- ✨ explain why a domain is accepted or refused ([#128](https://github.com/proconnect-gouv/api-partenaires/issues/128)) ([509e192](https://github.com/proconnect-gouv/api-partenaires/commit/509e192283cce396dc70ce4927500fb3b4e9703f))
- ✨ refuse dila rows that do not carry their collectivité's name ([#127](https://github.com/proconnect-gouv/api-partenaires/issues/127)) ([6165937](https://github.com/proconnect-gouv/api-partenaires/commit/61659378797b4b7d65193e7ee55d1a322ce39078))
- ✨ print routed warnings before failing on errors ([#126](https://github.com/proconnect-gouv/api-partenaires/issues/126)) ([1c31447](https://github.com/proconnect-gouv/api-partenaires/commit/1c3144752269767d21b0b63d05624e18e5c391dc))
- ✨ check fiche names against COG spellings too ([#125](https://github.com/proconnect-gouv/api-partenaires/issues/125)) ([11423b5](https://github.com/proconnect-gouv/api-partenaires/commit/11423b5827df4413106ffa60db0ac5a684ab8f9b))
- ✨ port reconstructs from [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42)'s validator ([#124](https://github.com/proconnect-gouv/api-partenaires/issues/124)) ([0ee0b18](https://github.com/proconnect-gouv/api-partenaires/commit/0ee0b1825fdc6492517fa345a96ba202ca556dba))
- ✨ port name_stems and carries_name from [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42)'s validator ([#123](https://github.com/proconnect-gouv/api-partenaires/issues/123)) ([123084a](https://github.com/proconnect-gouv/api-partenaires/commit/123084a933d191dc69bb97e249efc8309487821f))
- ✨ load INSEE COG commune names for the name check ([#122](https://github.com/proconnect-gouv/api-partenaires/issues/122)) ([5da96d0](https://github.com/proconnect-gouv/api-partenaires/commit/5da96d096c4f0b1348487202c7a301732f827702))

### Modifié

- 🔧 give prettier 8 GB heap for the 56 MB provider config ([#174](https://github.com/proconnect-gouv/api-partenaires/issues/174)) ([5d6f93c](https://github.com/proconnect-gouv/api-partenaires/commit/5d6f93c5efd329e48b8dc051679e702b0fbe3e30))
- 🔧(anct) import new proconnect candidate domains ([#142](https://github.com/proconnect-gouv/api-partenaires/issues/142)) ([dd3b903](https://github.com/proconnect-gouv/api-partenaires/commit/dd3b9031f13330a21c2a569a8206810d99662cd8))
- 🔧(anct) drop 173 candidate rows DILA gives to another collectivité ([#169](https://github.com/proconnect-gouv/api-partenaires/issues/169)) ([bdb59b1](https://github.com/proconnect-gouv/api-partenaires/commit/bdb59b1a248e4e32c5ce23678cd144343e2d2db8))
- 🔧(anct) import provider 7810ce30 with 3,500 candidate domains ([#167](https://github.com/proconnect-gouv/api-partenaires/issues/167)) ([7479a09](https://github.com/proconnect-gouv/api-partenaires/commit/7479a097eb0a9628f9be5a1d2343852883263985))
- 🔧(anct) import provider 6d8e772f with 3,158 candidate domains ([#163](https://github.com/proconnect-gouv/api-partenaires/issues/163)) ([391ecc2](https://github.com/proconnect-gouv/api-partenaires/commit/391ecc2a2c7760c7eb631bcfd56e223bb261b77a))
- 🔧(anct) import provider 77c8a897 with 2,063 candidate domains ([#162](https://github.com/proconnect-gouv/api-partenaires/issues/162)) ([b227825](https://github.com/proconnect-gouv/api-partenaires/commit/b22782571bab26121c95190d12fd09bb7faa5210))
- 🔧(anct) import provider 972344ed with 1,763 candidate domains ([#161](https://github.com/proconnect-gouv/api-partenaires/issues/161)) ([ec29ad6](https://github.com/proconnect-gouv/api-partenaires/commit/ec29ad6e679b8cd657c843efe118d5d6bac7f6b8))
- 🔧(anct) import verified candidate domains for provider 0b366363 ([#156](https://github.com/proconnect-gouv/api-partenaires/issues/156)) ([9ed52b3](https://github.com/proconnect-gouv/api-partenaires/commit/9ed52b37939d3644da70d7dd33a69bcb95cd6119))
- 🔧(anct) import verified candidate domains for provider ee501034 ([#155](https://github.com/proconnect-gouv/api-partenaires/issues/155)) ([907ee02](https://github.com/proconnect-gouv/api-partenaires/commit/907ee02ad2abead98722564b0aa35ddca7a0b6ff))
- 🔧(anct) import verified candidate domains for provider 852d7b12 ([#154](https://github.com/proconnect-gouv/api-partenaires/issues/154)) ([59d8415](https://github.com/proconnect-gouv/api-partenaires/commit/59d84150ec482ae6d81ddeb80e60644d90b5023d))
- 🔧(anct) import verified candidate domains for provider 7d76b30a ([#153](https://github.com/proconnect-gouv/api-partenaires/issues/153)) ([17981b5](https://github.com/proconnect-gouv/api-partenaires/commit/17981b5180fe2618df25d3d7f77b167b32f14093))
- 🔧(anct) import verified candidate domains for provider 52fcebf9 ([#152](https://github.com/proconnect-gouv/api-partenaires/issues/152)) ([0bad828](https://github.com/proconnect-gouv/api-partenaires/commit/0bad828b34bf8a64df22577ad36b448c41f106b0))
- 🔧(anct) import verified candidate domains for provider cfdbd59a ([#151](https://github.com/proconnect-gouv/api-partenaires/issues/151)) ([11bdbb1](https://github.com/proconnect-gouv/api-partenaires/commit/11bdbb13c28073323b0ba4eb0bc61748c672d859))
- 🔧(anct) import verified candidate domains for provider c268fac9 ([#150](https://github.com/proconnect-gouv/api-partenaires/issues/150)) ([4ea3fb2](https://github.com/proconnect-gouv/api-partenaires/commit/4ea3fb22d113dd5555020f62344b905768830496))
- 🔧(anct) import verified candidate domains for provider 875ff631 ([#149](https://github.com/proconnect-gouv/api-partenaires/issues/149)) ([474c1c7](https://github.com/proconnect-gouv/api-partenaires/commit/474c1c73b2e6e5fd5ec7620fd95adc4409176439))
- 🔧(anct) import verified candidate domains for provider 9bcbc587 ([#148](https://github.com/proconnect-gouv/api-partenaires/issues/148)) ([a8d5570](https://github.com/proconnect-gouv/api-partenaires/commit/a8d5570dc3364e2d3349ea0c369c789b71bd979c))
- 🔧(anct) import verified candidate domains for provider dd2578a8 ([#147](https://github.com/proconnect-gouv/api-partenaires/issues/147)) ([214eaeb](https://github.com/proconnect-gouv/api-partenaires/commit/214eaebd664b4a8d52fa4c2937221a70f3c9d6b9))
- 🔧 move domains to the one FI [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42) backs with DILA ([#139](https://github.com/proconnect-gouv/api-partenaires/issues/139)) ([44a07ad](https://github.com/proconnect-gouv/api-partenaires/commit/44a07ad5a52d2752cecd8402904b54b5b9ab6ada))
- 🔧 adopt the 26 domains [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42) lists that our gates accept ([#137](https://github.com/proconnect-gouv/api-partenaires/issues/137)) ([625a9ca](https://github.com/proconnect-gouv/api-partenaires/commit/625a9ca168c127bde4033ff3ee4d6c99ab535436))
- 🔧 move each collectivité's domains to the FI that serves it ([#136](https://github.com/proconnect-gouv/api-partenaires/issues/136)) ([22d715c](https://github.com/proconnect-gouv/api-partenaires/commit/22d715cdc8d06ff82e7ed437a22c7d35147d8ba5))
- ♻️ return gate verdicts as Results carrying their evidence ([#129](https://github.com/proconnect-gouv/api-partenaires/issues/129)) ([732d5f2](https://github.com/proconnect-gouv/api-partenaires/commit/732d5f293db2dbab089954f85fc673d209f9ead3))
- 🔧 drop pleboulle.fr, its fiche no longer declares it ([#132](https://github.com/proconnect-gouv/api-partenaires/issues/132)) ([4a643dc](https://github.com/proconnect-gouv/api-partenaires/commit/4a643dcb51624fac4983a43ee18110ae77e22568))
- 🔧 show lint:apotropaic stats as an RPNT funnel ([#121](https://github.com/proconnect-gouv/api-partenaires/issues/121)) ([6498378](https://github.com/proconnect-gouv/api-partenaires/commit/64983789e77035ef35206dcb750afe5a23464f5c))
- 🔧 import PR [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42)'s DILA-attested domains for w to z ([#120](https://github.com/proconnect-gouv/api-partenaires/issues/120)) ([5c3b23d](https://github.com/proconnect-gouv/api-partenaires/commit/5c3b23d86524afb3f29fa584b92efcdd72802386))
- 🔧 import PR [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42)'s DILA-attested domains for ville-l to vz ([#119](https://github.com/proconnect-gouv/api-partenaires/issues/119)) ([c0cbd60](https://github.com/proconnect-gouv/api-partenaires/commit/c0cbd60ce934d12c0c5aa7281fc5bcea7664769f))
- 🔧 print allowlist and DILA stats in lint:apotropaic ([#117](https://github.com/proconnect-gouv/api-partenaires/issues/117)) ([2cda785](https://github.com/proconnect-gouv/api-partenaires/commit/2cda785407f38c0b0dc5c65f34e25ef343bb4170))
- 🔧 import PR [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42)'s DILA-attested domains for v up to ville-k ([#118](https://github.com/proconnect-gouv/api-partenaires/issues/118)) ([10a78f6](https://github.com/proconnect-gouv/api-partenaires/commit/10a78f66f66b6407fc1d04c1c421d858f216b659))
- 🔧 import PR [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42)'s DILA-attested domains for t and u ([#116](https://github.com/proconnect-gouv/api-partenaires/issues/116)) ([91f9f8b](https://github.com/proconnect-gouv/api-partenaires/commit/91f9f8b2b7f510d6d525a10541bffa5eb5090807))
- 🔧 import PR [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42)'s DILA-attested domains for saintm to sz ([#115](https://github.com/proconnect-gouv/api-partenaires/issues/115)) ([ac9035c](https://github.com/proconnect-gouv/api-partenaires/commit/ac9035ce7b99d8982bbf472f54ec38e0acbe3657))
- 🔧 import PR [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42)'s DILA-attested domains for s up to saintl ([#114](https://github.com/proconnect-gouv/api-partenaires/issues/114)) ([65c4d2f](https://github.com/proconnect-gouv/api-partenaires/commit/65c4d2ff82ceb7cb87d4ff86f2758bc990688bd1))
- 🔧 import PR [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42)'s DILA-attested domains for q and r ([#113](https://github.com/proconnect-gouv/api-partenaires/issues/113)) ([3b54bcf](https://github.com/proconnect-gouv/api-partenaires/commit/3b54bcffabf6590e02d5563750bb34d4207f4a56))
- 🔧 import PR [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42)'s DILA-attested domains for n to p ([#112](https://github.com/proconnect-gouv/api-partenaires/issues/112)) ([ee8b1f2](https://github.com/proconnect-gouv/api-partenaires/commit/ee8b1f2aad9ef8049a6ddb96a4d36655b10a3860))
- 🔧 import PR [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42)'s DILA-attested domains for maj to mz ([#111](https://github.com/proconnect-gouv/api-partenaires/issues/111)) ([294ee63](https://github.com/proconnect-gouv/api-partenaires/commit/294ee63686240a159b557533332fffdc9fe2f44c))
- 🔧 import PR [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42)'s DILA-attested domains for mairie-n up to mai ([#110](https://github.com/proconnect-gouv/api-partenaires/issues/110)) ([2ead59c](https://github.com/proconnect-gouv/api-partenaires/commit/2ead59c4c3eb42667aeec65c65c69df5466fbd05))
- 🔧 import PR [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42)'s DILA-attested domains for m up to mairie-m ([#109](https://github.com/proconnect-gouv/api-partenaires/issues/109)) ([aca3c58](https://github.com/proconnect-gouv/api-partenaires/commit/aca3c58a578b3ee2ed912457ee44bc7f8599c570))
- ♻️ group the not-allowed domains by category ([#108](https://github.com/proconnect-gouv/api-partenaires/issues/108)) ([a73e4ec](https://github.com/proconnect-gouv/api-partenaires/commit/a73e4eccd0016249714c7031ec896636dd60c59b))
- 🔧 import PR [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42)'s DILA-attested domains for lb to lz ([#107](https://github.com/proconnect-gouv/api-partenaires/issues/107)) ([f29b9b3](https://github.com/proconnect-gouv/api-partenaires/commit/f29b9b356aa3c06566e929a1bda31aa04d535973))
- 🔧 import PR [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42)'s DILA-attested domains for la ([#106](https://github.com/proconnect-gouv/api-partenaires/issues/106)) ([28acaf2](https://github.com/proconnect-gouv/api-partenaires/commit/28acaf26b934235b76bbfd4e1b370c0353b37bba))
- 🔧 log how many routed exceptions lint:apotropaic finds ([#105](https://github.com/proconnect-gouv/api-partenaires/issues/105)) ([60e9aa0](https://github.com/proconnect-gouv/api-partenaires/commit/60e9aa08fbd91f698485074d0ba630cc1da197f1))
- 🔧 import PR [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42)'s DILA-attested domains for g to k ([#104](https://github.com/proconnect-gouv/api-partenaires/issues/104)) ([a3c752f](https://github.com/proconnect-gouv/api-partenaires/commit/a3c752ffb6fe1f0f51a1102275c547b2c6dbb4b6))
- 🔧 import PR [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42)'s DILA-attested domains for d to f ([#103](https://github.com/proconnect-gouv/api-partenaires/issues/103)) ([d150d92](https://github.com/proconnect-gouv/api-partenaires/commit/d150d9230b5c029cf68087515ec50f47a20eada2))
- 🔧 import PR [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42)'s DILA-attested domains for ci to cz ([#102](https://github.com/proconnect-gouv/api-partenaires/issues/102)) ([8c98cfb](https://github.com/proconnect-gouv/api-partenaires/commit/8c98cfb38868a3c788d357a720eff2f12f213a07))
- 🔧 import PR [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42)'s DILA-attested domains for ca to ch ([#101](https://github.com/proconnect-gouv/api-partenaires/issues/101)) ([210dbfd](https://github.com/proconnect-gouv/api-partenaires/commit/210dbfd8ed19a9f4d47518c8f52a468056f97a52))
- 🔧 import PR [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42)'s DILA-attested domains for b ([#100](https://github.com/proconnect-gouv/api-partenaires/issues/100)) ([975b547](https://github.com/proconnect-gouv/api-partenaires/commit/975b547999b936404655c1525dd91013dfcbd7d4))
- 🔧 import PR [#42](https://github.com/proconnect-gouv/api-partenaires/issues/42)'s DILA-attested domains for 0-9 and a ([#99](https://github.com/proconnect-gouv/api-partenaires/issues/99)) ([07eb331](https://github.com/proconnect-gouv/api-partenaires/commit/07eb3315a8b96ba7bd690e4abaeff75b04211ce3))

### Corrigé

- 🐛(anct) rename lanrivain.bzh's manual source to routed ([#173](https://github.com/proconnect-gouv/api-partenaires/issues/173)) ([3e89afd](https://github.com/proconnect-gouv/api-partenaires/commit/3e89afd8e9ec9761e66efb892ca01572e6a23130))
- 🐛(anct) move 2 rows [#161](https://github.com/proconnect-gouv/api-partenaires/issues/161) and [#162](https://github.com/proconnect-gouv/api-partenaires/issues/162) gave the wrong provider ([#165](https://github.com/proconnect-gouv/api-partenaires/issues/165)) ([d4a070a](https://github.com/proconnect-gouv/api-partenaires/commit/d4a070a01865cca44c85dbc4c2a5206dbca34ad5))
- 🐛(anct) restore 116 DILA rows overwritten by [#142](https://github.com/proconnect-gouv/api-partenaires/issues/142) imports ([#166](https://github.com/proconnect-gouv/api-partenaires/issues/166)) ([b380234](https://github.com/proconnect-gouv/api-partenaires/commit/b380234aabd4ecf7f0b8518e4dcc67654bafc851))
- 🐛 stop deny-list lookups matching object prototype keys ([#135](https://github.com/proconnect-gouv/api-partenaires/issues/135)) ([d8017e7](https://github.com/proconnect-gouv/api-partenaires/commit/d8017e764c34c0fd5a4fdc1d7b22f2181af70a56))
- 🐛 refuse non-canonical domains in the providers config ([#134](https://github.com/proconnect-gouv/api-partenaires/issues/134)) ([9299dd5](https://github.com/proconnect-gouv/api-partenaires/commit/9299dd5bd08f9f44c39836d0f59d22e57ab2d514))
- 🐛 fail the allowlist lint on dila records it cannot parse ([#133](https://github.com/proconnect-gouv/api-partenaires/issues/133)) ([29eddd8](https://github.com/proconnect-gouv/api-partenaires/commit/29eddd86b2ddf9337dfae34fb358da51b77ad76d))
- 🔒️ rate limit signed API calls per secret ([#131](https://github.com/proconnect-gouv/api-partenaires/issues/131)) ([d4334d6](https://github.com/proconnect-gouv/api-partenaires/commit/d4334d6c37d2ebe356b520024792ae21cb97f698))

### Supprimé

- 🔥 remove the candidate source ([#90](https://github.com/proconnect-gouv/api-partenaires/issues/90)) ([1dc09d6](https://github.com/proconnect-gouv/api-partenaires/commit/1dc09d6454377ccd9d2ea1184752fd5b853a5aa7))

### Dépendances

- :arrow_upper_right: [patch](deps-dev): Bump prettier ([#143](https://github.com/proconnect-gouv/api-partenaires/issues/143)) ([c4728d2](https://github.com/proconnect-gouv/api-partenaires/commit/c4728d2c688cd613dd515178936fa849590ee65a))
- :arrow_upper_right: [patch](deps): Bump zod from 4.6.5 to 4.6.6 ([#144](https://github.com/proconnect-gouv/api-partenaires/issues/144)) ([41b9518](https://github.com/proconnect-gouv/api-partenaires/commit/41b9518d0f2bc08aa7495762e3f06650d6d4fccf))
- :arrow_upper_right: [patch](deps): Bump oven/bun ([#145](https://github.com/proconnect-gouv/api-partenaires/issues/145)) ([f1dab85](https://github.com/proconnect-gouv/api-partenaires/commit/f1dab859e0349912ed1293f65f2f3ccc821aeead))
- :arrow_upper_right: [patch](deps): Bump mongo ([#92](https://github.com/proconnect-gouv/api-partenaires/issues/92)) ([cb943dd](https://github.com/proconnect-gouv/api-partenaires/commit/cb943dd2d166710c33e3661669784e4118f018bd))
- :arrow_upper_right: [patch](deps): Bump mongo in /examples/oidc_clients ([#93](https://github.com/proconnect-gouv/api-partenaires/issues/93)) ([e56693c](https://github.com/proconnect-gouv/api-partenaires/commit/e56693ca5f704bb082ce938291e2ac241fc3608d))
- :arrow_upper_right: [patch](deps): Bump mongodb from 6.21.0 to 7.7.0 ([#94](https://github.com/proconnect-gouv/api-partenaires/issues/94)) ([70692bd](https://github.com/proconnect-gouv/api-partenaires/commit/70692bdbea148a13fe9caaf4b898400971df0e29))
- :arrow_upper_right: [patch](deps): Bump hono from 4.13.9 to 4.13.13 ([#95](https://github.com/proconnect-gouv/api-partenaires/issues/95)) ([2d5e8ca](https://github.com/proconnect-gouv/api-partenaires/commit/2d5e8ca5ccb95b6a523c01f3ff0f5df9f6f357e9))

### Divers

- ✅ assert whole Results and name fixture arguments ([#168](https://github.com/proconnect-gouv/api-partenaires/issues/168)) ([f370a14](https://github.com/proconnect-gouv/api-partenaires/commit/f370a14da3e8eb7867daf3d903582b1421dc1ad6))
- Revert "✨ refuse a domain listed under several providers" ([#141](https://github.com/proconnect-gouv/api-partenaires/issues/141)) ([f837579](https://github.com/proconnect-gouv/api-partenaires/commit/f83757960631f0a697ba9d0369ecf607707f9ea9))

## [2026.10.1](https://github.com/proconnect-gouv/api-partenaires/compare/2026.10.0...2026.10.1) (2026-10-08)

### Ajouté

- ✨ refuse attaching a domain another provider already has ([d40f6e9](https://github.com/proconnect-gouv/api-partenaires/commit/d40f6e9988e2939186413de87ae91a198e81fdc3))

### Modifié

- ♻️ release through proconnect-gouv/release-action ([#96](https://github.com/proconnect-gouv/api-partenaires/issues/96)) ([93c4c0a](https://github.com/proconnect-gouv/api-partenaires/commit/93c4c0a664c366d723391d3983e1e88a060cbec2))
- 🔧 relabel the 26 DILA-attested candidate rows as dila ([#89](https://github.com/proconnect-gouv/api-partenaires/issues/89)) ([47800e5](https://github.com/proconnect-gouv/api-partenaires/commit/47800e57c0bdeda4c313edb8c87b2a9b303d8e65))

### Supprimé

- 🔥 drop per-scenario example readmes ([#91](https://github.com/proconnect-gouv/api-partenaires/issues/91)) ([9dc0cb8](https://github.com/proconnect-gouv/api-partenaires/commit/9dc0cb8a61c68c04153d5685c3737712ade71833))

### Documentation

- 📝 add contributing guide documenting the release process ([#86](https://github.com/proconnect-gouv/api-partenaires/issues/86)) ([9c6b24a](https://github.com/proconnect-gouv/api-partenaires/commit/9c6b24abb34484f0d491344ae4e39b86f724e07f))
