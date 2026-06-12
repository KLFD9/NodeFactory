import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useWorldStore } from '@/store/useWorldStore';
import { RESOURCE_COLOR } from './ResourceLayer';

/**
 * Gisements sur la MiniMap — sans eux, la carte miniature ne montre que les machines
 * et le joueur se perd à chercher les ressources.
 *
 * La MiniMap React Flow ne rend que les nodes ; on injecte donc nos taches directement
 * dans son <svg> via un portal : son viewBox est exprimé en coordonnées flow, les
 * centres/rayons des gisements y sont utilisables tels quels. Les taches hors du
 * viewBox courant (calculé sur nodes + viewport) sont simplement clippées.
 */
export function MiniMapDeposits() {
  const deposits = useWorldStore((s) => s.deposits);
  const [svg, setSvg] = useState<SVGSVGElement | null>(null);

  useEffect(() => {
    // La MiniMap est montée en même temps que nous : on accroche son SVG après coup.
    const el = document.querySelector<SVGSVGElement>('.react-flow__minimap svg');
    setSvg(el);
  }, []);

  if (!svg || deposits.length === 0) return null;

  return createPortal(
    <g pointerEvents="none">
      {deposits.map((d) => (
        <circle
          key={d.id}
          cx={d.x}
          cy={d.y}
          r={d.radius}
          fill={RESOURCE_COLOR[d.resourceId] ?? '#f59e0b'}
          fillOpacity={0.4}
          stroke={RESOURCE_COLOR[d.resourceId] ?? '#f59e0b'}
          strokeOpacity={0.8}
          strokeWidth={8}
        />
      ))}
    </g>,
    svg,
  );
}
