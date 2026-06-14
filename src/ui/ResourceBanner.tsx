import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore } from '@/store/useGraphStore';
import { useProgressionStore } from '@/store/useProgressionStore';
import { computeFactory } from '@/graph/computeFactory';
import { stockCapForRate, STOCK_BUFFER_MINUTES } from '@/game/balance';
import { ItemIcon } from '@/ui/assets';

/** Formate un nombre cumulé façon idle-game : 1234 → "1.2K". */
function fmtAcc(n: number): string {
  if (n < 1_000) return Math.floor(n).toString();
  if (n < 1_000_000) return `${(n / 1_000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

const CATEGORY_COLOR: Record<string, string> = {
  raw: '#f59e0b',
  ingot: '#f97316',
};

/**
 * Total de production cumulée (tous items confondus), façon idle-game : « le nombre qui
 * monte EST le jeu » (Cookie Clicker / Universal Paperclips), appliqué honnêtement — c'est
 * la somme réelle des débits simulés. Count-up GSAP continu, en tête de bannière mais
 * visuellement secondaire aux badges d'état des machines.
 */
function CumulativeTotal({ total }: { total: number }) {
  const [display, setDisplay] = useState(total);
  const valueRef = useRef({ v: total });

  useEffect(() => {
    const obj = valueRef.current;
    const tween = gsap.to(obj, {
      v: total,
      duration: 0.9,
      ease: 'none',
      onUpdate: () => setDisplay(obj.v),
    });
    return () => {
      tween.kill();
    };
  }, [total]);

  return (
    <div
      className="flex h-10 shrink-0 select-none items-center gap-2 rounded-lg border border-zinc-800/60 bg-zinc-900/30 px-2.5"
      title="Total d'unités produites depuis le début de la partie (toutes ressources)."
      data-testid="cumulative-total"
    >
      <span className="font-mono text-[9px] font-bold uppercase tracking-widest text-zinc-500">Σ&nbsp;PROD</span>
      <span className="font-mono text-sm font-bold tabular-nums tracking-wide text-amber-300/90">
        {fmtAcc(display)}
      </span>
    </div>
  );
}

interface ResourceBadgeProps {
  itemId: string;
  itemName: string;
  category: string;
  total: number;
  rate: number;
  prodRate: number;
  consRate: number;
  stock: number;
  stockCap: number;
}

/** Pastille d'une ressource : affiche le STOCK D'ENTREPÔT (la réserve que les contrats consomment), avec compteur animé (GSAP) et indicateur de débit net. */
function ResourceBadge({ itemId, itemName, category, total, rate, prodRate, consRate, stock, stockCap }: ResourceBadgeProps) {
  const [display, setDisplay] = useState(stock);
  const valueRef = useRef({ v: stock });
  const color = CATEGORY_COLOR[category] ?? '#a1a1aa';

  useEffect(() => {
    const obj = valueRef.current;
    const tween = gsap.to(obj, {
      v: stock,
      duration: 0.6,
      ease: 'power2.out',
      onUpdate: () => setDisplay(obj.v),
    });
    return () => {
      tween.kill();
    };
  }, [stock]);

  const rateRounded = Math.round(rate * 10) / 10;
  const rateColor = rateRounded > 0.05 ? 'text-emerald-400' : rateRounded < -0.05 ? 'text-red-400' : 'text-zinc-500';
  const rateSign = rateRounded > 0.05 ? '+' : '';

  const prodRounded = Math.round(prodRate * 10) / 10;
  const consRounded = Math.round(consRate * 10) / 10;

  return (
    <div className="group relative flex h-10 items-center gap-2 rounded-lg border border-zinc-800/80 bg-zinc-900/40 px-2.5 shadow-md transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-900/80 cursor-default select-none">
      
      {/* Cadre de l'icône agrandi */}
      <div 
        className="flex items-center justify-center p-0.5 rounded border bg-zinc-950/60 transition-transform duration-150 group-hover:scale-105"
        style={{ borderColor: `${color}40` }}
      >
        <ItemIcon itemId={itemId} size={22} />
      </div>

      {/* Stock d'entrepôt — c'est CE chiffre que les contrats consomment */}
      <span className="font-mono text-xs font-bold tabular-nums text-zinc-200 tracking-wide">
        {fmtAcc(display)}
        <span className="text-zinc-500">/{fmtAcc(stockCap)}</span>
      </span>

      {/* Popover flottant (Tooltip) survol */}
      <div className="pointer-events-none absolute top-12 left-1/2 z-50 flex w-48 -translate-x-1/2 flex-col gap-1.5 rounded-lg border border-zinc-800 bg-zinc-950/95 p-3 shadow-2xl backdrop-blur-md opacity-0 scale-95 transition-all duration-200 origin-top group-hover:opacity-100 group-hover:scale-100 group-hover:translate-y-[4px]">
        {/* Liseret industriel de catégorie */}
        <div 
          className="absolute top-0 left-1/2 h-0.5 w-8 -translate-x-1/2" 
          style={{ backgroundColor: color }}
        />
        
        <div className="font-mono text-[10px] font-bold uppercase tracking-widest text-zinc-400">
          {itemName}
        </div>

        <div className="h-px bg-zinc-800/60 my-0.5" />

        <p className="text-[9px] leading-snug text-zinc-500">
          Réserve livrable aux contrats, alimentée par la production. Plafond ≈ {STOCK_BUFFER_MINUTES} min de débit courant.
        </p>

        <div className="flex items-center justify-between font-mono text-[11px] font-semibold tabular-nums">
          <span className="text-zinc-500">Total produit (à vie) :</span>
          <span className="text-zinc-300">{fmtAcc(total)}</span>
        </div>

        <div className="flex items-center justify-between font-mono text-[11px] font-semibold tabular-nums">
          <span className="text-zinc-500">Flux net :</span>
          <span className={rateColor}>
            {rateRounded !== 0 ? `${rateSign}${rateRounded}/m` : '0/m'}
          </span>
        </div>

        {(prodRounded > 0 || consRounded > 0) && (
          <div className="flex flex-col gap-0.5 border-t border-zinc-900 pt-1 mt-0.5 font-mono text-[10px] tabular-nums text-zinc-400">
            {prodRounded > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-emerald-500/80 flex items-center gap-1">▲ Production</span>
                <span className="text-zinc-300 font-semibold">{prodRounded}/m</span>
              </div>
            )}
            {consRounded > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-red-500/80 flex items-center gap-1">▼ Consommation</span>
                <span className="text-zinc-300 font-semibold">{consRounded}/m</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Bannière flottante des ressources cumulées (minerais + lingots), façon idle-game.
 * Affiche un compteur animé par ressource. Le survol affiche un tooltip détaillé.
 */
export function ResourceBanner() {
  const gameData = useFactoryStore((s) => s.gameData);
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const cumulativeProduced = useProgressionStore((s) => s.cumulativeProduced);
  const itemStock = useProgressionStore((s) => s.itemStock);

  if (!gameData) return null;

  const relevant = gameData.items.filter(
    (item) => (item.category === 'raw' || item.category === 'ingot') && (cumulativeProduced[item.id] ?? 0) > 0,
  );
  if (relevant.length === 0) return null;

  // Total tous items confondus (rods, plates… inclus) — le compteur « qui monte ».
  const grandTotal = Object.values(cumulativeProduced).reduce((s, v) => s + v, 0);

  const summary = nodes.length > 0 ? computeFactory(nodes, edges, gameData) : null;
  const productionById = new Map(summary?.production.map((f) => [f.itemId, f.ratePerMin]) ?? []);
  const consumptionById = new Map(summary?.consumption.map((f) => [f.itemId, f.ratePerMin]) ?? []);

  return (
    <div className="relative flex items-center gap-1.5 rounded-xl border border-zinc-800/80 bg-zinc-950/70 p-1.5 shadow-xl backdrop-blur-md max-w-full">
      {/* Lignes d'accent HUD industrielles */}
      <div className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-orange-500/80 rounded" />
      <div className="absolute right-0 top-1.5 bottom-1.5 w-0.5 bg-orange-500/80 rounded" />

      {/* Grille de badges en wrap sans scroll horizontal */}
      <div className="flex flex-wrap items-center gap-1.5 px-2">
        <CumulativeTotal total={grandTotal} />
        {relevant.map((item) => {
          const prodRate = productionById.get(item.id) ?? 0;
          const consRate = consumptionById.get(item.id) ?? 0;
          const rate = prodRate - consRate;
          return (
            <ResourceBadge
              key={item.id}
              itemId={item.id}
              itemName={item.name}
              category={item.category}
              total={cumulativeProduced[item.id] ?? 0}
              rate={rate}
              prodRate={prodRate}
              consRate={consRate}
              stock={itemStock[item.id] ?? 0}
              stockCap={stockCapForRate(prodRate)}
            />
          );
        })}
      </div>
    </div>
  );
}


