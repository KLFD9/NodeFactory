# Économie Maison NodeFactory — Spec de Conception v1
## Document daté 2026-06-10

**Auteur** : agent `game-design-veille`
**Statut** : proposition de spec — doit être validée par l'humain avant toute implémentation.
**Livrable** : spécification de conception (documentation uniquement, zéro code, zéro donnée modifiée).
**Fichiers de contexte lus** : `SKILL.md (game-design)`, `SKILL.md (satisfactory-planner)`, `src/data/types.ts`, `src/game/balance.ts`, `public/data/mock/*.json`, `Docs/veille/2026-06-09-veille-game-design.md`.

---

## 0. Préambule de méthode

Ce document est une **spec de conception** : il dit QUOI et POURQUOI, pas COMMENT (le code). Il couvre
l'économie du jeu — items, recettes, bâtiments, belts — dans une version élargie qui reste cohérente
avec les 10 milestones de `balance.ts` et avec les ids existants du dataset mock. Aucun id existant
n'est supprimé ni renommé ; seuls des additions et des modifications de `name` (chaîne affichée) sont
proposées.

Toutes les affirmations chiffrées sur le genre sont recoupées sur au moins deux sources ; les
affirmations sur une source unique sont marquées « à confirmer ». Les calculs de débit (`amountPerCycle
* 60 / time`) sont vérifiés à la main.

---

## Sources consultées

| Source | URL | Confiance |
|---|---|---|
| Satisfactory Wiki — Milestones / Power | https://satisfactory.wiki.gg/wiki/Milestones | Haute |
| Satisfactory Wiki — Smelter | https://satisfactory.wiki.gg/wiki/Smelter | Haute |
| Satisfactory Wiki — Tutorial:Production line | https://satisfactory.fandom.com/wiki/Tutorial:Production_line | Haute |
| The Math of Idle Games, Part I (Gamedeveloper.com) | https://www.gamedeveloper.com/design/the-math-of-idle-games-part-i | Haute |
| Industry Idle Wiki — Resources & Production Facilities | https://industryidle.fandom.com/wiki/Resources_%26_Production_Facilities | Haute |
| Factorio Ratio Calculation Basics | https://factorio-wiki.pages.dev/en/production/ratio-calculation | Haute |
| Shapez 2 Complete Guide 2026 | https://www.gamebrief.net/blog/shapez-2-complete-guide-hub | Haute |
| Anno 1800 — Production chains (Fandom) | https://anno1800.fandom.com/wiki/Production_chains | Haute |
| Anno 1800 — Production layouts | https://anno1800.fandom.com/wiki/Production_layouts | Haute |
| Idle Game Design: Systems, Mechanics (Missions Zanx) | https://missionszanx.com/guides/idle-game-design-systems-mechanics-and-progression | Moyenne |
| Veille game-design NodeFactory 2026-06-09 | Docs/veille/2026-06-09-veille-game-design.md | Interne |

---

## 1. Identité et thème de l'économie

### 1.1 Choix retenu : « Automatisation industrielle abstraite » — les noms restent, l'âme devient la nôtre

Les noms actuels (Iron Ore, Iron Ingot, Wire, Cable, Reinforced Iron Plate…) sont **conservés** dans
cette v1. Ils sont compréhensibles, cohérents entre eux, et la communauté autour des jeux d'usine les
reconnaît. Les changer pour des noms purement fictifs (« Ferrux Brut », « Câble Neuronique »)
apporterait de la friction sans gain de feel immédiat.

**Ce qui fait que c'est « la nôtre »** :
- Les **débits, temps de cycle, coûts énergétiques et recettes alternatives** sont des choix de design
  délibérés, pas des copies de Satisfactory 1.0. La simulation est honnête mais les valeurs sont les
  nôtres.
- Le **registre thématique** reste industriel (minerais, lingots, composants, câbles) mais s'étend
  dans la v1 vers deux nouvelles branches industrielles : **l'électronique de base** (circuit imprimé)
  et **la chimie légère** (plastique, caoutchouc) — ce sont les deux directions les plus
  compréhensibles et les plus cohérentes avec les noms existants.
- **Cohérence interne avant fidélité à Satisfactory** : si une valeur de Satisfactory crée un arbre
  de ratios incommode pour le LP (fractions encombrantes, arbitrages peu clairs), on ajuste. La vérité
  de simulation est notre design, pas leur dataset.

### 1.2 Périmètre de la v1 élargie

La v1 élargie ajoute **un palier industriel complet** au-dessus de l'existant, calé sur les milestones
déjà conçus, plus une extension vers les circuits et le cuivre traité. Elle ne détruit rien et ne
demande pas de réimplémenter les tests existants — elle les étend.

**Scope final proposé** :
- **Palier 0 (déjà existant, intouché)** : iron-ore, copper-ore, limestone, iron-ingot, copper-ingot,
  concrete, wire, cable. Les bâtiments extraction + smelter + constructor restent tels quels.
- **Palier 1 (déjà existant, intouché)** : iron-plate, iron-rod, screw, reinforced-iron-plate,
  modular-frame. L'assembler tel quel.
- **Palier 2 (nouveau)** : steel, copper-sheet, circuit-board, plastic-rod. Bâtiment fondry (déjà
  présent) + refinery (déjà présent).
- **Palier 3 (nouveau)** : computer, motor, heavy-frame. Manufacturer (déjà présent).

