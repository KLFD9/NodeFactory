import { useState } from 'react';
import { useFactoryStore } from '@/store/useFactoryStore';
import type { Building, BuildingCategory } from '@/data/types';

interface CategoryMeta {
  label: string;
  glyph: string;
  chip: string; // fond du carré-icône
  hover: string; // bordure au survol
}

const CATEGORY: Record<BuildingCategory, CategoryMeta> = {
  extraction: { label: 'Extraction', glyph: '⛏', chip: 'bg-amber-500/20 text-amber-300', hover: 'hover:border-amber-500/70' },
  smelting: { label: 'Fonderie', glyph: '🔥', chip: 'bg-orange-500/20 text-orange-300', hover: 'hover:border-orange-500/70' },
  manufacturing: { label: 'Fabrication', glyph: '⚙️', chip: 'bg-sky-500/20 text-sky-300', hover: 'hover:border-sky-500/70' },
  logistics: { label: 'Logistique', glyph: '⇄', chip: 'bg-zinc-500/20 text-zinc-300', hover: 'hover:border-zinc-400/70' },
};

const ORDER: BuildingCategory[] = ['extraction', 'smelting', 'manufacturing', 'logistics'];

/** Données transportées pendant le drag d'un bâtiment vers le canvas. */
export const PALETTE_MIME = 'application/nodefactory-building';

/**
 * Bac à composants (façon bibliothèque de pièces PCB) : bâtiments groupés par catégorie,
 * recherchables, glissables sur le canvas. On glisse → on configure dans l'inspecteur.
 */
export function Palette() {
  const gameData = useFactoryStore((s) => s.gameData);
  const [query, setQuery] = useState('');
  if (!gameData) return <p className="text-xs text-zinc-500">Chargement…</p>;

  const q = query.trim().toLowerCase();
  const matches = (b: Building) => !q || b.name.toLowerCase().includes(q);

  const onDragStart = (e: React.DragEvent, building: Building) => {
    e.dataTransfer.setData(
      PALETTE_MIME,
      JSON.stringify({ buildingId: building.id, category: building.category }),
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-sm font-semibold text-zinc-200">Composants</h2>
        <p className="text-[11px] text-zinc-500">Glisse un bâtiment sur le canvas.</p>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-zinc-500">⌕</span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher…"
          className="w-full rounded-md border border-zinc-700 bg-zinc-900 py-1.5 pl-6 pr-2 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
        />
      </div>

      {ORDER.map((category) => {
        const meta = CATEGORY[category];
        const buildings = gameData.buildings.filter((b) => b.category === category && matches(b));
        if (buildings.length === 0) return null;
        return (
          <div key={category}>
            <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-500">
              <span>{meta.glyph}</span>
              <span>{meta.label}</span>
              <span className="ml-auto rounded bg-zinc-800 px-1.5 text-[10px] text-zinc-500">
                {buildings.length}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              {buildings.map((b) => (
                <div
                  key={b.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, b)}
                  className={[
                    'group flex cursor-grab items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900 px-2 py-1.5',
                    'transition-all hover:-translate-y-0.5 hover:bg-zinc-800/80 hover:shadow-md active:cursor-grabbing',
                    meta.hover,
                  ].join(' ')}
                >
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-sm ${meta.chip}`}>
                    {meta.glyph}
                  </span>
                  <span className="flex-1 truncate text-xs text-zinc-200">{b.name}</span>
                  {b.powerMW > 0 && (
                    <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">{b.powerMW} MW</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {ORDER.every((c) => gameData.buildings.filter((b) => b.category === c && matches(b)).length === 0) && (
        <p className="text-xs text-zinc-600">Aucun composant.</p>
      )}
    </div>
  );
}
