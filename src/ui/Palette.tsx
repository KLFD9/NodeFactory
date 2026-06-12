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
  chip: string; // style de la puce d'icône
  color: string; // couleur de bordure au survol
  glow: string; // couleur de glow au survol
}

const CATEGORY: Record<BuildingCategory, CategoryMeta> = {
  extraction: {
    label: 'Extraction',
    icon: ExtractionIcon,
    chip: 'bg-amber-500 text-zinc-950 font-bold',
    color: '#f59e0b',
    glow: 'rgba(245,158,11,0.2)',
  },
  smelting: {
    label: 'Fonderie',
    icon: SmeltingIcon,
    chip: 'bg-orange-500 text-zinc-950 font-bold',
    color: '#f97316',
    glow: 'rgba(249,115,22,0.2)',
  },
  manufacturing: {
    label: 'Fabrication',
    icon: ManufacturingIcon,
    chip: 'bg-sky-400 text-zinc-950 font-bold',
    color: '#38bdf8',
    glow: 'rgba(56,189,248,0.2)',
  },
  logistics: {
    label: 'Logistique',
    icon: LogisticsIcon,
    chip: 'bg-zinc-500 text-zinc-950 font-bold',
    color: '#71717a',
    glow: 'rgba(113,113,122,0.15)',
  },
  power: {
    label: 'Énergie',
    icon: PowerIcon,
    chip: 'bg-emerald-500 text-zinc-950 font-bold',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.2)',
  },
};

const ORDER: BuildingCategory[] = ['extraction', 'smelting', 'manufacturing', 'logistics', 'power'];

