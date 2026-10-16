# Changelog

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
