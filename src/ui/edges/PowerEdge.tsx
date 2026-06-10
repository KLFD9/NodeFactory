import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';

/** Données décoratives portées par un câble énergie (calculées dans GraphCanvas). */
export interface PowerEdgeData extends Record<string, unknown> {
  /** false si le réseau auquel appartient ce câble est sous-alimenté. */
  powered?: boolean;
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

  return (
    <>
      <path d={edgePath} fill="none" stroke="#1c2127" strokeWidth={4} strokeLinecap="round" opacity={0.7} style={{ pointerEvents: 'none' }} />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          ...style,
          stroke: color,
          strokeWidth: 2,
          strokeDasharray: '6 4',
          animation: powered ? undefined : 'belt-flow 0.6s linear infinite',
          filter: powered ? undefined : 'drop-shadow(0 0 3px #ef4444)',
        }}
      />
    </>
  );
}
