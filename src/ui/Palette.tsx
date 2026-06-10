import { useState } from 'react';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useProgressionStore } from '@/store/useProgressionStore';
import { isBuildingUnlocked } from '@/game/progression';
import { BUILDING_COSTS } from '@/game/balance';
import type { Building, BuildingCategory } from '@/data/types';

import { ExtractionIcon, SmeltingIcon, ManufacturingIcon, LogisticsIcon, PowerIcon } from '@/ui/icons';

interface CategoryMeta {
  label: string;
  icon: (props: React.SVGProps<SVGSVGElement>) => JSX.Element;
  chip: string; // fond du carré-icône
  hover: string; // bordure au survol
}const CATEGORY: Record<BuildingCategory, CategoryMeta> = {
  extraction: { label: 'Extraction', icon: ExtractionIcon, chip: 'bg-amber-500/10 text-amber-400 border border-amber-500/20', hover: 'hover:border-amber-500/50 hover:shadow-amber-950/10' },
  smelting: { label: 'Fonderie', icon: SmeltingIcon, chip: 'bg-orange-500/10 text-orange-400 border border-orange-500/20', hover: 'hover:border-orange-500/50 hover:shadow-orange-950/10' },
  manufacturing: { label: 'Fabrication', icon: ManufacturingIcon, chip: 'bg-sky-500/10 text-sky-400 border border-sky-500/20', hover: 'hover:border-sky-500/50 hover:shadow-sky-950/10' },
  logistics: { label: 'Logistique', icon: LogisticsIcon, chip: 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20', hover: 'hover:border-zinc-400/50 hover:shadow-zinc-950/10' },
  power: { label: 'Énergie', icon: PowerIcon, chip: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20', hover: 'hover:border-emerald-500/50 hover:shadow-emerald-950/10' },
};

const ORDER: BuildingCategory[] = ['extraction', 'smelting', 'manufacturing', 'logistics', 'power'];

/** Données transportées pendant le drag d'un bâtiment vers le canvas. */
export const PALETTE_MIME = 'application/nodefactory-building';

/**
 * Bac à composants (façon bibliothèque de pièces PCB) : bâtiments groupés par catégorie,
 * recherchables, glissables sur le canvas. On glisse → on configure dans l'inspecteur.
 */
export function Palette() {
  const gameData = useFactoryStore((s) => s.gameData);
  // Référence stable entre les ticks (le sélecteur ne change que lors d'un déblocage).
  const unlockedBuildings = useProgressionStore((s) => s.unlockedBuildings);
  const automationPoints = useProgressionStore((s) => s.automationPoints);
  const [query, setQuery] = useState('');
  if (!gameData) return <p className="text-xs text-zinc-500">Chargement…</p>;

  const q = query.trim().toLowerCase();
  // Disponible = correspond à la recherche ET débloqué (kit de base + milestones franchis).
  const matches = (b: Building) =>
    (!q || b.name.toLowerCase().includes(q)) && isBuildingUnlocked({ unlockedBuildings }, b.id);

  const onDragStart = (e: React.DragEvent, building: Building) => {
    e.dataTransfer.setData(
        PALETTE_MIME,
        JSON.stringify({ buildingId: building.id, category: building.category }),
    );
    e.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-bold tracking-tight text-zinc-100">Composants</h2>
        <p className="text-[11px] text-zinc-500">Glissez un bâtiment sur le canvas pour l'ajouter.</p>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un composant..."
          className="w-full rounded-xl border border-zinc-800 bg-zinc-950/40 py-2 pl-8 pr-3 text-xs text-zinc-200 placeholder:text-zinc-650 focus:border-zinc-705 focus:ring-1 focus:ring-zinc-800 focus:outline-none transition-all shadow-inner"
        />
      </div>

      <div className="flex flex-col gap-1.5 overflow-y-auto max-h-[calc(100vh-220px)] pr-1">
        {ORDER.map((category) => {
          const meta = CATEGORY[category];
          const CategoryIcon = meta.icon;
          const buildings = gameData.buildings.filter((b) => b.category === category && matches(b));
          if (buildings.length === 0) return null;
          return (
            <div key={category} className="mb-3">
              <div className="mb-2.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-zinc-500">
                <span className="p-1 rounded bg-zinc-800/40 text-zinc-400">
                  <CategoryIcon className="h-3 w-3" />
                </span>
                <span>{meta.label}</span>
                <span className="ml-auto rounded-full bg-zinc-800/80 px-2 py-0.5 text-[9px] font-bold text-zinc-400">
                  {buildings.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {buildings.map((b) => {
                  const cost = BUILDING_COSTS[b.id] ?? 0;
                  const affordable = automationPoints >= cost;
                  return (
                  <div
                     key={b.id}
                     draggable
                     onDragStart={(e) => onDragStart(e, b)}
                     title={cost > 0 && !affordable ? `Nécessite ${cost} AP (solde : ${Math.floor(automationPoints)})` : undefined}
                     className={[
                       'group flex cursor-grab items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900/40 px-3 py-2',
                       'transition-all duration-200 hover:scale-[1.01] hover:bg-zinc-800/45 hover:shadow-lg active:cursor-grabbing',
                       meta.hover,
                       affordable ? '' : 'opacity-50',
                     ].join(' ')}
                   >
                     <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${meta.chip}`}>
                       <CategoryIcon className="h-4 w-4" />
                     </span>
                    <span className="flex-1 truncate text-xs font-semibold text-zinc-200 group-hover:text-zinc-100">{b.name}</span>
                    {cost > 0 && (
                      <span className={`shrink-0 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${affordable ? 'text-amber-400/80 bg-zinc-950/30 border-zinc-800/20' : 'text-red-400 bg-red-950/20 border-red-900/30'}`}>{cost} AP</span>
                    )}
                    {b.powerMW > 0 && (
                      <span className="shrink-0 text-[10px] font-mono font-semibold text-zinc-500 bg-zinc-950/30 px-1.5 py-0.5 rounded border border-zinc-800/20">{b.powerMW} MW</span>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {ORDER.every((c) => gameData.buildings.filter((b) => b.category === c && matches(b)).length === 0) && (
        <p className="text-xs text-zinc-650 text-center py-4">Aucun composant trouvé.</p>
      )}
    </div>
  );
}
