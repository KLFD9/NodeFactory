import { useMemo } from 'react';
import { useFactoryStore } from '@/store/useFactoryStore';
import { useGraphStore, type MinerBinding } from '@/store/useGraphStore';
import { useWorldStore } from '@/store/useWorldStore';
import { PURITY_MULTIPLIER, type Purity } from '@/data/types';
import { ExtractionIcon } from '@/ui/icons';
import { ItemIcon, itemImage } from '@/ui/assets';

/** Couleur par ressource brute (fond du blob + accent du pin). Fallback ambre. */
export const RESOURCE_COLOR: Record<string, string> = {
  'iron-ore': '#f59e0b', // ambre rouille
  'copper-ore': '#fb7185', // cuivre/rose
  limestone: '#d6c39a', // calcaire beige
  coal: '#71717a', // charbon gris
};

const PURITY_LABEL: Record<Purity, string> = {
  impure: 'Impur',
  normal: 'Normal',
  pure: 'Pur',
};

/** Nombre de pips allumés (sur 3) par pureté — base du petit indicateur visuel sur le pin. */
const PURITY_LEVEL: Record<Purity, number> = { impure: 1, normal: 2, pure: 3 };

function color(resourceId: string): string {
  return RESOURCE_COLOR[resourceId] ?? '#f59e0b';
}

/**
 * Couche « monde » dessinée DANS le viewport React Flow (via `<ViewportPortal>` côté canvas) :
 * les gisements (blobs organiques) et leurs pins vivent en coordonnées flow, donc pannent/zooment
 * avec les nodes sans en être. Les blobs sont décoratifs (`pointer-events:none`) ; chaque pin LIBRE
 * est cliquable et pose un mineur déjà lié (clic-sur-pin).
 */
export function ResourceLayer() {
  const gameData = useFactoryStore((s) => s.gameData);
  const deposits = useWorldStore((s) => s.deposits);
  const nodes = useGraphStore((s) => s.nodes);
  const placeMinerOnPin = useGraphStore((s) => s.placeMinerOnPin);

  // Pins occupés (dérivés des nodes) → set de clés "depositId:pinIndex".
  const occupied = useMemo(() => {
    const set = new Set<string>();
    for (const n of nodes) {
      if (n.data.depositId != null && n.data.pinIndex != null) {
        set.add(`${n.data.depositId}:${n.data.pinIndex}`);
      }
    }
    return set;
  }, [nodes]);

  const itemName = (id: string) => gameData?.items.find((i) => i.id === id)?.name ?? id;

  return (
    <>
      {deposits.map((d) => {
        const c = color(d.resourceId);
        return (
          <div key={d.id} style={{ position: 'absolute', left: 0, top: 0, zIndex: 0 }}>
            {/* Filigrane d'ore au CENTRE — seulement si aucun pin n'y est (gisement à 2 pins).
                Pour un gisement à 1 pin, le médaillon est déjà au centre et porte l'icône. */}
            {d.pins.length !== 1 && itemImage(d.resourceId) && (
              <ItemIcon
                itemId={d.resourceId}
                size={72}
                style={{
                  position: 'absolute',
                  left: d.x,
                  top: d.y,
                  transform: 'translate(-50%, -50%)',
                  pointerEvents: 'none',
                  opacity: 0.1,
                  filter: `grayscale(0.5) saturate(0.7) drop-shadow(0 0 18px ${c})`,
                  mixBlendMode: 'screen',
                }}
              />
            )}


            {/* Pins d'extraction */}
            {d.pins.map((pin, i) => {
              const isOccupied = occupied.has(`${d.id}:${i}`);
              const binding: MinerBinding = {
                depositId: d.id,
                pinIndex: i,
                resourceId: d.resourceId,
                purity: d.purity,
                x: pin.x,
                y: pin.y,
              };
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isOccupied}
                  // `nopan`/`nodrag` + stopPropagation : empêchent React Flow de capter le
                  // pointeur (pan/sélection) et donc d'avaler le clic sur le pin.
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!isOccupied) placeMinerOnPin(binding);
                  }}
                  title={
                    isOccupied
                      ? `Pin occupé — ${itemName(d.resourceId)}`
                      : `Poser un mineur sur ce pin — ${itemName(d.resourceId)} (${PURITY_LABEL[d.purity]})`
                  }
                  className={[
                    'nopan nodrag group flex flex-col items-center gap-1.5 border-0 bg-transparent p-0 transition-transform',
                    isOccupied ? 'cursor-default' : 'cursor-pointer hover:scale-[1.08]',
                  ].join(' ')}
                  style={{
                    position: 'absolute',
                    left: pin.x,
                    top: pin.y,
                    transform: 'translate(-50%, -50%)',
                    zIndex: 1,
                  }}
                >
                  {/* Médaillon circulaire : halo couleur-ressource + badge « + » si libre. */}
                  <span className="relative block">
                    <span
                      className="flex items-center justify-center rounded-full transition-all group-hover:brightness-110"
                      style={{
                        width: 46,
                        height: 46,
                        background: `radial-gradient(circle at 50% 32%, ${c}33, rgba(9,9,11,0.92))`,
                        border: `1.5px solid ${isOccupied ? '#3f3f46' : c}`,
                        boxShadow: isOccupied ? 'none' : `0 0 0 4px ${c}1f, 0 0 16px ${c}66`,
                        opacity: isOccupied ? 0.45 : 1,
                      }}
                    >
                      {itemImage(d.resourceId) ? (
                        <ItemIcon itemId={d.resourceId} size={28} />
                      ) : (
                        <ExtractionIcon className="h-4 w-4" style={{ color: c }} />
                      )}
                    </span>
                    {!isOccupied && (
                      <span
                        className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full text-[11px] font-black leading-none text-zinc-950 shadow-md transition-transform group-hover:scale-110"
                        style={{ background: c }}
                        aria-hidden
                      >
                        +
                      </span>
                    )}
                  </span>
                  {/* Label + indicateur de pureté en pastille discrète sous le médaillon. */}
                  <span
                    className="flex items-center gap-1.5 rounded-full bg-zinc-950/70 px-2 py-0.5 backdrop-blur-sm"
                    style={{ opacity: isOccupied ? 0.7 : 1 }}
                  >
                    <span
                      className="text-[9px] font-bold uppercase tracking-wide"
                      style={{ color: isOccupied ? '#a1a1aa' : c }}
                    >
                      {itemName(d.resourceId)}
                    </span>
                    {/* Pips de pureté : 1/2/3 losanges allumés = Impur/Normal/Pur. */}
                    <span
                      className="flex items-center gap-[2px]"
                      title={`Pureté : ${PURITY_LABEL[d.purity]} · ×${PURITY_MULTIPLIER[d.purity]}`}
                    >
                      {[0, 1, 2].map((k) => {
                        const on = k < PURITY_LEVEL[d.purity];
                        return (
                          <span
                            key={k}
                            className="block h-[5px] w-[5px] rotate-45 rounded-[1px]"
                            style={{
                              background: on ? c : 'transparent',
                              border: `1px solid ${c}`,
                              opacity: isOccupied ? 0.6 : on ? 1 : 0.35,
                            }}
                          />
                        );
                      })}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
    </>
  );
}
