import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

/** Données décoratives portées par un câble énergie (calculées dans GraphCanvas). */
export interface PowerEdgeData extends Record<string, unknown> {
  /** false si le réseau auquel appartient ce câble est sous-alimenté. */
  powered?: boolean;
  /** Opacité calculée du câble. */
  opacity?: number;
  /** true si ce câble fait partie du réseau actif (survolé ou sélectionné). */
  active?: boolean;
  /** Démarre le split-au-clic-glisser (insertion d'un poteau sur ce câble). */
  onCableMouseDown?: (e: React.MouseEvent) => void;
}

/**
 * Arête « câble énergie » : style de fil électrique aérien très fin et élégant.
 * Discret pour ne pas surcharger l'usine, avec de petites impulsions lumineuses montrant le transit du courant.
 */
export function PowerEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style, selected } = props;
  const data = props.data as PowerEdgeData | undefined;
  const powered = data?.powered ?? true;
  const opacity = data?.opacity ?? 1.0;
  const active = !!selected;

  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });

  const color = powered ? '#f59e0b' : '#ef4444';

  const filterStyle = powered
    ? (active ? 'drop-shadow(0 0 3px #fbbf24)' : undefined)
    : 'drop-shadow(0 0 3px #ef4444)';

  // De très fines étincelles électriques de courant circulant le long du fil
  const numSparks = 3;
  const sparks = [];
  const sparkDuration = 1.2; // Vitesse de déplacement du courant
  if (powered) {
    for (let i = 0; i < numSparks; i++) {
      const beginOffset = -((i / numSparks) * sparkDuration);
      sparks.push(
        <g key={i} style={{ pointerEvents: 'none' }}>
          <rect
            x="-2.5"
            y="-0.6"
            width="5"
            height="1.2"
            rx="0.6"
            fill="#fffdeb"
            opacity={0.65}
            style={{
              filter: 'drop-shadow(0 0 1px #fbbf24)',
            }}
          />
          <animateMotion
            dur={`${sparkDuration}s`}
            repeatCount="indefinite"
            path={edgePath}
            rotate="auto"
            begin={`${beginOffset}s`}
          />
        </g>
      );
    }
  }

  return (
    <g style={{ opacity, transition: 'opacity 0.22s ease-in-out' }}>
      {/* 0. Path d'interaction invisible et large : capte le clic-glisser pour insérer un poteau. */}
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={16}
        style={{ pointerEvents: 'stroke', cursor: 'crosshair' }}
        onMouseDown={data?.onCableMouseDown}
      />
      {/* 1. Gaine isolante extérieure noire extrêmement fine (aspect câble aérien délicat) */}
      <path
        d={edgePath}
        fill="none"
        stroke="#0d0f12"
        strokeWidth={active ? 3.5 : 2.0}
        strokeLinecap="round"
        style={{ pointerEvents: 'none', transition: 'stroke-width 0.15s ease-in-out' }}
      />
      {/* 2. Cœur conducteur coloré sous-tension */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: color,
          strokeWidth: active ? 1.8 : 0.8,
          strokeDasharray: powered ? (active ? '8 6' : '4 6') : '3 3',
          opacity: active ? 1.0 : 0.8,
          animation: !powered ? 'belt-flow 0.5s linear infinite' : undefined, // Clignotement rouge si en surcharge
          filter: filterStyle,
          transition: 'stroke-width 0.15s ease-in-out, filter 0.15s ease-in-out, stroke-dasharray 0.15s ease-in-out, opacity 0.15s ease-in-out',
        }}
      />

      {/* 3. Décharges lumineuses de courant électrique en mouvement */}
      {sparks}
    </g>
  );
}