**Recettes alternatives nouvelles** (3 supplémentaires, s'ajoutant aux 3 existantes) : 2 alts sur
Palier 2, 1 alt sur Palier 3.

---

## 2. Structure de la chaîne tech

### 2.1 Cartographie des paliers

```
PALIER 0 — Matières premières et semi-produits de base
  iron-ore       ──[Miner Mk.1/2/3]──►  (flux extraction)
  copper-ore     ──[Miner Mk.1/2/3]──►  (flux extraction)
  limestone      ──[Miner Mk.1/2/3]──►  (flux extraction)
  coal           ──[Miner Mk.1/2/3]──►  (flux extraction)  [NOUVEAU item/raw]
  iron-ingot     ──[Smelter]──── iron-ore → iron-ingot
  copper-ingot   ──[Smelter]──── copper-ore → copper-ingot
  concrete       ──[Constructor]─ limestone → concrete
  wire           ──[Constructor]─ copper-ingot → wire
  cable          ──[Constructor]─ wire → cable

PALIER 1 — Composants structurels (déjà existants)
  iron-plate             [Constructor]
  iron-rod               [Constructor]
  screw                  [Constructor]
  reinforced-iron-plate  [Assembler]
  modular-frame          [Assembler]

PALIER 2 — Alliages et composants intermédiaires [NOUVEAU]
  steel          ──[Foundry]────── iron-ore + coal → steel
  copper-sheet   ──[Constructor]── copper-ingot → copper-sheet  [NOUVEAU]
  circuit-board  ──[Assembler]──── copper-sheet + plastic-rod → circuit-board  [NOUVEAU]
  plastic-rod    ──[Refinery]───── (traitement simple, voir recette)  [NOUVEAU]

PALIER 3 — Produits complexes [NOUVEAU]
  motor          ──[Assembler]──── steel + reinforced-iron-plate → motor
  computer       ──[Manufacturer]─ circuit-board + cable + modular-frame → computer
  heavy-frame    ──[Manufacturer]─ modular-frame + steel + concrete → heavy-frame
```

**Profondeur** : la chaîne la plus longue est désormais de **5 étages** (ore → ingot → intermediate →
component → complex product), contre 4 dans le slice actuel (ore → ingot → plate → reinforced-plate
→ modular-frame). Cette profondeur est délibérément modérée : les jeux factory bien pacés n'exposent
pas plus de 5-8 étages avant un prestige/reset (source : analyse Satisfactory Tier 1-6, veille
2026-06-09 §2.2 ; Shapez 2 couches progressives).

### 2.2 Alignement avec les 10 milestones de `balance.ts`

Les milestones existants ne sont PAS modifiés. Le contenu nouveau s'insère **après M7** (débloque
le Manufacturer) car c'est le Manufacturer qui produit les items de Palier 3.

| Milestone | Débloque (existant) | Items de Palier 2/3 utilisables après ce point |
|---|---|---|
| M1 iron-ingot-60 | constructor | — |
| M2 iron-rod-150 | miner-mk2 | — |
| M3 iron-plate-300 | assembler | — |
| M4 screw-400 | alt-cast-screw | — |
| M5 reinforced-iron-plate-75 | foundry | **steel devient productible** (Foundry) |
| M6 wire-500 | miner-mk3 | copper-sheet productible (Constructor) |
| M7 cable-300 | manufacturer | circuit-board productible (Assembler) |
| M8 concrete-375 | alt-bolted-iron-plate | plastic-rod + alt-steel-wire disponibles |
| M9 modular-frame-50 | alt-iron-wire | motor productible (Assembler) |
| M10 modular-frame-150 | hint prestige | computer + heavy-frame (Manufacturer) = horizon Hobby |

**Conséquence** : les nouveaux items de Palier 2 et 3 sont des **objectifs post-M5** — ils donnent du
contenu à la phase Habit tardive et à la phase Hobby, sans toucher à la phase Hook (M1-M3) qui doit
rester la plus simple possible.

### 2.3 Nouveaux items proposés (additions au dataset)

Voici la liste complète des nouveaux ids à ajouter à `items.json`. Aucun id existant n'est modifié.

| id | name | category | raw |
|---|---|---|---|
| `coal` | Coal | raw | true |
| `copper-sheet` | Copper Sheet | part | false |
| `steel` | Steel Ingot | ingot | false |
| `plastic-rod` | Plastic Rod | part | false |
| `circuit-board` | Circuit Board | part | false |
| `motor` | Motor | part | false |
| `computer` | Computer | part | false |
| `heavy-frame` | Heavy Frame | part | false |

**Remarque sur `coal`** : le charbon est ajouté comme matière première extractible (raw: true)
nécessaire à la production d'acier. Il n'est pas utilisé ailleurs dans la v1 élargie pour maintenir
la lisibilité des arbitrages LP. Son introduction à partir de M5 (quand la Fonderie est débloquée)
est logique et cohérente avec les milestones.

### 2.4 Nouveaux bâtiments proposés

**Aucun nouveau bâtiment** n'est nécessaire dans la v1 élargie. Le Foundry, le Refinery, l'Assembler
et le Manufacturer sont déjà dans `buildings.json`. Les nouveaux items passent tous par ces bâtiments
existants.

---

## 3. Philosophie des valeurs (pour le feel)

### 3.1 Principes directeurs issus du genre (recoupés ≥ 2 sources)

**Principe A — Débits décroissants avec la complexité.**
Plus un item est avancé dans la chaîne, plus son débit de sortie nominal (par machine, en items/min)
est bas. Ce schéma est universel dans le genre factory : en Satisfactory 1.0, un Smelter fait 30
lingots/min ; un Assembler fait 5 plaques renforcées/min ; un Manufacturer fait 1-3 composants
complexes/min. La décroissance n'est pas linéaire mais progressive : chaque palier est environ 2x à
4x plus lent que le précédent en nombre d'items produits, compensé par la valeur unitaire supérieure
de l'item (sources : Satisfactory Wiki production line ; Factorio ratio calculation).

**Principe B — Consommation d'énergie proportionnelle à la complexité des inputs.**
Un bâtiment qui traite des inputs multi-étages doit consommer plus d'énergie qu'un bâtiment de base.
La règle approximative observée dans les jeux factory (Satisfactory, Industry Idle) : chaque palier
de complexité multiplie la consommation par ~2x à ~4x. Smelter 4 MW → Constructor 4 MW → Assembler
15 MW → Manufacturer 55 MW : la progression existante dans notre dataset est déjà cohérente avec ce
principe (source : Satisfactory Wiki Smelter + Constructor + Manufacturer pages).

**Principe C — Les recettes alternatives créent des arbitrages vrais, pas de la domination.**
Une alternative qui est strictement meilleure que la recette standard sur tous les objectifs LP n'est
pas une alternative : c'est un remplacement. Une bonne alternative doit être meilleure sur au moins
un objectif (ex. min machines) et pire sur un autre (ex. min ressources brutes). Les trois
alternatives actuelles (Cast Screw, Bolted Iron Plate, Iron Wire) respectent ce principe — Cast Screw
utilise des lingots directs (min machines) mais en consomme plus en brut (pire pour min raw-resources
car saute le Rod qui multiplied). Les nouvelles alternatives doivent respecter la même contrainte.

**Principe D — Capacité des belts progressivement saturée.**
À chaque palier d'items, les débits doivent atteindre mais ne pas systématiquement dépasser la
capacité du tier de belt approprié. Le Belt Mk.1 (60/min) est le bon tier pour les flux P0 simples
(iron-ingot à 30/min = bien au-dessous) ; le Mk.3 (270/min) devient pertinent pour les flux
intermédiaires de Palier 1 consolidés (screws : 40/min par machine mais en aggrégat sur 4-6 machines
= 160-240/min → Mk.2 à Mk.3 bien calibré). Le Palier 2 pousse vers les Mk.3-Mk.4. Le Palier 3 peut
justifier le Mk.4-Mk.5 sur les bus centraux (source : Factorio cheat sheet ratios, Industry Idle
tier progression).

