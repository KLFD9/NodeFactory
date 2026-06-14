# Biomes & carte du monde — refonte visuelle + piste d'exploration

**Date** : 2026-06-14 · **Statut** : refonte visuelle FAITE · piste « exploration » = backlog (non commencée)

## 1. Constat de départ

Le rendu des gisements (`ResourceLayer.tsx`) plaçait chaque gisement comme une tache isolée
(dégradé radial + contour pointillé) flottant sur un fond noir vide. Trois problèmes :
1. Le halo/contour pointillé autour de chaque gisement était visuellement intrusif.
2. Les gisements semblaient disposés au hasard, sans cohérence d'ensemble.
3. Au dézoom max (`minZoom`), la carte ne couvrait qu'une petite portion de l'écran —
   le reste était un vide noir.

## 2. Refonte FAITE (2026-06-14)

- **`src/game/biomeMap.ts`** (nouveau, pur) : génère un pavage de Voronoï déterministe
  (mulberry32, même graine que la carte des gisements) sur `[-FIELD, FIELD]²` (déborde
  jusqu'à `BOUNDS = FIELD × 1.25`). Une région par ressource brute reçoit une **affinité**
  (iron-ore, copper-ore, limestone, coal), + 2 régions neutres. Chaque région expose un
  centre + un rayon de dégradé (`× 1.9` la distance moyenne aux sommets de sa cellule, pour
  un chevauchement généreux et continu) et son polygone (utilisé pour le placement biaisé).
- **`src/ui/world/BiomeLayer.tsx`** (nouveau) : dessine ces dégradés radiaux doux
  (opacité 0.05-0.08, décroissante) dans le `ViewportPortal`, sous `ResourceLayer`.
  Pas de bord net — les régions se fondent les unes dans les autres.
- **`src/game/resourceMap.ts`** : le placement d'un gisement tire à 70 % son centre dans
  une région de biome affine à sa ressource (`BIOME_AFFINITY_CHANCE`), sinon fallback
  uniforme sur `FIELD` — clustering thématique sans grille rigide. Le `blobPath` (forme
  organique par gisement) est supprimé, devenu redondant avec le fond biome.
- **`src/ui/world/ResourceLayer.tsx`** : suppression du dégradé radial + contour pointillé
  par gisement (axe « halo »). Les médaillons de pin (cliquables) sont inchangés.
- **`src/ui/GraphCanvas.tsx`** : `minZoom` 0.05 → **0.2** — au dézoom max, la carte
  (`±BOUNDS`) remplit l'écran au lieu de flotter dans un vide.
- **`useWorldStore`** : persiste les biomes (`nf-world` v4, régénère les cartes existantes).

Tests : `src/game/biomeMap.test.ts` (déterminisme, couverture de `FIELD`, affinités),
`src/game/resourceMap.test.ts` mis à jour.

## 3. Piste future — exploration / découverte de nouveaux gisements

**Idée (utilisateur, 2026-06-14)** : à terme, au lieu d'agrandir le monde de départ
(8 gisements sur `±FIELD`), garder cette carte de départ comme « zone connue », et
introduire une mécanique de **recherche/exploration** qui révèle progressivement de
nouveaux gisements au-delà de `FIELD` (zone non biomée actuellement — le noir entre
`BOUNDS` et le bord de vue à `minZoom=0.2`).

Différences avec la recherche **Prospection** déjà prévue
(`2026-06-12-refonte-monnaies.md`, §4 — « révèle les gisements sur toute la minimap ») :
Prospection révèle des gisements **déjà générés mais masqués** dans la zone de départ.
L'idée du 2026-06-14 est complémentaire : générer/révéler de **nouveaux** gisements
**au-delà** de la zone de départ, au fil de la progression (récompense Hobby de fin de
partie, ou prestige — cf. `2026-06-12-backlog-gameplay.md` item 2).

**Pistes d'implémentation (non engagées)** :
- `generateBiomeMap`/`generateResourceMap` acceptent déjà une graine + `rawItemIds` :
  une « ceinture » de biomes/gisements supplémentaire au-delà de `BOUNDS` pourrait être
  générée à la demande (même PRNG, anneau `[BOUNDS, BOUNDS₂]`) plutôt qu'en un bloc —
  garde le coût de génération proportionnel à l'exploration réelle.
- Déclencheur : recherche RP dédiée, ou seuil de score/prestige — à trancher avec
  `game-balance` pour rester cohérent avec le budget de 25 RP (§4-5 de
  `2026-06-12-refonte-monnaies.md`).
- Reste **hors scope** de la refonte visuelle ci-dessus : nécessite une vraie boucle de
  jeu (déclencheur, récompense, UI de découverte) — à cadrer séparément.
