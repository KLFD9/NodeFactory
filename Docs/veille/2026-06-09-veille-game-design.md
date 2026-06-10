# Veille Game Design — NodeFactory
## Rapport n° 1 — 2026-06-09

**Auteur** : agent `game-design-veille`
**Périmètre** : baseline concurrentielle du genre factory-automation + idle/incrémental web ; recommandations pour la prochaine priorité de la roadmap (slice état de jeu + milestones + score d'efficacité).
**Données d'état projet** : la couche jeu n'est PAS encore implémentée. Le game feel visuel (belts animés, barres de cycle, ticker) est livré. `useProgressionStore` n'existe pas encore.

---

## 1. Sources consultées et niveaux de confiance

| Source | URL | Confiance |
|---|---|---|
| Shapez 2 Wiki — Milestones | https://shapez2.wiki.gg/wiki/Milestones | Haute (source officielle du jeu) |
| Satisfactory Wiki officiel — Milestones | https://satisfactory.wiki.gg/wiki/Milestones | Haute (source officielle du jeu) |
| Shapez 2 Early Access Impressions — GamerMatters | https://gamermatters.com/shapez-2-early-access-impressions/ | Haute (critique rédigée) |
| Shapez 2 Review — Cloud Gaming Catalogue (oct. 2024) | https://www.cloudgamingcatalogue.com/2024/10/13/shapez-2-review/ | Haute |
| Mindustry — Tech Tree & Progression (DeepWiki) | https://deepwiki.com/Anuken/Mindustry/3.4-tech-tree-and-progression | Moyenne (doc auto-générée depuis code source) |
| Reactor Incremental — Prestige (Fandom) | https://reactor-incremental.fandom.com/wiki/Prestige | Haute (wiki communautaire établi) |
| Eric Guan — Idle Game Design Principles (Substack) | https://ericguan.substack.com/p/idle-game-design-principles | Haute (article de référence cité dans la communauté) |
| GridInc — Idle Games Best Practices | https://gridinc.co.za/blog/idle-games-best-practices | Moyenne (blog professionnel, à recouper) |
| Missions Zanx — Progression & Scaling in Incremental Games | https://missionszanx.com/guides/progression-and-scaling-in-incremental-games | Moyenne (guide communautaire) |
| Yu-kai Chou — Milestone Unlocks in Gamification | https://yukaichou.com/advanced-gamification/the-power-of-milestone-unlocks-in-gamification-design/ | Haute (auteur Octalysis, recherche citée) |
| GameAnalytics — Mobile Retention Benchmarks 2026 | https://investgame.net/wp-content/uploads/2026/01/2026-01-20-Mobile_retention_benchmarks_2026.pdf | Haute (étude sectorielle) |
| Solsten — True Drivers of D1/D7/D30 Retention | https://solsten.io/blog/d1-d7-d30-retention-in-gaming | Haute |
| Satisfactory-Calculator (SCIM) | https://satisfactory-calculator.com/ | Haute (outil de référence communauté Satisfactory) |
| Satisfactory Labs | https://satislabs.com/ | Haute |
| Factorio Space Age — Feedback Design | https://forums.factorio.com/viewtopic.php?t=123092 | Haute (forum officiel) |
| Factorio Space Age Research System | https://wiki.factorio.com/Research | Haute (wiki officiel) |
| Melvor Idle — Offline Progression | https://wiki.melvoridle.com/w/Offline_Progression | Haute (wiki officiel) |
| Apptrove — How to Make an Idle Game | https://apptrove.com/how-to-make-an-idle-game/ | Moyenne |
| Gamigion — Idle Game Engagement 2025 | https://www.gamigion.com/idle/ | Moyenne |

---

## 2. Analyse des concurrents

### 2.1 Shapez 2 (factory-puzzle, Steam/PC)

**Mécaniques de progression et de déblocage.**
Shapez 2 structure son avancement autour de deux couches : les **Milestones** (objectifs primaires qui exigent de livrer de grandes quantités de shapes d'une complexité croissante à l'élévateur spatial) et les **Tasks** (défis secondaires qui génèrent des points de recherche). Les milestones débloquent de nouvelles machines, des upgrades de capacité et des accès à de nouveaux scénarios. Les quantités exigées vont de quelques centaines de shapes en début de jeu à 90 000 à 150 000 en late game, avec un ajustement par difficulté. Le système à cinq scénarios (Operator Badge, Regular, Hard, Insane, Hexagonal) crée une véritable courbe de progression rejouable.

**Ce qui fonctionne.**
La dualité Milestones / Tasks est efficace : les milestones donnent un horizon long, les tasks fournissent des victoires à court terme. Le joueur a toujours quelque chose à accomplir à portée de main. L'outil shape-builder est très visuel : les progrès vers un déblocage sont tangibles car le joueur voit les pièces prendre forme sur le convoyeur.

**Ce qui ne fonctionne pas.**
Le principal point faible signalé par les critiques est l'onboarding : le tutoriel forcé dure environ cinq heures avant d'atteindre le vrai jeu. La contrainte d'espace autour du vortex central crée des murs de progression imprévus dès l'early game, ce qui force à démanteler les lignes précédentes — une frustration que le shapez original évitait grâce à l'espace infini. Certains mécanismes clés (convoyeurs multi-étages sur les nœuds d'extraction) ne sont pas expliqués et causent une confusion prolongée.

