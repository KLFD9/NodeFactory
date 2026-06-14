import { useWorldStore } from '@/store/useWorldStore';
import { BOUNDS } from '@/game/biomeMap';

/**
 * Couche « biomes » : dégradés radiaux doux recouvrant toute la carte, dessinés SOUS
 * `ResourceLayer` dans le même `ViewportPortal` (coordonnées flow). Chaque région est un
 * dégradé centré sur sa graine Voronoï qui s'estompe vers 0 ; le chevauchement généreux
 * entre régions voisines crée un fondu continu sans bord net — donne un contexte de zone
 * sans concurrencer le HUD.
 */
export function BiomeLayer() {
  const biomes = useWorldStore((s) => s.biomes);

  if (biomes.length === 0) return null;

  return (
    <svg
      width={BOUNDS * 2}
      height={BOUNDS * 2}
      viewBox={`${-BOUNDS} ${-BOUNDS} ${BOUNDS * 2} ${BOUNDS * 2}`}
      style={{
        position: 'absolute',
        left: -BOUNDS,
        top: -BOUNDS,
        zIndex: -1,
        pointerEvents: 'none',
        overflow: 'visible',
      }}
    >
      <defs>
        {biomes.map((b) => {
          const peak = b.affinity ? 0.08 : 0.05;
          return (
            <radialGradient key={b.id} id={`biome-grad-${b.id}`} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={b.color} stopOpacity={peak} />
              <stop offset="55%" stopColor={b.color} stopOpacity={peak * 0.5} />
              <stop offset="100%" stopColor={b.color} stopOpacity={0} />
            </radialGradient>
          );
        })}
      </defs>
      {biomes.map((b) => (
        <circle key={b.id} cx={b.center[0]} cy={b.center[1]} r={b.radius} fill={`url(#biome-grad-${b.id})`} />
      ))}
    </svg>
  );
}