const BUILDING_CODES: Record<string, string> = {
  'miner-mk1': 'MNR-01',
  'miner-mk2': 'MNR-02',
  'miner-mk3': 'MNR-03',
  smelter: 'SML-01',
  foundry: 'FND-02',
  constructor: 'CNS-01',
  assembler: 'ASM-02',
  manufacturer: 'MFG-03',
  refinery: 'RFN-04',
  'coal-generator': 'CGN-01',
  'power-pole': 'POL-02',
  splitter: 'SPL-01',
  merger: 'MRG-02',
};

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
      <div className="border-b border-zinc-900 pb-2">
        <h2 className="text-[10px] font-mono font-bold tracking-widest text-zinc-500 uppercase">// SYSTEM_COMPOSANTS</h2>
        <p className="mt-1 text-[11px] text-zinc-400 font-sans leading-relaxed">Glissez un bâtiment sur le canvas pour l'ajouter.</p>
      </div>

      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </span>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="RECHERCHER_BATIMENT..."
          className="w-full rounded border border-zinc-800 bg-zinc-950/40 py-2 pl-9 pr-3 text-xs text-zinc-200 placeholder:text-zinc-650 focus:border-zinc-700 focus:outline-none transition-all shadow-inner font-sans"
        />
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto max-h-[calc(80vh-180px)] pr-1">
        {ORDER.map((category) => {
          const meta = CATEGORY[category];
          const CategoryIcon = meta.icon;
          const buildings = gameData.buildings.filter((b) => b.category === category && matches(b));
          if (buildings.length === 0) return null;
          return (
            <div key={category} className="mb-4">
              <div 
                className="mb-2.5 flex items-center gap-2.5 text-[9px] font-mono font-bold uppercase tracking-wider text-zinc-400 bg-zinc-900/30 border border-zinc-800/40 p-1.5 rounded relative select-none"
                style={{ borderLeft: `3px solid ${meta.color}` }}
              >
                <span className="p-1 rounded bg-zinc-900 border border-zinc-800 text-zinc-350 shrink-0">
                  <CategoryIcon className="h-3 w-3" />
                </span>
                <span>{meta.label}</span>
                <span className="ml-auto rounded-full bg-zinc-900 border border-zinc-800 px-2 py-0.5 text-[9px] font-bold text-zinc-400">
                  QTY: 0{buildings.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {buildings.map((b) => {
                  const cost = BUILDING_COSTS[b.id] ?? 0;
                  const affordable = automationPoints >= cost;
                  const code = BUILDING_CODES[b.id] ?? 'SYS-XX';
                  return (
                  <div
                     key={b.id}
                     draggable
                     onDragStart={(e) => onDragStart(e, b)}
                     title={cost > 0 && !affordable ? `Nécessite ${cost} AP (solde : ${Math.floor(automationPoints)})` : undefined}
                     className={[
                       'group relative flex cursor-grab items-center gap-3 rounded border border-zinc-800/30 bg-zinc-900/25 px-3 py-2.5 nf-interactive-module active:cursor-grabbing overflow-hidden',
                       affordable ? '' : 'opacity-40',
                     ].join(' ')}
                     style={{
                       '--hover-color-border': meta.color,
                       '--hover-color-glow': meta.glow,
                       borderLeft: `3px solid ${meta.color}`,
                     } as React.CSSProperties}
                   >
                     {/* Blueprint background grid */}
                     <div className="absolute inset-0 opacity-15 pointer-events-none nf-node-blueprint" />

                     {/* HUD corner brackets that light up on hover */}
                     <div className="absolute top-0 left-0 w-1.5 h-1.5 border-t border-l border-zinc-800/60 pointer-events-none group-hover:border-[var(--hover-color-border)] transition-colors duration-200" />
                     <div className="absolute top-0 right-0 w-1.5 h-1.5 border-t border-r border-zinc-800/60 pointer-events-none group-hover:border-[var(--hover-color-border)] transition-colors duration-200" />
                     <div className="absolute bottom-0 left-0 w-1.5 h-1.5 border-b border-l border-zinc-800/60 pointer-events-none group-hover:border-[var(--hover-color-border)] transition-colors duration-200" />
                     <div className="absolute bottom-0 right-0 w-1.5 h-1.5 border-b border-r border-zinc-800/60 pointer-events-none group-hover:border-[var(--hover-color-border)] transition-colors duration-200" />

                     {/* Solid colored chip with dark symbol */}
                     <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded border border-zinc-950/20 shadow-md relative z-10 ${meta.chip}`}>
                       <CategoryIcon className="h-4.5 w-4.5" />
                     </span>
                     
                     <div className="flex-1 min-w-0 z-10">
                       {/* Name and serial code row */}
                       <div className="flex items-center justify-between gap-2">
                         <span className="truncate text-xs font-bold text-zinc-200 group-hover:text-zinc-50 transition-colors">
                           {b.name}
                         </span>
                         <span className="shrink-0 font-mono text-[9px] text-zinc-550 group-hover:text-[var(--hover-color-border)] opacity-80 transition-colors">
                           {code}
                         </span>
                       </div>

                       {/* Specs row (AP and MW readouts) */}
                       <div className="mt-1.5 flex items-center gap-2">
                         {cost > 0 && (
                           <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border transition-colors ${
                             affordable 
                               ? 'text-amber-400 bg-amber-500/5 border-amber-500/20' 
                               : 'text-red-400 bg-red-500/5 border-red-500/20'
                           }`}>
                             {cost} AP
                           </span>
                         )}
                         {b.powerMW > 0 && (
                           <span className="flex items-center gap-0.5 text-[9px] font-mono font-bold text-sky-400 bg-sky-500/5 border border-sky-500/20 px-1.5 py-0.5 rounded">
                             <svg className="h-2.5 w-2.5 text-sky-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
                               <path d="M13 10V3L4 14h7v7l9-11h-7z" />
                             </svg>
                             {b.powerMW} MW
                           </span>
                         )}
                       </div>
                     </div>
                  </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {ORDER.every((c) => gameData.buildings.filter((b) => b.category === c && matches(b)).length === 0) && (
        <p className="text-xs text-zinc-650 text-center py-4 font-sans">// Aucun composant trouvé.</p>
      )}
    </div>
  );
}