**Pertinence pour NodeFactory.** Le modèle dual Milestone / Task est directement transposable. Le problème d'onboarding de Shapez 2 (trop long) est exactement l'anti-pattern à éviter pour la phase Hook (0-30 min) du skill game-design. NodeFactory doit atteindre le "wow, ça tourne tout seul" en moins de 5 minutes, non 5 heures.

---

### 2.2 Satisfactory 1.0 (factory-builder AAA, Coffee Stain Studios)

**Mécaniques de progression.**
Le système de milestones de Satisfactory est la référence du genre : 9 tiers, chacun contenant plusieurs milestones qui demandent des ressources physiquement produites (déposées au HUB Terminal). Les premiers tiers demandent des Iron Rods et du Concrete ; les derniers demandent des Supercomputers et des Turbo Motors. Chaque milestone débloque nouveaux bâtiments, recettes et équipements. Le Space Elevator fait office de "boss de fin de tier" : ses phases débloquent les tiers suivants. L'interface HUB montre l'objectif, les ressources requises, la récompense, et l'état de progression avant la soumission — le joueur sait toujours ce qu'il vise.

**Ce qui fonctionne.**
La lisibilité de l'objectif courant est excellente. Les ressources physiquement convoyées au HUB créent un rituel satisfaisant. L'ordre de déblocage est soigneusement équilibré : chaque tier introduit une nouvelle complexité logistique juste après que le joueur a maîtrisé la précédente. Coffee Stain a révisé les coûts entre Tiers 3 et 8 pour la 1.0 précisément pour fluidifier ce pacing.