**Principe E — La complexité de calcul croît plus vite que la profondeur.**
Passer de 3 à 5 étages de chaîne multiplie la combinatoire des arbitrages LP : à 5 étages avec 3
recettes alternatives actives, le solveur explore ~8-16 solutions candidates. C'est exactement ce
qui rend le score d'efficacité plus significatif en phase Hobby. Ce principe valide l'ajout du Palier
2 et 3 pour renforcer le différenciateur LP. (Sources : The Math of Idle Games, Gamedeveloper.com ;
Factorio ratio calculation)

### 3.2 Fourchettes chiffrées pour les nouveaux items

Toutes les valeurs sont justifiées par la formule `debit = amountPerCycle * 60 / time`. Les valeurs
sont choisies pour produire des **ratios propres** entre recettes de même palier (évite les fractions
incommodes dans les plans LP).

#### Palier 2 — Recettes standards

**steel (Foundry, bâtiment existant 16 MW)**
```
Recette : iron-ore × 3 + coal × 1 → steel × 1 / 6 s
Débit acier : 1 * 60 / 6 = 10/min
Débit ore consommé : 3 * 60 / 6 = 30/min  (ratio 3:1 ore/steel)
Débit coal consommé : 1 * 60 / 6 = 10/min
```
Justification : 10/min est volontairement bas (acier = item de valeur, fonderie = bâtiment coûteux
en énergie). Le ratio ore:steel de 3:1 crée un vrai arbitrage LP (produire de l'acier consomme
beaucoup de minerai). Un Miner Mk.2 (120/min sur ore) alimente 4 fonderies à 100 % — c'est le ratio
pédagogique qui montre pourquoi le Miner Mk.2 est précieux (débloqué en M2).

**copper-sheet (Constructor, 4 MW)**
```
Recette : copper-ingot × 2 → copper-sheet × 1 / 6 s
Débit copper-sheet : 1 * 60 / 6 = 10/min
Débit copper-ingot consommé : 2 * 60 / 6 = 20/min
```
Justification : mirrors la recette Iron Plate (3 lingots → 2 plaques / 6 s = 20/min) mais avec une
conversion 2:1 plus simple. Le copper-sheet est un intermédiaire dont le rôle est de créer un flux
cuivre parallèle au flux fer — deux chaînes indépendantes qui convergeront sur le circuit-board
(arbitrage LP intéressant).

