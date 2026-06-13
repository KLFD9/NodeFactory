import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /**
   * Rendu de secours optionnel. Fourni, il remplace l'écran HUD plein écran —
   * utile pour isoler un node de l'usine sans casser tout le canevas.
   */
  fallback?: (error: Error) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Garde-fou global : capture toute erreur de rendu pour qu'un crash d'un
 * composant (ex. un node de l'usine) n'éteigne JAMAIS l'application en écran
 * noir. Affiche un écran de récupération HUD avec une action de rechargement.
 *
 * Sans cette frontière, une seule `ReferenceError` dans MachineNode démonte
 * tout l'arbre React → écran noir, irrécupérable sans vider le cache.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Trace conservée pour le diagnostic (dev + prod).
    console.error('[NodeFactory] Erreur de rendu capturée :', error, info.componentStack);
  }

  private handleReload = () => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const error = this.state.error ?? new Error('Erreur inconnue');
    const message = error.message;

    if (this.props.fallback) return this.props.fallback(error);

    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#0a0e14] p-6 font-mono text-orange-200">
        <div className="max-w-lg rounded-lg border border-orange-500/40 bg-[#12161f] p-8 shadow-[0_0_40px_rgba(249,115,22,0.15)]">
          <div className="mb-4 flex items-center gap-3">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="#f97316"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-7 w-7 shrink-0"
            >
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <h1 className="text-lg font-semibold tracking-wide text-orange-300">
              Interruption du système
            </h1>
          </div>

          <p className="mb-4 text-sm leading-relaxed text-orange-200/80">
            Un composant a rencontré une erreur et l&apos;affichage a été suspendu
            pour protéger ton usine. Ta progression est sauvegardée localement.
          </p>

          <pre className="mb-6 max-h-32 overflow-auto rounded border border-orange-500/20 bg-black/40 p-3 text-xs text-orange-400/70">
            {message}
          </pre>

          <button
            type="button"
            onClick={this.handleReload}
            className="w-full rounded border border-cyan-400/50 bg-cyan-950/60 px-4 py-2.5 text-sm font-semibold tracking-wide text-cyan-300 transition-colors hover:bg-cyan-900/60 hover:text-cyan-200"
          >
            Recharger l&apos;usine
          </button>
        </div>
      </div>
    );
  }
}
