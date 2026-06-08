import { useFactoryStore } from '@/store/useFactoryStore';
import type { Building, BuildingCategory } from '@/data/types';

const CATEGORY_LABELS: Record<BuildingCategory, string> = {
  extraction: 'Extraction',
  smelting: 'Fonderie',
  manufacturing: 'Fabrication',
  logistics: 'Logistique',
};

const CATEGORY_ORDER: BuildingCategory[] = ['extraction', 'smelting', 'manufacturing', 'logistics'];

/** Données transportées pendant le drag d'un bâtiment vers le canvas. */
export const PALETTE_MIME = 'application/nodefactory-building';

/**
 * Palette de l'éditeur : les bâtiments groupés par catégorie. On glisse une carte
 * sur le canvas pour poser un node, puis on le configure dans l'inspecteur.
 */
export function Palette() {
  const gameData = useFactoryStore((s) => s.gameData);
  if (!gameData) return <p className="text-xs text-zinc-500">Chargement…</p>;

  const byCategory = (category: BuildingCategory): Building[] =>
    gameData.buildings.filter((b) => b.category === category);

  const onDragStart = (e: React.DragEvent, building: Building) => {
    e.dataTransfer.setData(
      PALETTE_MIME,
      JSON.stringify({ buildingId: building.id, category: building.category }),
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-zinc-300">Bâtiments</h2>
      <p className="-mt-2 text-[11px] text-zinc-500">
        Glisse un bâtiment sur le canvas, puis clique-le pour le configurer.
      </p>
      {CATEGORY_ORDER.map((category) => {
        const buildings = byCategory(category);
        if (buildings.length === 0) return null;
        return (
          <div key={category}>
            <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              {CATEGORY_LABELS[category]}
            </div>
            <div className="flex flex-col gap-1.5">
              {buildings.map((b) => (
                <div
                  key={b.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, b)}
                  className="cursor-grab rounded-md border border-zinc-700 bg-zinc-900 px-2.5 py-1.5 text-xs text-zinc-200 hover:border-zinc-500 active:cursor-grabbing"
                  title={`${b.powerMW} MW`}
                >
                  {b.name}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