**Ce qui ne fonctionne pas / ce que la communauté signale.**
Le tutoriel de départ est considéré insuffisant : Coffee Stain a explicitement demandé à la communauté des idées pour le reformuler en 2025. Le passage du Tier 0 au Tier 1 (premier palier entre l'onboarding et le vrai jeu) reste un filtre qui perd des joueurs. Il n'y a pas de boucle idle/offline : si tu n'es pas devant l'écran, rien ne se passe.

**Pertinence pour NodeFactory.** Le modèle de feedback HUB (voir l'objectif, voir la progression, voir la récompense) est la bonne référence pour concevoir la barre de progression visible avant atteinte du milestone. NodeFactory bénéficie d'un avantage structurel : le LP calcule automatiquement la meilleure façon d'atteindre l'objectif, là où Satisfactory laisse le joueur le découvrir seul.

---

### 2.3 Factorio + Space Age DLC (factory-builder de référence, Wube Software)

**Mécaniques de progression.**
Factorio a opéré avec Space Age (oct. 2024) un changement structurant : des technologies ne sont plus seulement débloquées par la consommation de science packs, mais par la satisfaction de conditions concrètes (craft de 10 plaques de cuivre → déblocage electronique ; craft de 50 plaques de fer → générateur à vapeur). Cette mécanique de "déblocage par accomplissement" plutôt que "déblocage par monnaie" est l'évolution la plus significative de Factorio sur le plan du game design depuis plusieurs années.

**Ce qui fonctionne.**
Le modèle condition → déblocage immédiat sans monnaie intermédiaire est le plus direct psychologiquement. La queue de recherche (cliquer shift+gauche pour enchaîner les prérequis) supprime la friction cognitive entre deux déblocages. L'arbre tech est un outil de planification autant qu'un système de progression.

**Ce qui ne fonctionne pas.**
Le premier mur de Factorio reste l'automatisation de la science rouge : sans aide, le joueur continue à crafter à la main et la recherche ralentit brutalement. C'est un progress wall bien documenté. Pour les nouveaux joueurs, la complexité de l'arbre tech est écrasante sans accompagnement.

**Pertinence pour NodeFactory.** Le mécanisme "craft X de cet item → déblocage" est plus simple et plus lisible que "accumule Y monnaie méta → achète déblocage", mais les deux peuvent coexister. Dans NodeFactory, produire 500 Iron Rods à 30/min pendant quelques minutes avant de débloquer l'Assembler est un modèle parfaitement adapté à la vérité de simulation (un Iron Rod produit = un Iron Rod réel, jamais falsifié).

---

### 2.4 Mindustry (factory + tower defense, open source)

**Mécaniques de progression.**
Mindustry utilise un arbre tech en DAG (graphe acyclique dirigé) : chaque TechNode représente un bâtiment ou une unité qui requiert son parent pour être débloqué. Certains déblocages se font automatiquement sans action du joueur. En mode campagne, les secteurs capturés servent de bases de ressources pour alimenter des flux de production qui progressent vers les objectifs suivants. Les **Schematics** (plans d'usine copiables/importables) permettent de sauvegarder et partager des configurations.

**Ce qui fonctionne.**
Les schematics sont un ancêtre du prestige blueprint que NodeFactory vise : repartir d'un schéma pré-configuré est naturel dans Mindustry. La combinaison factory + tower defense crée un réengagement urgent (si l'usine est attaquée, il faut agir). Le fait que le jeu soit entièrement open source a favorisé un modding prolifique qui maintient la longévité.

**Ce qui ne fonctionne pas.**
Mindustry n'a pas de boucle idle : sans la pression des vagues d'ennemis, la progression factory seule n'est pas auto-suffisante pour le réengagement. Le système de progression en campagne est mal expliqué ; les nouveaux joueurs se perdent souvent entre le mode campagne et le mode sandbox.

**Pertinence pour NodeFactory.** Le modèle schematic de Mindustry valide la direction prestige/blueprint du skill game-design. La mécanique de déblocage automatique (sans action explicite) pour les premiers items est une bonne pratique pour l'onboarding : les premières recettes de base peuvent être disponibles d'emblée, sans forcer un premier milestone trop tôt.

---

### 2.5 Reactor Incremental (idle web, Kongregate)

**Mécaniques de progression et prestige.**
Reactor Incremental est un jeu idle web de référence : le joueur place des composants de réacteur nucléaire sur une grille, gère la chaleur (risque de fusion si accumulation), et génère de l'énergie. Le prestige donne des Exotic Particles (monnaie permanente) en échange de la perte de l'argent, de la puissance et des upgrades courants. Ces particules débloquent de nouveaux composants et des améliorations permanentes. La règle de timing conseillée : attendre d'avoir 51 particules avant le premier prestige (1 pour débloquer + 50 pour le premier tier d'upgrades).

**Ce qui fonctionne.**
La grille de placement crée un système de gestion de l'espace qui donne un sentiment de propriété de son installation. Le risque de fusion (gestion de la chaleur) maintient une tension active même dans un jeu idle. L'offline progress est natif : le réacteur continue de produire hors connexion. Le seuil minimum avant prestige (51 particules) évite le syndrome du "prestige trop tôt inutile" — un anti-pattern classique qui frustre les débutants.

**Ce qui ne fonctionne pas.**
La courbe d'apprentissage de la gestion thermique est abrupte sans documentation in-game. L'interface est fonctionnelle mais peu engageante visuellement — aucun "game feel" comparable à ce que NodeFactory a déjà livré.

**Pertinence pour NodeFactory.** Le timing de prestige explicite (seuil minimum visible) est une bonne pratique à adapter : si NodeFactory introduit un prestige, montrer clairement "Prestige disponible à partir de X points d'efficacité" évite la confusion. La monnaie d'Exotic Particles (isolée, permanente, non affectée par le reset) est le modèle exact de la monnaie méta que le skill game-design vise.

---

### 2.6 Factory Idle / Planetary Factory Idle (idle web, itch.io)

**Mécaniques.**
Ces jeux idle factory web (Grest Games, Nyrio) proposent une progression par tâches ("Produire 80 items") avec upgrades de vitesse, robots et qualité de pièces. La progression est guidée par des objectifs discrets plutôt que par un arbre libre. Offline progress est standard. La monétisation via pub est omniprésente.

**Ce qui fonctionne.**
Les tâches guidées (objectifs précis à compléter) réduisent la paralysie du choix : le joueur sait toujours quoi faire ensuite. Les upgrades segmentés (LINE SPEED, ROBOTS, SUPPLY, PARTS QUALITY) créent une illusion de choix stratégique sans vraie complexité.

**Ce qui ne fonctionne pas.**
La profondeur est limitée : après quelques cycles d'upgrades, le gameplay devient répétitif sans couche d'optimisation. L'absence de solveur rend ces jeux plats pour les joueurs cherchant de vraie profondeur. La monétisation agressive (ads every few minutes) est exactement l'anti-pattern que NodeFactory doit éviter.

**Pertinence pour NodeFactory.** Ces jeux confirment que le modèle "tâche guidée" fonctionne pour l'onboarding et la phase Habit, mais qu'il faut une couche de profondeur réelle (le solveur LP de NodeFactory) pour la phase Hobby. Le différenciateur de NodeFactory est précisément ce que ces jeux n'ont pas.

---

### 2.7 Unnamed Space Idle (idle multi-systèmes, Steam Early Access 2024)

**Mécaniques.**
Unnamed Space Idle propose plus de 10 systèmes distincts (Compute, Synth, Void Device, Prestige, Reactor, Research, Warp) qui se débloquent progressivement, chacun avec ses propres mécaniques. L'arbre Warp est "une arborescence massive de mises à niveau". Le jeu est en Early Access avec ~2 mois de contenu à rythme moyen. La richesse systémique est son argument principal.

**Ce qui fonctionne.**
Le déploiement progressif de systèmes distincts maintient la nouveauté sur des semaines : chaque système débloqé est une nouvelle couche d'apprentissage. L'unfolding (le jeu "se déploie") est un pattern de longévité puissant.

**Ce qui ne fonctionne pas.**
La complexité peut devenir accablante (10+ systèmes simultanés). Sans filtrage progressif intelligent, le tableau de bord devient illisible.

**Pertinence pour NodeFactory.** Le pattern "système qui se déploie" confirme que les systèmes de jeu de NodeFactory (milestones → badges d'état → score d'efficacité → idle/offline → prestige) doivent s'introduire séquentiellement — exactement l'ordre de la roadmap du skill game-design. Ne pas tout mettre visible d'emblée.

---

## 3. Bonnes pratiques synthétisées du genre

### 3.1 Pacing des déblocages (milestones)

Les sources convergent sur plusieurs principes :

**Le milestone est un événement, pas un nombre.** La distinction cruciale (Yu-kai Chou, confirmée par l'expérience Shapez 2 et Satisfactory) : une barre de progression qui monte est un nombre ; l'atteinte du milestone est un événement qui génère un pic de dopamine. La barre doit être visible avant l'atteinte (forward visibility), pas cachée. Les jeux qui cachent les récompenses futures "aplatissent la courbe d'engagement immédiatement".

**La visibilité de la prochaine récompense est aussi importante que la récompense actuelle.** Les apps qui combinent milestone unlocks + streaks atteignent 40 à 60 % de DAU supérieurs à celles n'utilisant qu'un seul mécanisme (Plotline mobile gamification research, cité par Yu-kai Chou — à confirmer sur une seconde source indépendante). Le principe "teased next unlock" (voir le prochain milestone grisé mais lisible) est un standard du genre.

**Durée relative constante entre milestones.** Chaque milestone devrait prendre "approximativement le même temps relatif", non un temps absolu croissant exponentiel brut. La différence est subtile mais importante : un milestone précoce peut prendre 5 minutes, un tardif peut prendre 5 heures, mais les deux devraient représenter la même "charge cognitive relative" pour le joueur de ce stade.

**Déblocages fonctionnels, pas cosmétiques.** Une recette alternative qui change la stratégie de production vaut infiniment plus qu'un badge de couleur. Le skill game-design l'énonce déjà ; les sources extérieures le confirment.

### 3.2 Horloges de réengagement exponentielles

Le pattern le plus cité et le plus confirmé (Eric Guan, cité dans le skill game-design) : plusieurs producteurs/collections à fenêtres temporelles croissantes. L'exemple canonique :
- Collecteur A : plafonne toutes les 20 minutes → pour le joueur en session active.
- Collecteur B : plafonne toutes les 5 heures → pour le joueur qui revient en soirée.
- Collecteur C : plafonne tous les 2 jours → pour le joueur qui revient après le week-end.

Chaque type de joueur réussit quelque chose à sa fréquence. L'échec tout-ou-rien est évité. Ce pattern est directement inscrit dans le skill game-design de NodeFactory (§ Couche idle/offline, principes chiffrés).

### 3.3 Offline progress

Le standard industriel 2024-2025 : progression offline plafonnée (Melvor Idle : 24 h ; le skill game-design de NodeFactory : 4 h — plus conservateur, ce qui est un bon choix pour éviter que les joueurs pénètrés de "pas besoin de jouer" ne désengagent). Les points clés :

- Popup récap à la reconnexion : montrer ce qui a été produit hors ligne. Transparent et positif.
- Ne pas simuler les événements granulaires hors ligne : calculer le delta-temps sur le taux moyen. NodeFactory l'a déjà théorisé correctement.
- Le plafond drive le retour : si l'offline est plafonné à 4 h, un joueur qui optimise son engagement revient toutes les 4 h (au lieu d'oublier le jeu pour 3 jours).
- Ratio cible : 60 % du gain par mécanique idle, 40 % par engagement actif (GridInc). Ce ratio doit guider l'étalonnage de la monnaie méta.

### 3.4 Prestige / New Game+

Mécaniques confirmées par Reactor Incremental, Unnamed Space Idle, et les meilleures pratiques du genre :
- Prestige = reset contre multiplicateurs permanents isolés (ne sont jamais perdus lors des resets suivants).
- Règle du seuil minimum : montrer clairement à partir de quand le prestige est rentable (évite le "prestige trop tôt" qui punit et frustre le joueur).
- Signification narrative du reset : les meilleurs jeux de 2024-2025 traitent le prestige comme un "événement narratif" (réinitialisation civilisationnelle, redémarrage cosmologique) plutôt qu'une formalité mécanique. Dans NodeFactory, le prestige blueprint (repartir sur une factory pré-configurée) est déjà une narrative : "repartir avec votre savoir d'optimisation gravé dans un plan".

### 3.5 Onboarding "zéro friction"

Les sources convergent sur un critère : **"I get it and I want more" avant la fin de la cinquième minute.** Melvor Idle est cité comme référence (satisfaisant dans les 10 premières minutes). Les anti-patterns documentés :
- Tutoriel forcé trop long (Shapez 2 : 5 h de tutorial → critique universelle).
- Complexité exposée d'emblée (Unnamed Space Idle si mal ordonnancé).
- Mur de progression précoce avant que le joueur ait une seule victoire (Factorio early game sans guidance).

La bonne pratique : **zéro friction pour le débutant → une victoire immédiate → complexity disclosure progressive.** Les systèmes avancés doivent être cachés jusqu'à ce que le joueur en ait besoin.

### 3.6 Anti-patterns documentés

| Anti-pattern | Manifestation dans le genre | Impact |
|---|---|---|
| Tutoriel-mur | Shapez 2 (5 h), Factorio (science rouge manuelle) | Abandon early game, D1 retention tuée |
| Prestige trop tôt sans guidane | Reactor Incremental si le joueur ne lit pas le wiki | Frustration, sentiment de régression inutile |
| Dark patterns de monétisation | Factory Idle web (ads every 3 min, pay-to-skip) | Incompatible avec l'identité NodeFactory |
| Nombres tricheurs | Idle mobile (gonfle les chiffres pour impressionner) | Rejet immédiat du public Satisfactory (vérité de simulation) |
| Mur d'attente sans horloges multiples | Un seul timer → soit trop fréquent (ennui), soit trop rare (abandon) | D7 retention effondrée |
| Récompense cosmétique uniquement | Titres, badges sans impact gameplay | Engagement superficiel, "rien à faire" |
| Progression cachée | Prochain déblocage invisible → courbe d'engagement plate | Perte du "hook" de rétention |

---

## 4. Positionnement différenciateur de NodeFactory

### 4.1 Aucun concurrent n'a de solveur LP comme mécanique de score

Les outils existants (SCIM, Satisfactory Labs, satisfactorytools) sont des **calculateurs** : ils calculent correctement, mais n'exposent pas l'optimisation comme une mécanique de jeu. Satisfactory Labs permet de comparer des alternatives et d'ajuster les clock speeds, mais c'est un outil de planification — pas une boucle de score. NodeFactory est le seul projet qui transforme les objectifs LP (min ressources brutes / machines / énergie) en **score comparable et progressif**.

Les jeux concurrents (Shapez 2, Factorio, Mindustry, Satisfactory) font optimiser à la main par essais-erreurs. NodeFactory **optimise pour toi**, puis expose le résultat comme un score d'efficacité. C'est un différenciateur non dilué.

### 4.2 Leaderboards et classements

Aucun des concurrents directs n'expose un score d'efficacité comparable sur une même cible. La mécanique leaderboard (classement des factories sur une même cible : "60 Iron Rods/min, qui utilise le moins de ressources brutes ?") n'existe nulle part dans le genre — ni comme outil ni comme jeu. C'est une terra incognita qui crée à la fois un argument de rétention Hobby (méta-jeu de l'expert) et un argument de marketing viral (partage de solutions optimisées).

### 4.3 Garde-fou confirmé par la veille : ne pas mentir sur la simulation

Le public Satisfactory est documenté comme particulièrement sensible à la cohérence des données. Les outils SCIM et Satisfactory Tools sont plébiscités précisément pour leur fidélité aux valeurs du jeu. Les jeux idle qui gonflent les chiffres pour impressionner sont rejetés par ce public. La règle d'or du skill game-design ("La vérité de simulation est sacrée ; le jeu se construit autour d'elle") est confirmée par l'analyse concurrentielle.

---

## 5. Recommandations actionnables — priorisées

### REC-01 : Milestone Visible-Avant-Atteinte avec prochain milestone grisé
**Système roadmap** : Système 2 — Milestones de production
**Impact** : Rétention D1/D7 (Hook + Habit) — très élevé
**Coût** : S (petit)
**Sources** : Yu-kai Chou (milestone = événement, pas nombre) ; Shapez 2 Wiki (structure milestone/task) ; satisfaction Satisfactory HUB UI
**Confiance** : Haute — recoupée sur 3 sources

**Description.** Afficher la barre de progression d'un milestone AVANT son atteinte est le pattern de rétention le plus fiable et le moins coûteux à implémenter. La barre doit montrer : item visé, quantité produite / quantité cible, icône de la récompense (recette alternative déjà visible mais grisée). Le prochain milestone non encore accessible doit être visible mais grisé ("Produire 500 Iron Rods pour débloquer l'Assembler" est lisible même si loin). Cette double visibilité (milestone courant + prochain) est ce qui différencie les jeux à bon engagement du genre.

**Adaptation NodeFactory.** La monnaie méta est le débit réel (jamais falsifié). La barre de progression affiche `itemsProduced / milestoneTarget` calculé depuis l'accumulateur existant dans `FactorySummaryPanel`. Le composant existe déjà dans l'UI ; il faut l'alimenter depuis `useProgressionStore` (à créer). Conforme au garde-fou "pas de faux nombres".

**Anti-pattern à éviter.** Ne pas cacher la récompense ("surprise reward"). La visibilité de la récompense avant l'atteinte est la clé ; la surprise diminue l'engagement selon les sources.

---

### REC-02 : Slice d'état de jeu minimale avec monnaie méta dérivée du débit réel
**Système roadmap** : Système 1 — Slice d'état de jeu (`src/game/` + `useProgressionStore`)
**Impact** : Fondation de toute la couche jeu — critique
**Coût** : M (moyen)
**Sources** : Eric Guan (production rate × dt), GridInc best practices, skill game-design (§ Architecture)
**Confiance** : Haute

**Description.** Avant d'implémenter les milestones, la slice d'état minimal doit exister : `useProgressionStore` avec (a) un accumulateur par item (`itemsProduced : Map<itemId, number>`) incrémenté par l'intervalle 250 ms existant dans `FactorySummaryPanel`, (b) un tableau de milestones avec `{ id, itemId, target, reached, unlocksRecipeId }`, (c) un `lastSeen` pour le offline. Aucune logique de jeu dans les composants React. `src/game/` = logique pure testable en isolation (milestone atteint au bon seuil, idempotent, ne se redéclenche pas).

**Adaptation NodeFactory.** Le ticker accumulateur de `FactorySummaryPanel` (250 ms, `rate × dtMin`) est la source de données parfaite. Il faut juste le brancher sur `useProgressionStore.addProduction(itemId, delta)` au lieu de le garder local au panneau. Conforme au découplage du skill : `game` lit `graph`/`store`, jamais l'inverse.

---

### REC-03 : Horloges de réengagement exponentielles avec 2 producteurs initiaux
**Système roadmap** : Système 5 — Idle/offline
**Impact** : Rétention D7/D30 (Habit → Hobby) — élevé
**Coût** : M (moyen)
**Sources** : Eric Guan (cows 20 min / creameries 5 h / shipyards 2 j) ; skill game-design (§ Couche idle/offline)
**Confiance** : Haute — deux sources convergentes dont une très détaillée

**Description.** Implémenter dès la couche idle deux producteurs de monnaie méta à fenêtres différentes. Proposition concrète pour NodeFactory :
- **Producteur court** (plafonne à ~20 min) : chaque machine tournant à > 80 % d'efficacité génère des "Research Points" à un rythme rapide. Cible les sessions actives.
- **Producteur long** (plafonne à ~4 h) : la production totale de l'usine depuis la dernière visite génère des "Expansion Credits" en delta-time. Cible les joueurs qui reviennent en soirée. Le plafond 4 h est déjà celui du skill game-design — et du plafond offline.

Ces deux monnaies sont distinctes de l'accumulateur de production (qui déclenche les milestones). Elles alimentent une économie d'upgrades séparée (acheter l'accès à la visualisation du score d'efficacité, débloquer un slot d'audit bottleneck, etc.).

**Adaptation NodeFactory.** Conforme au garde-fou "pas de monétisation prédatrice" : ces monnaies ne s'achètent pas avec de l'argent réel. Conforme à "pas de faux nombres" : les Research Points sont dérivés d'un taux réel (efficacité calculée par le solveur LP).

---

### REC-04 : Badges d'état machine + panneau d'audit bottleneck comme "tutoriel permanent"
**Système roadmap** : Système 3 — Badges d'état machine et audit bottleneck
**Impact** : Onboarding + rétention Habit — élevé
**Coût** : S/M (entre petit et moyen)
**Sources** : Factorio Space Age (condition → feedback immédiat) ; Shapez 2 critique (absence de tooltip = confusion prolongée) ; Solsten D1/D7 drivers
**Confiance** : Haute

**Description.** Les badges d'état machine (vert/orange/rouge) déjà prévus dans la roadmap remplissent un double rôle : signal d'alerte opérationnel ET tutoriel passif. Un badge rouge sur une machine indique un problème ; survoler le badge affiche "Machine sous-alimentée : reçoit 15/min, attend 30/min" — exactement ce qu'un tooltip aurait expliqué dans un tutoriel. Le panneau d'audit bottleneck (liste des machines < 80 % + cause) est le guide en temps réel qui remplace le tutoriel.

**Adaptation NodeFactory.** L'efficacité réelle/théorique est déjà calculée dans `NodeFlowContext` (ratio `actualInput / theoreticalInput`). Les badges d'état peuvent être dérivés directement depuis ce contexte. Le panneau d'audit lit la même source. Conforme au découplage : pas de logique UI dans le composant, le composant lit `NodeFlowContext`.

**Anti-pattern évité.** Shapez 2 a perdu des joueurs faute d'un tooltip sur le placement multi-étage. NodeFactory, avec des badges + audit, n'expose jamais le joueur à une situation de "blocage silencieux".

---

### REC-05 : Score d'efficacité LP exposé comme indicateur visible et comparable
**Système roadmap** : Système 4 — Score d'efficacité
**Impact** : Rétention Hobby (experts) — très élevé sur la durée
**Coût** : S (petit — le LP calcule déjà les 3 objectifs)
**Sources** : Analyse compétitive (aucun concurrent n'a ce score) ; Satisfactory Labs (compare alternatives mais sans score normalisé) ; skill game-design (différenciateur principal)
**Confiance** : Haute — le différenciateur est confirmé comme vide laissé par l'écosystème

**Description.** Le solveur LP calcule déjà trois objectifs : min ressources brutes, min machines, min énergie. Exposer ces trois valeurs comme un "score d'efficacité normalisé" est un coût S. La formule proposée :
- Score ressources = `targetActual / resourcesOptimal` (1.0 = solution LP parfaite, > 1.0 = factory sous-optimale)
- Score machines = `machinesActual / machinesOptimal`
- Score énergie = `energyActual / energyOptimal`
- Score global = moyenne pondérée (à calibrer par l'agent game-balance)

Ce score, affiché dans `FactorySummaryPanel` avec un code couleur (vert si ≥ 0.95, amber si 0.8-0.95, rouge si < 0.8), donne un feedback permanent d'optimisation. À terme, il alimente un leaderboard par cible.

**Adaptation NodeFactory.** La `SolveResult` contient déjà les valeurs brutes. La normalisation requiert de résoudre le LP trois fois (min ressources, min machines, min énergie) pour obtenir les optima de référence, puis de comparer la solution courante. Conforme au garde-fou "LP comme score" : le score EST le LP, pas une approximation.

**Différenciateur validé.** SCIM, Satisfactory Labs, Satisfactory Tools sont des calculateurs sans score. NodeFactory est le premier outil/jeu à exposer l'optimisation LP comme indicateur de progression. C'est ici que les experts passent des centaines d'heures.

---

### REC-06 : Onboarding par "premier milestone automatique" plutôt que par tutoriel
**Système roadmap** : Système 1 (onboarding) + Système 2 (premier milestone)
**Impact** : Rétention D1 (Hook) — critique
**Coût** : S (petit)
**Sources** : Melvor Idle (10 min to satisfied) ; GridInc best practices ; Factorio Space Age ("craft X → débloque Y")
**Confiance** : Haute — recoupée sur 3 sources

**Description.** Au premier lancement, NodeFactory doit déclencher automatiquement un premier milestone invisible : "Ton usine vient de produire ses premiers Iron Ingots → la recette Assembler est maintenant visible". Le joueur n'a pas eu besoin de lire une page de tutoriel. La production a déclenché une récompense. Ce pattern ("vous venez de débloquer X par vos actions") est la version la plus douce et la moins intrusive du système de milestone — il ne demande rien, il récompense l'exploration naturelle.

**Adaptation NodeFactory.** Les premières recettes de base sont disponibles d'emblée (comme dans Mindustry où certains contenus s'auto-débloquent). Le premier milestone réel demande un petit seuil accessible en < 5 minutes de session (par exemple : 60 Iron Ingots produits → Assembler débloqué). La barre de progression (REC-01) est visible dès le démarrage. Conforme au garde-fou onboarding "wow en moins de 30 min".

---

### REC-07 : Prestige blueprint avec seuil minimum visible (implémentation différée)
**Système roadmap** : Système 6 — Prestige / Blueprints
**Impact** : Rétention D30+ (Hobby) — élevé sur la durée
**Coût** : L (large — implémentation différée, non urgente)
**Sources** : Reactor Incremental (51 exotic particles minimum avant premier prestige) ; skill game-design (§ Prestige/blueprints) ; pattern Unnamed Space Idle (10+ systèmes qui se déploient)
**Confiance** : Haute

**Description.** Quand le prestige sera implémenté, la règle de Reactor Incremental s'applique : afficher le seuil minimum de rentabilité du prestige AVANT que le joueur ne puisse le déclencher. "Prestige disponible. Vous gagneriez X blueprints. Recommandé à partir de Y points d'efficacité cumulés." Cette transparence évite la frustration du joueur qui prestige trop tôt et se retrouve avec un avantage négligeable. Le blueprint résultant (usine pré-configurée importable) est le "New Game+" de NodeFactory : l'early game qui prenait une heure se refait en 5 minutes avec le blueprint du run précédent. Cela récompense le savoir d'optimisation accumulé — sans faux nombres, sans dark pattern.

**Note pour l'implémentation.** Ne pas commencer avant que les systèmes 1 à 5 soient solides et testés. Le prestige sans une boucle de jeu complète est une dette de design.

---

## 6. Ce qui a changé chez les concurrents depuis la dernière veille

Pas de rapport antérieur (premier rapport de veille). Ce paragraphe servira de point de comparaison pour les prochains rapports.

**Faits notables depuis le dernier audit (pré-2026-06-09) :**
- Factorio Space Age (oct. 2024) a introduit le modèle "condition → déblocage" sans monnaie intermédiaire, marquant une évolution significative dans le design de l'arbre tech des jeux factory.
- Shapez 2 est sorti en 1.0 début 2026 (après 98 % de reviews positives en Early Access) et a continué d'ajouter des scenarios (Hexagonal, Insane avec cristaux internes et géométries creuses). La critique du tutoriel trop long reste ouverte.
- Satisfactory 1.0 est sorti fin 2024, suivi du Update 1.1 (support manette) ; Coffee Stain a explicitement demandé à la communauté de l'aide pour reformuler le tutoriel en 2025.
- Unnamed Space Idle (Steam Early Access 2024) valide le pattern "10+ systèmes qui se déploient progressivement" comme modèle de longévité.

---

## 7. Questions ouvertes et arbitrages pour l'humain

1. **Calibration de la monnaie méta.** Quelle est l'unité de la monnaie méta ? "Research Points" dérivés de l'efficacité machine ? "Production Credits" proportionnels au débit total ? Ou une seule monnaie unifiée ? Le skill game-design mentionne "monnaie méta" sans la nommer ni la quantifier. L'agent `game-balance` doit chiffrer les courbes avant l'implémentation.

2. **Nombre de milestones et arbre des déblocages.** Le skill game-design donne un exemple (500 Iron Rods → Assembler) mais ne définit pas l'arbre complet. Faut-il un arbre linéaire (simple, une seule voie) ou un arbre à embranchements (choix stratégiques) pour le MVP de la couche jeu ? L'arbre linéaire est plus sûr pour un premier slice.

3. **Seuil du premier milestone.** Le premier milestone doit être atteignable en < 5 minutes de session (REC-06). Quelle valeur concrète ? Avec les données mock actuelles, combien de temps faut-il pour produire 60 Iron Ingots à 30/min ? (2 minutes — trop court ?) ou 200 Iron Ingots (6 min 40 s) ?

4. **Score d'efficacité : 3 dimensions ou une seule ?** Exposer trois scores (ressources, machines, énergie) ou un seul score pondéré ? La version pondérée est plus simple à lire mais masque l'information. La version à 3 dimensions est plus fidèle au LP mais peut intimider le débutant. Progressive disclosure possible : score global affiché, détail en mode avancé.

5. **Persistance locale avant couche jeu.** Les tests 11-12 (persistance + partage URL) ne sont pas encore faits. Faut-il les implémenter avant la slice d'état de jeu (pour que `useProgressionStore` soit persisté dès le départ) ou en parallèle ? Le risque de les différer : l'état de jeu n'est pas sauvegardé si le joueur ferme l'onglet, ce qui tue le réengagement Habit.

6. **PWA/Service Worker.** Le skill satisfactory-planner ne mentionne pas la PWA. Pour un jeu idle web, l'installabilité et le fonctionnement offline sont des leviers de rétention D7/D30 significatifs (le joueur peut installer l'app et recevoir des notifications de plafond atteint). Vaut-il la peine d'ajouter un service worker au MVP de la couche jeu, ou le différer en v2 ?

7. **Leaderboard : opt-in ou absent au MVP ?** La mécanique de score d'efficacité (REC-05) est 100 % client. Un leaderboard réel nécessite un backend (hors scope : "pas de backend"). Une alternative compatible : leaderboard local (comparer ses propres sessions) ou leaderboard social par partage URL (la factory la plus efficace que tu partages). Arbitrage à trancher.

---

*Rapport généré le 2026-06-09. Prochaine veille recommandée : dans 4 à 6 semaines, ou dès qu'un concurrent majeur publie une mise à jour significative.*
