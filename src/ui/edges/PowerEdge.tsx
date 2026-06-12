import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

/** Données décoratives portées par un câble énergie (calculées dans GraphCanvas). */
export interface PowerEdgeData extends Record<string, unknown> {
  /** false si le réseau auquel appartient ce câble est sous-alimenté. */
  powered?: boolean;
  /** Opacité calculée du câble. */
  opacity?: number;
  /** true si ce câble fait partie du réseau actif (survolé ou sélectionné). */
  active?: boolean;
}

/**
 * Arête « câble énergie » : style visuellement distinct des convoyeurs (rouge/ambre,
 * tracé en zigzag léger pour évoquer un fil électrique). Rouge vif + pointillés animés
 * si le réseau est déficitaire (alerte), ambre statique sinon.
 */
export function PowerEdge(props: EdgeProps) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, style } = props;
  const data = props.data as PowerEdgeData | undefined;
  const powered = data?.powered ?? true;
  const opacity = data?.opacity ?? 1.0;
  const active = data?.active ?? false;

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
    ? (active ? 'drop-shadow(0 0 4px #fbbf24) drop-shadow(0 0 8px #f59e0b)' : undefined)
    : (active ? 'drop-shadow(0 0 5px #ef4444) drop-shadow(0 0 10px #ef4444)' : 'drop-shadow(0 0 3px #ef4444)');

  const animationStyle = powered
    ? (active ? 'belt-flow 1.5s linear infinite' : undefined)
    : 'belt-flow 0.6s linear infinite';

  return (
    <g style={{ opacity, transition: 'opacity 0.22s ease-in-out' }}>
      <path
        d={edgePath}
        fill="none"
        stroke="#1c2127"
        strokeWidth={active ? 6 : 4}
        strokeLinecap="round"
        opacity={0.7}
        style={{ pointerEvents: 'none', transition: 'stroke-width 0.22s ease-in-out' }}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: color,
          strokeWidth: active ? 4.0 : 2,
          strokeDasharray: active ? '8 4' : '6 4',
          animation: animationStyle,
          filter: filterStyle,
          transition: 'stroke-width 0.22s ease-in-out, filter 0.22s ease-in-out, stroke-dasharray 0.22s ease-in-out',
        }}
      />
    </g>
  );
}