**plastic-rod (Refinery, 30 MW, bâtiment existant)**
```
Recette : concrete × 3 + coal × 2 → plastic-rod × 2 / 8 s
Débit plastic-rod : 2 * 60 / 8 = 15/min
Débit concrete consommé : 3 * 60 / 8 = 22.5/min
Débit coal consommé : 2 * 60 / 8 = 15/min
```
Justification : le Refinery traite des flux multi-inputs et produit un polymère de base. Utiliser du
concret (déjà dans l'économie) et du charbon (nouveau, extractible) crée un lien entre les deux
branches existantes. Le débit 15/min est choisi pour s'aligner proprement avec le circuit-board
en aval (voir ci-dessous). Note : la Refinery a 2 outputs dans notre dataset (inputs:2, outputs:2) —
nous n'utilisons ici qu'un output ; l'autre slot peut servir pour un sous-produit ou rester vide
dans la v1 (décision à arbitrer, voir §6).

**circuit-board (Assembler, 15 MW)**
```
Recette : copper-sheet × 2 + plastic-rod × 4 → circuit-board × 1 / 8 s
Débit circuit-board : 1 * 60 / 8 = 7.5/min
Débit copper-sheet consommé : 2 * 60 / 8 = 15/min
Débit plastic-rod consommé : 4 * 60 / 8 = 30/min
```
Justification : 7.5/min est intentionnellement bas (circuit-board = premier item vraiment complexe,
valeur élevée). Le ratio 15/min de cuivre sur 30/min de plastic-rod donne un arbitrage LP clair : un
Assembler circuit-board consomme 2 flux du Palier 2 (1 copper-sheet line + 2 plastic-rod lines avec
un Splitter). Cela force le joueur à équilibrer deux branches distinctes — c'est exactement ce que
le badge bottleneck révèle.

#### Palier 3 — Recettes standards

**motor (Assembler, 15 MW)**
```
Recette : steel × 3 + reinforced-iron-plate × 2 → motor × 1 / 12 s
Débit motor : 1 * 60 / 12 = 5/min
Débit steel consommé : 3 * 60 / 12 = 15/min
Débit reinforced-iron-plate consommé : 2 * 60 / 12 = 10/min
```
Justification : le moteur relie la branche acier (Palier 2) à la branche plaques renforcées (Palier 1).
C'est le type d'arbitrage que le LP valorise : faut-il minimer les ressources brutes (donc maximiser
l'usage des alts Cast Screw pour les screws qui alimentent les reinforced plates) ou minimiser
l'énergie (alts qui réduisent les étapes) ? Le moteur est le premier item à rendre ces arbitrages
simultanément visibles.

**heavy-frame (Manufacturer, 55 MW)**
```
Recette : modular-frame × 5 + steel × 3 + concrete × 5 → heavy-frame × 1 / 16 s
Débit heavy-frame : 1 * 60 / 16 = 3.75/min  (arrondi vers 4 = acceptable)
Débit modular-frame consommé : 5 * 60 / 16 = 18.75/min
Débit steel consommé : 3 * 60 / 16 = 11.25/min
Débit concrete consommé : 5 * 60 / 16 = 18.75/min
```
Note : les débits fractionnaires en amont (18.75/min) produisent des ratios non entiers — ce qui
est acceptable pour le Manufacturer car c'est un bâtiment avancé. Mais si l'on préfère des ratios
propres pour les tests, on peut ajuster le temps à 20 s :
```
Variante temps=20s :
Débit heavy-frame : 1 * 60 / 20 = 3/min  (propre)
Débit modular-frame : 5 * 60 / 20 = 15/min  (propre)
Débit steel : 3 * 60 / 20 = 9/min  (propre)
Débit concrete : 5 * 60 / 20 = 15/min  (propre)
```
**Recommandation : utiliser time=20 s** pour que les tests d'intégration aient des valeurs propres.
Arbitrage humain : voir §6 question Q4.

**computer (Manufacturer, 55 MW)**
```
Recette : circuit-board × 3 + cable × 6 + modular-frame × 1 → computer × 1 / 24 s
Débit computer : 1 * 60 / 24 = 2.5/min
Débit circuit-board consommé : 3 * 60 / 24 = 7.5/min  (propre : = sortie d'un Assembler circuit-board)
Débit cable consommé : 6 * 60 / 24 = 15/min
Débit modular-frame consommé : 1 * 60 / 24 = 2.5/min
```
Justification de l'elegance : le débit consommé de circuit-board (7.5/min) est exactement égal au
débit nominal d'un seul Assembler circuit-board. Ratio 1:1 machine parfait. Un seul Assembler
circuit-board alimente un seul Manufacturer computer. Ce genre de ratio « élégant » est une des
joies du genre factory (source : Tutorial:Production line Satisfactory ; Factorio ratio guides) et
est exactement ce que le solveur LP révèle au joueur.

### 3.3 Tableau récapitulatif des débits

| Item | Bâtiment | time (s) | amountPerCycle | Débit (items/min) | Énergie bât. (MW) | Palier |
|---|---|---|---|---|---|---|
| iron-ingot | smelter | 2 | 1 | 30 | 4 | 0 |
| copper-ingot | smelter | 2 | 1 | 30 | 4 | 0 |
| concrete | constructor | 4 | 1 | 15 | 4 | 0 |
| wire | constructor | 4 | 2 | 30 | 4 | 0 |
| cable | constructor | 2 | 1 | 30 | 4 | 0 |
| iron-plate | constructor | 6 | 2 | 20 | 4 | 1 |
| iron-rod | constructor | 4 | 1 | 15 | 4 | 1 |
| screw | constructor | 6 | 4 | 40 | 4 | 1 |
| reinforced-iron-plate | assembler | 12 | 1 | 5 | 15 | 1 |
| modular-frame | assembler | 60 | 2 | 2 | 15 | 1 |
| **steel** | **foundry** | **6** | **1** | **10** | **16** | **2** |
| **copper-sheet** | **constructor** | **6** | **1** | **10** | **4** | **2** |
| **plastic-rod** | **refinery** | **8** | **2** | **15** | **30** | **2** |
| **circuit-board** | **assembler** | **8** | **1** | **7.5** | **15** | **2** |
| **motor** | **assembler** | **12** | **1** | **5** | **15** | **3** |
| **heavy-frame** | **manufacturer** | **20** | **1** | **3** | **55** | **3** |
| **computer** | **manufacturer** | **24** | **1** | **2.5** | **55** | **3** |

**Tendance du feel confirmée par ces valeurs** :
- P0 : 15-30/min par machine (belts Mk.1 = 60/min, sous-utilisés → latence visible).
- P1 : 2-40/min (forte variance = le LP a de vraies décisions à prendre).
- P2 : 7.5-15/min (une machine P2 exige 2-4 machines P0/P1 en amont).
- P3 : 2.5-5/min (horizon long, chaque computer = 4 Assemblers + plusieurs machines en amont).

### 3.4 Ratios entre paliers (ordres de grandeur justifiés)

Le ratio de débit entre palier N et palier N+1 se situe entre **2x et 4x** de réduction, ce qui est
cohérent avec les jeux de genre bien équilibrés :
- P0→P1 : iron-ingot (30/min) → reinforced-iron-plate (5/min) = facteur 6 sur 2 étapes intermédiaires.
- P1→P2 : modular-frame (2/min) → steel (10/min) n'est pas une chaîne directe mais les deux items
  sont au même niveau de complexité. Steel à 10/min vs. reinforced-iron-plate à 5/min = facteur 2
  (l'acier est plus simple car 1 seul étage de fonderie depuis le minerai).
- P2→P3 : circuit-board (7.5/min) → computer (2.5/min) = facteur 3. Motor (5/min) = facteur 1.5
  vs. steel seul, mais facteur >3 par rapport à l'ore de base.

Ces ratios sont cohérents avec la graduation observée dans les jeux factory de référence :
Satisfactory 1.0 montre un facteur 5-10 entre les items T1 et les items T5 (sources : Tutorial
Production Line ; analyse Tier 1-6 dans la veille 2026-06-09).

### 3.5 Énergie : ratios par bâtiment

La progression énergétique dans notre dataset suit une courbe en escalier cohérente avec le principe B :

| Bâtiment | Énergie (MW) | Ratio vs Smelter |
|---|---|---|
| Smelter | 4 | 1× |
| Constructor | 4 | 1× |
| Foundry | 16 | 4× |
| Assembler | 15 | 3.75× |
| Refinery | 30 | 7.5× |
| Manufacturer | 55 | 13.75× |

Ce tableau est directement justifié par les valeurs existantes dans `buildings.json`. Les bâtiments
de Palier 2 (Foundry, Refinery) consomment 4-8× plus que les bâtiments de base. Le Manufacturer
consomme 13-14× plus — cohérent avec son rôle de producteur de P3 (items à très haute valeur
relative). Cette progression justifie le fait que le score LP `min énergie` soit un objectif
pertinent et non trivial : remplacer un Manufacturer par un Assembler quand c'est possible est
une décision réelle d'optimisation.

---

## 4. Recettes alternatives nouvelles

### Principe de conception des alts

Chaque alternative doit satisfaire ces trois critères :
1. **Meilleure sur au moins un objectif LP** (min raw-resources, min machines, ou min énergie).
2. **Pire sur au moins un autre objectif** (sinon c'est un remplacement, pas une alternative).
3. **Déblocable via un milestone** existant ou un milestone futur cohérent avec la progression.

Les 6 recettes alternatives de la v1 élargie (3 existantes + 3 nouvelles) :

### Alt-P2-A : Alternate: Steel Cast (Foundry) — débloquable M5 ou M8

```json
{
  "id": "alt-steel-cast",
  "name": "Alternate: Steel Cast",
  "alternate": true,
  "time": 4,
  "producedIn": "foundry",
  "ingredients": [
    { "item": "iron-ingot", "amountPerCycle": 3 },
    { "item": "coal", "amountPerCycle": 1 }
  ],
  "products": [
    { "item": "steel", "amountPerCycle": 2 }
  ]
}
```
**Débit** : 2 * 60 / 4 = 30/min de steel (vs 10/min standard = 3× plus rapide).
**Avantage LP** : min machines (3× moins de Foundries pour une même production d'acier).
**Inconvénient LP** : consomme des lingots traités (iron-ingot) au lieu de minerai brut (iron-ore) →
pire pour min raw-resources car il faut des Smelters supplémentaires en amont. Le LP choisira cette
recette quand l'objectif est `min machines` et évitera quand l'objectif est `min raw-resources`.
Arbitrage clair et honnête.

**Milestone de déblocage suggéré** : nouveau `ms-steel-200` (produire 200 steel → débloque
alt-steel-cast). Ce serait un M8-bis ou M11 optionnel. Voir §6 Q5 pour l'arbitrage.

### Alt-P2-B : Alternate: Fused Circuit (Assembler) — débloquable M9-M10

```json
{
  "id": "alt-fused-circuit",
  "name": "Alternate: Fused Circuit",
  "alternate": true,
  "time": 10,
  "producedIn": "assembler",
  "ingredients": [
    { "item": "copper-ingot", "amountPerCycle": 4 },
    { "item": "plastic-rod", "amountPerCycle": 2 }
  ],
  "products": [
    { "item": "circuit-board", "amountPerCycle": 2 }
  ]
}
```
**Débit** : 2 * 60 / 10 = 12/min de circuit-board (vs 7.5/min standard = 1.6× plus rapide).
**Avantage LP** : min raw-resources (saute l'étape copper-sheet → moins d'étapes, moins de minerai
de cuivre requis par circuit).
**Inconvénient LP** : consomme plus de plastic-rod en ratio relatif → pire pour min énergie (plus de
Refineries nécessaires). Le fait de sauter le copper-sheet supprime un bâtiment mais crée une
dépendance directe sur la branche charbon (plastic-rod en amont). Arbitrage non trivial — c'est
exactement ce que le solveur expose au joueur.

**Milestone de déblocage suggéré** : `ms-circuit-board-75` (produire 75 circuit-board → débloque
alt-fused-circuit). Post-M9.

### Alt-P3-A : Alternate: Automated Motor (Manufacturer) — débloquable post-M10

```json
{
  "id": "alt-automated-motor",
  "name": "Alternate: Automated Motor",
  "alternate": true,
  "time": 20,
  "producedIn": "manufacturer",
  "ingredients": [
    { "item": "steel", "amountPerCycle": 2 },
    { "item": "cable", "amountPerCycle": 4 },
    { "item": "circuit-board", "amountPerCycle": 2 }
  ],
  "products": [
    { "item": "motor", "amountPerCycle": 2 }
  ]
}
```
**Débit** : 2 * 60 / 20 = 6/min de motor (vs 5/min standard dans l'Assembler = légèrement plus
rapide mais consomme 4 inputs vs 2).
**Avantage LP** : min machines sur certains profils d'usine (le Manufacturer produit plus vite).
**Inconvénient LP** : Manufacturer = 55 MW vs Assembler = 15 MW → pire pour min énergie (facteur
3.7 en consommation). De plus, requiert circuit-board en input (branche électronique), donc pire
pour min raw-resources dans un profil sans branche cuivre déjà construite.
**Arbitrage** : cette alt est réservée aux joueurs Hobby avancés qui ont déjà les deux branches
(fer + cuivre + plastique) fonctionnelles. C'est un défi d'optimisation de niveau max.

---

## 5. Cohérence avec le LP / score d'efficacité

### 5.1 Comment les nouveaux items enrichissent les arbitrages LP

Le solveur LP NodeFactory a trois objectifs : `min raw-resources`, `min machines`, `min energy`.
Voici comment les items de Palier 2 et 3 enrichissent chaque objectif :

**min raw-resources** : avec les nouveaux items, la matière brute `coal` devient une variable LP
importante. Le charbon entre dans steel (via Foundry) ET dans plastic-rod (via Refinery). Une usine
computer doit produire les deux → le LP doit décider comment partager l'extraction de charbon entre
les deux chaînes. Sans la contrainte de charbon, le LP serait moins intéressant.

**min machines** : les alts Alt-Steel-Cast et Alt-Fused-Circuit créent des raccourcis agressifs
qui suppriment des étapes. Le LP `min machines` les activera systématiquement, produisant un plan
très compact mais qui consomme plus de ressources brutes. C'est lisible et pédagogique.

**min energy** : le Refinery (30 MW) et le Manufacturer (55 MW) sont des gouffres énergétiques. Le
LP `min energy` cherchera à éviter autant de Refineries et Manufacturers que possible, en préférant
des chemins alternatifs plus « frugaux » en MW. L'alt Alt-Automated-Motor fait exactement l'inverse :
elle coûte plus en énergie pour sauver des machines. C'est l'arbitrage machines/énergie visible.

### 5.2 Score d'efficacité sur un plan complexe

Avec la v1 élargie (5 paliers, 6 alts), un plan « naïf » pour produire 1 computer/min aura un score
d'efficacité global nettement inférieur à 1.0 sans guidance. Le solveur LP peut montrer que le même
computer/min est atteignable avec 30 % moins de ressources brutes en utilisant les bonnes alts. Ce
delta de 30 % est suffisamment visible pour constituer un objectif de méta-jeu (phase Hobby).

Valeur estimée du delta d'optimisation pour un plan computer naïf vs optimal LP :
- Ressources brutes : gain LP estimé **20-35 %** (principalement via cast-screw + fused-circuit).
- Machines : gain LP estimé **25-40 %** (Alt-Steel-Cast + Alt-Fused-Circuit combinés).
- Énergie : gain LP estimé **10-20 %** (Refinery est incontournable, limitation structurelle).

Ces fourchettes sont des estimations à confirmer une fois les valeurs implémentées dans le solveur
(les tests de solver.test.ts le vérifieront automatiquement).

---

## 6. Plan d'implémentation incrémental

**Principe directeur** : chaque tranche doit laisser `npm run test` intégralement vert avant de
commencer la suivante. Les tests existants (33 verts) ne doivent pas régresser.

### Tranche 0 — Prérequis : vérification de l'état actuel (avant toute modification)
- Lancer `npm run test` → confirmer les 33 tests verts.
- Lancer `npm run typecheck` → confirmer zéro erreur TypeScript.
- **Tests impactés** : aucun (vérification only).

---

### Tranche 1 — Item `coal` + recette `steel` standard (Foundry)

**Quoi** : ajouter `coal` à `items.json` et la recette `steel` (standard) à `recipes.json`.
La Foundry est déjà dans `buildings.json` avec ses 2 inputs.

**Fichiers modifiés** :
- `public/data/mock/items.json` : ajouter `{ "id": "coal", "name": "Coal", "category": "raw", "raw": true }`.
- `public/data/mock/recipes.json` : ajouter la recette `steel` (iron-ore×3 + coal×1 → steel×1 / 6s).
- Ajouter `{ "id": "steel", "name": "Steel Ingot", "category": "ingot", "raw": false }` aux items.

**Tests impactés** :
- `data.test.ts` (test 13 — validité référentielle) : doit passer car les nouveaux items et recettes
  sont référentiellement cohérents. Aucune modification du test.
- `solver.test.ts` : les tests existants ne demandent pas `steel` → ne régresse pas. Ajouter un
  nouveau test : « 30 steel/min (standard) → 3 Foundries, coal=50/min, iron-ore=90/min ». Valeurs
  vérifiées à la main : 30 steel/min = 3 machines × 10/min ; ore = 3×10×3 = 90/min ; coal = 3×10×1 = 30/min.
  Correction : débit steel = 10/min par Foundry, donc pour 30/min : 3 Foundries.
  ore consommé : 3×(3×10) = 90/min. coal consommé : 3×(1×10) = 30/min. MW = 3×16 = 48 MW.
- `balance.test.ts` : aucun impact (balance.ts ne référence pas les items directement).

**Durée estimée** : 30 min (données JSON + 1 test solver).

---

### Tranche 2 — `copper-sheet` et `plastic-rod`

**Quoi** : ajouter les deux items de Palier 2 qui n'ont pas de dépendance croisée entre eux.

**Fichiers modifiés** :
- `items.json` : ajouter `copper-sheet` et `plastic-rod`.
- `recipes.json` : ajouter `copper-sheet` (copper-ingot×2 → copper-sheet×1 / 6s) et
  `plastic-rod` (concrete×3 + coal×2 → plastic-rod×2 / 8s).

**Tests impactés** :
- `data.test.ts` (test 13) : aucun impact si les items référencés existent bien (coal ajouté en T1).
- `solver.test.ts` : ajouter 1 test pour chaque nouvelle recette :
  - « 10 copper-sheet/min → 1 Constructor, 20 copper-ingot/min, 1 Smelter ».
  - « 15 plastic-rod/min → 1 Refinery, concrete=22.5/min, coal=15/min ».
  Note : 22.5/min de concrete est non entier → le test doit utiliser `toBeCloseTo(22.5, 1)`.
- `computeFactory.test.ts` : aucun nouveau test requis à cette tranche (les nœuds plastic-rod et
  copper-sheet n'ont pas de particularité logistique nouvelle).

**Durée estimée** : 45 min.

---

### Tranche 3 — `circuit-board` (Assembler, 2 inputs de Palier 2)

**Quoi** : premier item Palier 2 qui consomme deux inputs de paliers différents. C'est ici que le
solveur LP est sollicité sur sa capacité à planifier des chaînes à plusieurs branches.

**Fichiers modifiés** :
- `items.json` : ajouter `circuit-board`.
- `recipes.json` : ajouter `circuit-board` (copper-sheet×2 + plastic-rod×4 → circuit-board×1 / 8s).

**Tests impactés** :
- `solver.test.ts` : NOUVEAU TEST IMPORTANT — « 7.5 circuit-board/min → 1 Assembler, copper-sheet=15/min
  (→ 1.5 Constructors = ceil → 2 Constructors), plastic-rod=30/min (→ 2 Refineries) ».
  Ce test vérifie la planification multi-branches. Valeurs à la main :
  - circuit-board : 7.5/min = 1 Assembler (parfait).
  - copper-sheet requis : 2×7.5 = 15/min → 15/10 = 1.5 → ceil → 2 Constructors copper-sheet.
  - plastic-rod requis : 4×7.5 = 30/min → 30/15 = 2.0 → 2 Refineries plastic-rod.
  - concrete pour plastic-rod : 22.5/min per Refinery × 2 = 45/min → ceil(45/15) = 3 Constructors.
  - coal pour plastic-rod : 15/min per Refinery × 2 = 30/min (raw, extractible).
  - copper-ore pour copper-ingot pour copper-sheet : 2 machines × 20/min / 1.0 = 40/min (raw).
  Energie totale : 1×15 + 2×4 + 2×30 + 3×4 = 15 + 8 + 60 + 12 = 95 MW.
- `buildGraphFromSolution.test.ts` : peut nécessiter un ajout de test pour vérifier que le graphe
  multi-branches se génère correctement (les Splitters sont insérés pour le plastic-rod partagé
  entre les 2 Refineries).

**Durée estimée** : 1 h (les arbres multi-branches testent vraiment le solveur).

---

### Tranche 4 — Items Palier 3 : `motor`, `heavy-frame`, `computer`

**Quoi** : les trois items de Palier 3 qui utilisent le Manufacturer et l'Assembler avancé.
Ces items font converger les branches des deux paliers précédents.

**Fichiers modifiés** :
- `items.json` : ajouter `motor`, `heavy-frame`, `computer`.
- `recipes.json` : ajouter les 3 recettes standards.

**Tests impactés** :
- `solver.test.ts` :
  - Test motor : « 5 motor/min → steel=15/min + reinforced-iron-plate=10/min en cascade ».
    Vérification à la main : 5/min × (3/cycle steel) × (60/12) = 5 × 3/5 × ... → raisonner par
    demande : 5 motors/min → besoin steel = 3×5 = 15/min (1.5 Foundry → 2) ;
    reinforced-iron-plate = 2×5 = 10/min (2 Assemblers RIP) ; screws pour RIP = 12×10 = 120/min
    (3 Constructors) ; iron-plates pour RIP = 6×10 = 60/min (3 Constructors) ;
    iron-ore pour steel = 3×15 = 45/min (raw) + coal pour steel = 15/min (raw) ;
    iron-ore pour ingots (pour rod+plate+screw) → solveur LP s'en charge.
  - Test computer : « 2.5 computer/min → 1 Manufacturer, circuit-board=7.5/min, cable=15/min,
    modular-frame=2.5/min ». Vérification : 2.5/min = 1 Manufacturer (parfait : débit nominal 2.5) ;
    circuit-board = 3×2.5 = 7.5/min → 1 Assembler circuit-board (parfait : débit exact 7.5) →
    chaîne complète. C'est le test de cohérence des ratios « élégants ».
- `buildGraphFromSolution.test.ts` : test heavy-frame (4 inputs sur Manufacturer, Splitters multiples).
- `computeFactory.test.ts` : vérifier la propagation de flux sur les plans deep (5 étages).

**Durée estimée** : 1h30 (tests complexes, nombreux nœuds générés).

---

### Tranche 5 — Recettes alternatives nouvelles (3 alts)

**Quoi** : ajouter Alt-Steel-Cast, Alt-Fused-Circuit, Alt-Automated-Motor à `recipes.json`.

**Fichiers modifiés** :
- `recipes.json` : ajouter les 3 nouvelles alts.

**Tests impactés** :
- `solver.test.ts` :
  - Test alt-steel-cast : « 30 steel/min, objectif=machines → Alt-Steel-Cast choisi,
    1 Foundry (30/min direct) vs 3 Foundries standard ». Vérifier machineCount=1 vs 3.
  - Test alt-fused-circuit : « 12 circuit-board/min, objectif=raw-resources →
    Alt-Fused-Circuit (court-circuite copper-sheet) vs standard ».
    Vérifier que l'alt est sélectionnée en mode min raw-resources.
  - Test alt-automated-motor : « motor, objectif=machines → Alt-Automated-Motor (Manufacturer)
    vs standard (Assembler). Vérifier machineCount inférieur avec l'alt ».
- `balance.test.ts` : aucun impact (les alts ne changent pas les formules de balance).

**Durée estimée** : 1 h (1 test par alt, valeurs vérifiables à la main).

---

### Tranche 6 — Milestones étendus (optionnel, post-M10)

**Quoi** : ajouter des milestones de Palier 2/3 dans `balance.ts` si l'humain le valide (voir §6 Q5).
Ces milestones débloquent les nouvelles alts (alt-steel-cast, alt-fused-circuit, alt-automated-motor).

**Fichiers modifiés** :
- `src/game/balance.ts` : ajouter 3 nouvelles `MilestoneDefinition` après M10.

**Tests impactés** :
- `balance.test.ts` : ajouter 3 tests de milestone (atteint au bon seuil, idempotent).
- `progression.test.ts` (si existant) : vérifier que les nouveaux milestones s'enchaînent correctement.

**Durée estimée** : 30 min.

---

### Résumé du plan incrémental

| Tranche | Contenu | Durée est. | Tests ajoutés | Régressions possibles |
|---|---|---|---|---|
| T0 | Vérification baseline | 10 min | 0 | Aucune |
| T1 | coal + steel standard | 30 min | 1 solver | Aucune |
| T2 | copper-sheet + plastic-rod | 45 min | 2 solver | Aucune |
| T3 | circuit-board (multi-branches) | 1h | 2 solver + 1 graph | Aucune si T1+T2 OK |
| T4 | motor + heavy-frame + computer | 1h30 | 4 solver + 2 graph | Aucune si T3 OK |
| T5 | 3 recettes alternatives | 1h | 3 solver | Aucune si T4 OK |
| T6 | Milestones étendus (optionnel) | 30 min | 3 balance | Aucune si T5 OK |

**Durée totale estimée** : ~5 h 25 min de travail incrémental, avec vérification de tests à chaque étape.

---

## 7. Récapitulatif des recettes (format JSON de référence)

Format de référence pour l'implémenteur. Chaque recette est vérifiée à la main.

### Nouvelles recettes standards (Tranches 1-4)

```jsonc
// TRANCHE 1
{ "id": "steel", "name": "Steel Ingot", "alternate": false, "time": 6,
  "producedIn": "foundry",
  "ingredients": [{ "item": "iron-ore", "amountPerCycle": 3 }, { "item": "coal", "amountPerCycle": 1 }],
  "products": [{ "item": "steel", "amountPerCycle": 1 }] }

// TRANCHE 2
{ "id": "copper-sheet", "name": "Copper Sheet", "alternate": false, "time": 6,
  "producedIn": "constructor",
  "ingredients": [{ "item": "copper-ingot", "amountPerCycle": 2 }],
  "products": [{ "item": "copper-sheet", "amountPerCycle": 1 }] }

{ "id": "plastic-rod", "name": "Plastic Rod", "alternate": false, "time": 8,
  "producedIn": "refinery",
  "ingredients": [{ "item": "concrete", "amountPerCycle": 3 }, { "item": "coal", "amountPerCycle": 2 }],
  "products": [{ "item": "plastic-rod", "amountPerCycle": 2 }] }

// TRANCHE 3
{ "id": "circuit-board", "name": "Circuit Board", "alternate": false, "time": 8,
  "producedIn": "assembler",
  "ingredients": [{ "item": "copper-sheet", "amountPerCycle": 2 }, { "item": "plastic-rod", "amountPerCycle": 4 }],
  "products": [{ "item": "circuit-board", "amountPerCycle": 1 }] }

// TRANCHE 4
{ "id": "motor", "name": "Motor", "alternate": false, "time": 12,
  "producedIn": "assembler",
  "ingredients": [{ "item": "steel", "amountPerCycle": 3 }, { "item": "reinforced-iron-plate", "amountPerCycle": 2 }],
  "products": [{ "item": "motor", "amountPerCycle": 1 }] }

{ "id": "heavy-frame", "name": "Heavy Frame", "alternate": false, "time": 20,
  "producedIn": "manufacturer",
  "ingredients": [{ "item": "modular-frame", "amountPerCycle": 5 }, { "item": "steel", "amountPerCycle": 3 }, { "item": "concrete", "amountPerCycle": 5 }],
  "products": [{ "item": "heavy-frame", "amountPerCycle": 1 }] }

{ "id": "computer", "name": "Computer", "alternate": false, "time": 24,
  "producedIn": "manufacturer",
  "ingredients": [{ "item": "circuit-board", "amountPerCycle": 3 }, { "item": "cable", "amountPerCycle": 6 }, { "item": "modular-frame", "amountPerCycle": 1 }],
  "products": [{ "item": "computer", "amountPerCycle": 1 }] }
```

### Nouvelles recettes alternatives (Tranche 5)

```jsonc
{ "id": "alt-steel-cast", "name": "Alternate: Steel Cast", "alternate": true, "time": 4,
  "producedIn": "foundry",
  "ingredients": [{ "item": "iron-ingot", "amountPerCycle": 3 }, { "item": "coal", "amountPerCycle": 1 }],
  "products": [{ "item": "steel", "amountPerCycle": 2 }] }

{ "id": "alt-fused-circuit", "name": "Alternate: Fused Circuit", "alternate": true, "time": 10,
  "producedIn": "assembler",
  "ingredients": [{ "item": "copper-ingot", "amountPerCycle": 4 }, { "item": "plastic-rod", "amountPerCycle": 2 }],
  "products": [{ "item": "circuit-board", "amountPerCycle": 2 }] }

{ "id": "alt-automated-motor", "name": "Alternate: Automated Motor", "alternate": true, "time": 20,
  "producedIn": "manufacturer",
  "ingredients": [{ "item": "steel", "amountPerCycle": 2 }, { "item": "cable", "amountPerCycle": 4 }, { "item": "circuit-board", "amountPerCycle": 2 }],
  "products": [{ "item": "motor", "amountPerCycle": 2 }] }
```

---

## 8. Points de vigilance pour l'implémenteur

### 8.1 Le Refinery a 2 outputs dans le schéma

Le bâtiment `refinery` est défini avec `outputs: 2` dans `buildings.json`. La recette `plastic-rod`
n'utilise qu'un seul output. Deux options :
1. Laisser le second output vide (non connecté dans le graphe) — le plus simple, fonctionne déjà.
2. Ajouter un sous-produit (ex. `coal-gas` fictif, non utilisable) — crée un nœud de sortie non
   connecté, ce qui est visuellement lisible dans l'éditeur React Flow. Ce serait cohérent avec le
   comportement d'une vraie raffinerie.

**Recommandation pour la v1** : option 1 (slot vide). Pas de sous-produit en v1, ça complexifie
inutilement le solveur et les tests. Le second output est simplement ignoré.

### 8.2 Débits non entiers (plastic-rod → concrete)

La recette plastic-rod génère un débit de consommation de concrete à `22.5/min` pour une Refinery
à plein régime. Ce débit non entier est cohérent avec le schéma (le LP travaille en flottants) mais
crée des assertions de test moins propres. Les tests doivent utiliser `toBeCloseTo(22.5, 1)` plutôt
que `toBe(22.5)` pour la robustesse numérique.

### 8.3 Coal partagé entre deux recettes (steel et plastic-rod)

Le charbon entre dans steel (Foundry) ET dans plastic-rod (Refinery). Quand un joueur construit les
deux branches simultanément, le LP doit planifier un flux de charbon partagé. Cela introduit un
nœud Splitter sur la ligne de charbon dans le graphe généré. Le test `buildGraphFromSolution.test.ts`
doit couvrir ce cas (un Splitter coal → [Foundry branch] + [Refinery branch]).

### 8.4 Compatibilité de `isValidConnection` avec les nouvelles recettes

La fonction `isValidConnection` (`src/graph/connection.ts`) vérifie que les handles source/target
sont compatibles en item. Les nouvelles recettes introduisent des items non encore dans le dataset
(coal, copper-sheet, etc.). Cette fonction étant basée sur les données chargées dynamiquement (pas
hardcodée), elle doit fonctionner sans modification. À vérifier manuellement en session de jeu lors
de la première intégration.

---

## 9. Ce qui N'EST PAS dans cette spec (garde-fous)

Les éléments suivants sont **explicitement hors périmètre** de cette v1 élargie :

- **Fluides** (huile brute, carburant) : pas de phase liquide. Le Refinery est utilisé pour les
  polymères solides uniquement (plastic-rod depuis des solides). Introduire un système de tuyaux
  serait une v2+ qui nécessite des changements d'architecture (handles spéciaux pour les fluides).
- **Nucléaire / uranium** : hors scope total.
- **Overclock / power shards** : v2 (non négociable, voir skill satisfactory-planner).
- **Coût logistique dans le LP** : v2 (idem).
- **Renommage des bâtiments/items existants** : aucun. Tout ajout respecte les ids existants.
- **Nouvelle catégorie d'item** : aucune. Tous les nouveaux items restent dans `raw`, `ingot`,
  `part`, ou `fluid` (les nouveaux sont tous `raw` ou `part` ou `ingot` — aucun `fluid`).
- **Nouveau type de bâtiment** : aucun. Le schéma `BuildingCategory` n'est pas étendu.
- **Milestones étendus** : optionnel, tranche 6. Ne pas implémenter avant que les tranches 1-5
  soient validées par des tests verts.

---

## 10. Questions ouvertes et arbitrages pour l'humain (Q-A)

**Q1 — Thème du second output de la Refinery (plastic-rod)**
La Refinery a un second slot d'output (`outputs: 2`) non utilisé par plastic-rod. Doit-on ajouter
un sous-produit fictif (ex. `coal-residue`) ou laisser le slot vide en v1 ? Le sous-produit
enrichirait la simulation (true feel d'une raffinerie) mais complexifierait les tests du solveur.
Recommandation : laisser vide en v1, décider pour la v2.

**Q2 — Nommage de `steel` : `Steel Ingot` (ingot) ou `Steel` (part) ?**
La catégorie `ingot` est cohérente (c'est un alliage fondu). Mais le terme « Steel Ingot » est une
convention Satisfactory. Si l'identité propre du jeu doit diverger, on peut appeler ça `Steel Plate`
(category: part) et changer la recette en sortie laminée. Impact : zéro sur le solveur, change
l'identité visuelle. Arbitrage purement stylistique.

**Q3 — Valeur de `coal` dans le coal-generator de `generators.json`**
Le fichier `generators.json` contient un `coal-generator` qui référence `"fuel": "coal"`. Avec
l'ajout de coal comme item, ce générateur devient cohérent. Mais sa valeur `powerMW: 75` est-elle
calibrée pour la v1 élargie ? 75 MW alimente ~1.4 Manufacturers. C'est cohérent. Aucun changement
requis, mais l'humain peut vouloir revoir cette valeur.

**Q4 — Time de heavy-frame : 16 s (débits fractionnaires) ou 20 s (débits propres) ?**
La spec recommande 20 s pour des débits propres (15/min, 9/min, 15/min). Si l'humain préfère une
valeur plus proche du feel Satisfactory (Heavy Modular Frame ~8 s pour 1/cycle = 7.5/min), on peut
ajuster. L'important est la cohérence interne. La recommandation de 20 s est validée pour les tests.

**Q5 — Milestones post-M10 pour les nouveaux items : créer M11-M13 ou laisser tout accessible après M10 ?**
Option A : les items de Palier 2/3 sont tous accessibles dès que leurs bâtiments sont débloqués
(Foundry débloquée en M5, Manufacturer en M7) — pas de nouveaux milestones. Simple.
Option B : ajouter M11 (`ms-steel-200` → alt-steel-cast), M12 (`ms-circuit-board-75` →
alt-fused-circuit), M13 (`ms-motor-50` → alt-automated-motor). Enrichit la phase Hobby.
Recommandation : Option B, mais seulement en Tranche 6 (après T5 stable).

**Q6 — Calibration AP_RATE pour les items de Palier 3**
La formule `computeApRate` pondère tous les items au même taux (`AP_RATE_PER_ITEM_PER_MIN = 1/3`).
Un computer produit à 2.5/min génère donc 2.5 × 1/3 ≈ 0.83 AP/min — beaucoup moins qu'une usine
de screws (40/min → 13.3 AP/min). Faut-il une pondération par palier (computer vaut 10× un screw) ?
Cela complexifierait la formule mais donnerait plus de sens au score méta. Décision de design à
arbitrer : pondération par palier (plus fidèle au feel) vs taux uniforme (plus simple, déjà codé).

---

*Document de spec généré le 2026-06-10. Aucun fichier de code ni de données modifié par ce document.*
