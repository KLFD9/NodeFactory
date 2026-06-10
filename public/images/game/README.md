# Game Assets Directory Structure

This directory contains all the static `.webp` image assets for the Satisfactory 1.0 planner.
Images are served from `/images/game/...` and can be loaded dynamically in the React UI by mapping item and building IDs directly to their paths.

## Structure

```text
public/images/game/
├── items/                  # Item icons
│   ├── raw/                # Raw resources (Ores, Coal, Caterium, Quartz, Sulfur, Calcaire...)
│   ├── ingots/             # Ingots (Iron, Copper, Steel, Caterium, Aluminum...)
│   ├── parts/              # Manufactured parts (Plates, Rods, Screws, Rotors, Motors...)
│   ├── fluids/             # Liquids & Gases (Water, Crude Oil, Nitrogen Gas, Heavy Oil...)
│   └── virtual/            # Virtual concepts (Electricity, etc.)
│
├── buildings/              # Building & Machine icons
│   ├── extraction/         # Miners, Water/Oil extractors
│   ├── smelting/           # Smelters, Foundries
│   ├── manufacturing/      # Constructors, Assemblers, Manufacturers, Refiners, Blenders...
│   ├── logistics/          # Conveyors, Lifts, Splitters, Mergers, Pipelines...
│   └── power/              # Biomass Burners, Coal/Fuel/Nuclear Power Plants...
│
└── ui/                     # UI elements, node purity badges, and layout icons
```

## Naming Conventions
All asset files should follow a lowercase kebab-case format matching the IDs in game data.
Examples:
- `public/images/game/items/raw/iron-ore.webp`
- `public/images/game/items/parts/reinforced-iron-plate.webp`
- `public/images/game/buildings/manufacturing/constructor.webp`

## Loading in the UI (id → path resolver)
The React UI never hard-codes paths inline. It maps a game **id** to an asset path through the
resolver in **`src/ui/assets.tsx`** (`itemImage(id)` + the `<ItemIcon itemId=… />` component, which
renders nothing when no asset exists yet, so the UI falls back to its category SVG icons).

> ⚠️ When a real filename diverges from the kebab-case id, add the mapping in `src/ui/assets.tsx`.
> The raw ores currently shipped use an `ore_` prefix rather than the item id, e.g.:
>
> | item id | file |
> | --- | --- |
> | `iron-ore` | `items/raw/ore_iron.webp` |
> | `copper-ore` | `items/raw/ore_copper.webp` |
> | `limestone` | `items/raw/ore_limestone.webp` |
> | `coal` | `items/raw/ore_coal.webp` |

These ore icons are wired into: resource **deposits & pins** on the map (`ResourceLayer`), miner /
machine **input/output rows** (`MachineNode`), the **Inspector** deposit panel, and the **factory
balance** item rows (`FactorySummaryPanel`).
