import type { NodeProps } from '@xyflow/react';
import type { MachineNode as MachineNodeType } from '@/store/useGraphStore';
import { ErrorBoundary } from '../ErrorBoundary';
import { MachineNode } from './MachineNode';

/**
 * MachineNode isolé dans sa propre frontière d'erreur : si un node plante au
 * rendu, seule sa case bascule en case de secours — le reste de l'usine et le
 * canevas restent intacts. Empêche un crash local de tout démonter.
 */
export function SafeMachineNode(props: NodeProps<MachineNodeType>) {
  return (
    <ErrorBoundary
      fallback={() => (
        <div className="flex h-16 w-16 items-center justify-center rounded border border-red-500/60 bg-red-950/40 font-mono text-[10px] text-red-300">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="#f87171"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-5 w-5"
          >
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        </div>
      )}
    >
      <MachineNode {...props} />
    </ErrorBoundary>
  );
}
