import type { MachineState } from '@/graph/machineStatus';

const STATE_ACCENT: Record<MachineState, string> = {
  nominal: '#10b981',
  starved: '#f59e0b',
  blocked: '#ef4444',
  unpowered: '#52525b',
};

interface CoalGeneratorIllustrationProps {
  state: MachineState;
  powered: boolean;
  /** Durée d'une rotation de turbine ('0s' = arrêtée). */
  turbineSpeed: string;
}

/**
 * Illustration vectorielle 2.5D (vue isométrique industrielle) du générateur charbon :
 * tapis convoyeur incliné, trémie d'admission, chaudière à grille ardente vacillante,
 * ventilateurs horizontaux inclinés rotatifs, tuyauterie haute pression, alternateur en cuivre,
 * haute cheminée d'échappement qui dépasse du cadre avec fumée animée, et raccordement au poteau électrique.
 */
export function CoalGeneratorIllustration({ state, powered, turbineSpeed }: CoalGeneratorIllustrationProps) {
  const accent = STATE_ACCENT[state];
  const active = powered && state === 'nominal';
  const turbineActive = powered && (state === 'nominal' || state === 'starved');
  const isStarved = state === 'starved';

  return (
    <svg
      viewBox="0 0 280 120"
      className="absolute inset-0 h-full w-full overflow-visible"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        {/* Filtres de flou pour la fumée et le halo du feu */}
        <filter id="cg-blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
        <filter id="cg-fire-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="5" />
        </filter>

        {/* Dégradés pour les métaux et volumes */}
        <linearGradient id="cg-plate-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1e202b" />
          <stop offset="100%" stopColor="#111218" />
        </linearGradient>

        <linearGradient id="cg-side-left-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#14151c" />
          <stop offset="100%" stopColor="#090a0d" />
        </linearGradient>

        <linearGradient id="cg-side-right-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1c1d26" />
          <stop offset="100%" stopColor="#0c0d12" />
        </linearGradient>

        <linearGradient id="cg-furnace-left" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#374151" />
          <stop offset="100%" stopColor="#1f2937" />
        </linearGradient>

        <linearGradient id="cg-furnace-right" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#242b35" />
          <stop offset="100%" stopColor="#12161c" />
        </linearGradient>

        <linearGradient id="cg-copper-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#b45309" />
          <stop offset="50%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#78350f" />
        </linearGradient>

        {/* Tuyauteries */}
        <linearGradient id="cg-pipe-hot" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ea580c" />
          <stop offset="50%" stopColor="#fb923c" />
          <stop offset="100%" stopColor="#9a3412" />
        </linearGradient>

        <linearGradient id="cg-pipe-cool" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#0284c7" />
          <stop offset="50%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#075985" />
        </linearGradient>

        <linearGradient id="cg-chimney-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#2c313d" />
          <stop offset="35%" stopColor="#3d4454" />
          <stop offset="70%" stopColor="#1f222b" />
          <stop offset="100%" stopColor="#111218" />
        </linearGradient>

        {/* Lueur du foyer */}
        <radialGradient id="cg-fire-radial" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fffbeb" stopOpacity="1" />
          <stop offset="35%" stopColor="#f97316" stopOpacity="0.8" />
          <stop offset="75%" stopColor="#b91c1c" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#450a0a" stopOpacity="0" />
        </radialGradient>

        <radialGradient id="cg-fire-glow-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </radialGradient>
      </defs>

      <style>{`
        @keyframes cg-flicker {
          0%, 100% { opacity: 0.8; filter: brightness(0.9) contrast(1.0); }
          50% { opacity: 1.0; filter: brightness(1.25) contrast(1.15); }
        }
        .cg-fire-active {
          animation: cg-flicker 0.12s infinite alternate;
        }

        @keyframes cg-smoke-float {
          0% {
            transform: translate(0, 0) scale(0.4);
            opacity: 0;
          }
          12% {
            opacity: var(--smoke-opacity, 0.4);
          }
          100% {
            transform: translate(12px, -35px) scale(1.6);
            opacity: 0;
          }
        }
        .cg-smoke-1 {
          transform-origin: 230px -20px;
          animation: cg-smoke-float 2s ease-out infinite;
          animation-delay: 0s;
          --smoke-opacity: 0.45;
        }
        .cg-smoke-2 {
          transform-origin: 230px -20px;
          animation: cg-smoke-float 2s ease-out infinite;
          animation-delay: 0.65s;
          --smoke-opacity: 0.35;
        }
        .cg-smoke-3 {
          transform-origin: 230px -20px;
          animation: cg-smoke-float 2s ease-out infinite;
          animation-delay: 1.3s;
          --smoke-opacity: 0.25;
        }

        @media (prefers-reduced-motion: reduce) {
          .cg-fire-active,
          .cg-smoke-1,
          .cg-smoke-2,
          .cg-smoke-3 {
            animation: none !important;
          }
          .cg-smoke-1 { opacity: 0.2; transform: translate(3px, -8px) scale(1); }
          .cg-smoke-2 { opacity: 0.1; transform: translate(6px, -16px) scale(1.2); }
          .cg-smoke-3 { display: none; }
        }
      `}</style>

      {/* 1. SOCLE ISOMÉTRIQUE FLOTTANT (BASE PLATFORM) */}
      {/* Face supérieure (Top) */}
      <polygon points="30,72 140,42 250,72 140,102" fill="url(#cg-plate-grad)" stroke="#27272a" strokeWidth="1" />
      
      {/* Rainures métalliques et plaques isométriques */}
      <line x1="85" y1="57" x2="195" y2="87" stroke="#0e0f14" strokeWidth="0.8" strokeOpacity="0.6" />
      <line x1="85" y1="87" x2="195" y2="57" stroke="#0e0f14" strokeWidth="0.8" strokeOpacity="0.6" />

      {/* Rivets aux coins du socle */}
      {[[35, 72], [140, 45], [245, 72], [140, 99]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="1.5" fill="#3f3f46" stroke="#090a0f" strokeWidth="0.5" />
      ))}

      {/* Face latérale avant-gauche (Front-Left Side) */}
      <polygon points="30,72 140,102 140,109 30,79" fill="url(#cg-side-left-grad)" stroke="#18181b" strokeWidth="0.8" />
      
      {/* Face latérale avant-droite (Front-Right Side) */}
      <polygon points="140,102 250,72 250,79 140,109" fill="url(#cg-side-right-grad)" stroke="#18181b" strokeWidth="0.8" />

      {/* Liserés de sécurité colorés (accent de la machine) sur la tranche supérieure du socle */}
      <line x1="31" y1="72.5" x2="139" y2="102" stroke={accent} strokeWidth="0.8" strokeOpacity="0.4" />
      <line x1="141" y1="102" x2="249" y2="72.5" stroke={accent} strokeWidth="0.8" strokeOpacity="0.4" />


      {/* 2. CONVOYEUR & TAPIS DE CHARBON (GAUCHE - HORS CADRE) */}
      {/* Support structurel du tapis convoyeur extérieur */}
      <line x1="-10" y1="92" x2="-10" y2="112" stroke="#27272a" strokeWidth="1.6" />
      <line x1="12" y1="83" x2="12" y2="104" stroke="#27272a" strokeWidth="1.6" />
      <line x1="32" y1="76" x2="32" y2="88" stroke="#1f2937" strokeWidth="1.2" />

      {/* Châssis métallique incliné du tapis */}
      <line x1="-25" y1="92" x2="48" y2="61" stroke="#181920" strokeWidth="3.2" strokeLinecap="round" />
      <line x1="-25" y1="88" x2="48" y2="57" stroke="#181920" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M -20,90 L -10,90 L 0,81 L 10,81 L 20,72 L 30,72 L 40,63 L 45,63" stroke="#3f3f46" strokeWidth="0.8" fill="none" />
      
      {/* Bande caoutchouc noire */}
      <line x1="-25" y1="90" x2="48" y2="59" stroke="#07080b" strokeWidth="2.2" />

      {/* Lumps de charbon sur la bande */}
      {[
        { x: -16, y: 87 },
        { x: -2, y: 81 },
        { x: 12, y: 75 },
        { x: 26, y: 69 },
        { x: 40, y: 63 }
      ].map((pt, i) => (
        <polygon
          key={i}
          points={`${pt.x},${pt.y} ${pt.x + 3},${pt.y - 2.5} ${pt.x + 6},${pt.y} ${pt.x + 3},${pt.y + 2.5}`}
          fill="#1c1d22"
          stroke="#090a0f"
          strokeWidth="0.5"
        />
      ))}

      {/* Trémie (Entonnoir) métallique de réception */}
      {/* Pieds support */}
      <line x1="46" y1="58" x2="46" y2="76" stroke="#27272a" strokeWidth="1" />
      <line x1="74" y1="58" x2="74" y2="76" stroke="#27272a" strokeWidth="1" />
      {/* Corps trémie - Parois arrières */}
      <polygon points="42,48 60,39 78,48 60,57" fill="#0c0d12" stroke="#1f2937" strokeWidth="0.8" />
      
      {/* Tas de charbon brut accumulé dans la trémie */}
      <ellipse cx="60" cy="46" rx="11" ry="5" fill="#090a0d" />
      <circle cx="56" cy="44" r="3" fill="#18181b" stroke="#090a0f" strokeWidth="0.5" />
      <circle cx="64" cy="46" r="3.2" fill="#27272a" stroke="#090a0f" strokeWidth="0.5" />
      <circle cx="60" cy="48" r="3.5" fill="#1c1d22" stroke="#090a0f" strokeWidth="0.5" />

      {/* Parois externes trémie (Plaques d'acier) */}
      <polygon points="42,48 60,57 60,72 48,60" fill="#1f2937" stroke="#3f3f46" strokeWidth="0.8" />
      <polygon points="60,57 78,48 72,60 60,72" fill="#181920" stroke="#27272a" strokeWidth="0.8" />
      
      {/* Rivets trémie */}
      <circle cx="52" cy="56" r="0.6" fill="#52525b" />
      <circle cx="68" cy="56" r="0.6" fill="#52525b" />


      {/* 3. TUYAU D'ALIMENTATION EN CHARBON */}
      {/* Conduit coudé injectant le charbon concassé dans la chaudière */}
      <path d="M 60,72 L 60,78 L 84,86" fill="none" stroke="#18181b" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M 60,72 L 60,78 L 84,86" fill="none" stroke="#3f3f46" strokeWidth="2.8" strokeLinecap="round" />


      {/* 4. CHAUDIÈRE INDUSTRIELLE (BOILER) */}
      {/* Bloc principal */}
      {/* Face latérale gauche (Foyer) */}
      <polygon points="85,80 105,90 105,48 85,38" fill="url(#cg-furnace-left)" stroke="#111827" strokeWidth="0.8" />
      {/* Face latérale droite */}
      <polygon points="105,90 125,80 125,38 105,48" fill="url(#cg-furnace-right)" stroke="#111827" strokeWidth="0.8" />
      {/* Face supérieure */}
      <polygon points="85,38 105,48 125,38 105,28" fill="#3f3f46" stroke="#52525b" strokeWidth="0.8" />

      {/* Capot supérieur ventilé */}
      <polygon points="90,38 105,45 120,38 105,31" fill="#1f2937" stroke="#18181b" strokeWidth="0.5" />
      {[[89, 41], [105, 47], [121, 41], [105, 31]].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="0.6" fill="#71717a" />
      ))}

      {/* Grilles thermiques sur la face droite */}
      <path d="M 111,70 L 119,66 M 111,73 L 119,69 M 111,76 L 119,72" stroke="#0c0d12" strokeWidth="1" strokeLinecap="round" />

      {/* Manomètre analogique de pression vapeur */}
      <ellipse cx="115" cy="58" rx="4" ry="2.2" fill="#18181b" stroke="#3f3f46" strokeWidth="0.8" />
      <ellipse cx="115" cy="58" rx="3" ry="1.5" fill="#f4f4f5" />
      {active ? (
        <line x1="115" y1="58" x2="117.5" y2="56.5" stroke="#ef4444" strokeWidth="0.8" />
      ) : isStarved ? (
        <line x1="115" y1="58" x2="115.5" y2="59.2" stroke="#f59e0b" strokeWidth="0.8" />
      ) : (
        <line x1="115" y1="58" x2="112.5" y2="58.5" stroke="#71717a" strokeWidth="0.8" />
      )}

      {/* ── FOYER DE COMBUSTION ACTIF ── */}
      {/* Lueur d'ambiance projetée */}
      {active && (
        <circle cx="95" cy="71" r="20" fill="url(#cg-fire-glow-grad)" filter="url(#cg-fire-glow)" pointerEvents="none" />
      )}

      {/* Porte du foyer (fonte noire) */}
      <polygon points="90,73 100,78 100,60 90,55" fill="#090a0f" stroke="#1f2937" strokeWidth="1" />

      {/* Flammes intérieures */}
      {(active || isStarved) && (
        <g className="cg-fire-active">
          <polygon
            points="91.5,71.5 98.5,75 98.5,62.5 91.5,59"
            fill={isStarved ? "#ea580c" : "url(#cg-fire-radial)"}
          />
          {/* Noyau d'énergie blanc-jaune */}
          {!isStarved && (
            <polygon points="93.5,70.5 96.5,72 96.5,66.5 93.5,65" fill="#ffedd5" opacity="0.95" />
          )}
        </g>
      )}

      {/* Grille de sécurité (barreaux devant le foyer) */}
      <line x1="93" y1="57.5" x2="93" y2="73" stroke="#27272a" strokeWidth="0.8" />
      <line x1="95" y1="58.5" x2="95" y2="74" stroke="#27272a" strokeWidth="0.8" />
      <line x1="97" y1="59.5" x2="97" y2="75.5" stroke="#27272a" strokeWidth="0.8" />


      {/* 5. UNITÉ DE VENTILATION / DUAL FANS (ARRIÈRE) */}
      {/* Box supports */}
      <polygon points="122,38 146,26 168,37 144,49" fill="#1f2937" stroke="#111827" strokeWidth="0.8" />
      <polygon points="122,38 144,49 144,53 122,42" fill="#111827" stroke="#090a0f" strokeWidth="0.8" />
      <polygon points="144,49 168,37 168,41 144,53" fill="#16171f" stroke="#090a0f" strokeWidth="0.8" />

      {/* Grilles des turbines (isométriques) */}
      <ellipse cx="136" cy="35" rx="8" ry="4" fill="#090a0f" stroke="#374151" strokeWidth="0.8" />
      <ellipse cx="154" cy="41" rx="8" ry="4" fill="#090a0f" stroke="#374151" strokeWidth="0.8" />

      {/* Pales de ventilateur animées isométriquement (cosses projetées par scale) */}
      {[136, 154].map((cx, idx) => {
        const cy = cx === 136 ? 35 : 41;
        return (
          <g key={idx} transform={`translate(${cx}, ${cy}) scale(1, 0.5)`}>
            <g
              className={turbineActive ? 'animate-generator-turbine' : ''}
              style={{
                transformBox: 'fill-box',
                transformOrigin: 'center',
                '--turbine-speed': turbineSpeed,
              } as React.CSSProperties}
            >
              <line x1="-7" y1="0" x2="7" y2="0" stroke="#4b5563" strokeWidth="1.8" strokeLinecap="round" />
              <line x1="0" y1="-7" x2="0" y2="7" stroke="#4b5563" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="0" cy="0" r="1.5" fill="#9ca3af" />
            </g>
          </g>
        );
      })}


      {/* 6. RÉSEAU DE TUYAUTERIES INDUSTRIELLES */}
      {/* Tuyau chaud principal (Vapeur sous pression: Foyer -> Alternateur) */}
      <path d="M 125,48 L 140,55.5 L 140,65 L 175,82.5" fill="none" stroke="url(#cg-pipe-hot)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Raccords de tuyaux (flanges) */}
      <ellipse cx="132.5" cy="51.8" rx="1.5" ry="3.5" fill="#f97316" stroke="#ea580c" strokeWidth="0.5" transform="rotate(20 132.5 51.8)" />
      <ellipse cx="157.5" cy="73.8" rx="1.5" ry="3.5" fill="#f97316" stroke="#ea580c" strokeWidth="0.5" transform="rotate(20 157.5 73.8)" />

      {/* Tuyau de condensation froid (Alternateur -> Condensateur arrière) */}
      <path d="M 195,65 L 195,50 L 164,35" fill="none" stroke="url(#cg-pipe-cool)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

      {/* Tuyau d'évacuation de secours vers la cheminée */}
      <path d="M 144,49 L 144,60 L 220,98" fill="none" stroke="#27272a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />


      {/* 7. BLOC ALTERNATEUR & APPAREILLAGE ÉLECTRIQUE */}
      {/* Châssis alternateur */}
      <polygon points="170,82 195,70 215,80 190,92" fill="#1f2937" stroke="#111827" strokeWidth="0.8" />
      
      {/* Cylindres bobinés de cuivre */}
      {/* Bobine 1 */}
      <polygon points="175,76 195,66 195,78 175,88" fill="url(#cg-copper-grad)" stroke="#78350f" strokeWidth="0.5" />
      <ellipse cx="175" cy="82" rx="4" ry="6" fill="#b45309" stroke="#78350f" strokeWidth="0.5" />
      <ellipse cx="195" cy="72" rx="4" ry="6" fill="#d97706" stroke="#78350f" strokeWidth="0.5" />
      {/* Bobine 2 */}
      <polygon points="185,71 205,61 205,73 185,83" fill="url(#cg-copper-grad)" stroke="#78350f" strokeWidth="0.5" />
      <ellipse cx="185" cy="77" rx="4" ry="6" fill="#b45309" stroke="#78350f" strokeWidth="0.5" />
      <ellipse cx="205" cy="67" rx="4" ry="6" fill="#d97706" stroke="#78350f" strokeWidth="0.5" />

      {/* Fixations métalliques (étriers) sur les bobines */}
      <path d="M 174,88 L 174,76 L 176,75 L 176,87" fill="#4b5563" />
      <path d="M 194,78 L 194,66 L 196,65 L 196,77" fill="#4b5563" />
      <path d="M 204,73 L 204,61 L 206,60 L 206,72" fill="#4b5563" />

      {/* Armoire de couplage réseau (Boîtier électrique vert néon) */}
      <polygon points="210,87 232,76 242,81 220,92" fill="#081c15" stroke="#10b981" strokeOpacity="0.8" strokeWidth="1.2" />
      <polygon points="210,81 232,70 242,75 220,86" fill="#0c2d20" stroke="#10b981" strokeOpacity="0.6" strokeWidth="0.8" />
      <polygon points="210,81 220,86 220,92 210,87" fill="#05120e" />
      <polygon points="220,86 242,75 242,81 220,92" fill="#081c15" />

      {/* Diodes témoins clignotantes / statiques selon état */}
      <circle cx="221" cy="79.5" r="1.2" fill={accent} opacity={powered ? 0.95 : 0.25} />
      <circle cx="229" cy="75.5" r="1.2" fill={accent} opacity={powered ? 0.95 : 0.25} />

      {/* ── DÉCHARGES ÉLECTRIQUES ACTIVES ── */}
      {active && (
        <g>
          {/* Arc supérieur */}
          <path
            d="M 190,68 Q 198,62 208,68 T 218,74"
            stroke="#34d399"
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
            className="nf-energy-surge-line"
          />
          {/* Arc inférieur */}
          <path
            d="M 198,78 Q 206,85 214,79 T 226,84"
            stroke="#10b981"
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
            className="nf-energy-surge-line"
          />
        </g>
      )}


      {/* 8. CHEMINÉE D'ÉCHAPPEMENT (DROITE - BREAKS TOP FRAME) */}
      {/* Socle de la cheminée */}
      <ellipse cx="230" cy="50" rx="9" ry="4.5" fill="#1f2937" stroke="#111827" strokeWidth="0.8" />
      
      {/* Treillis métallique de maintien */}
      <line x1="221" y1="52" x2="217" y2="67" stroke="#3f3f46" strokeWidth="1" />
      <line x1="239" y1="52" x2="243" y2="67" stroke="#3f3f46" strokeWidth="1" />
      
      {/* Corps vertical de la cheminée cylindrique s'élevant en zone négative (Y < 0) */}
      <polygon points="221.5,50 221.5,-20 238.5,-20 238.5,50" fill="url(#cg-chimney-grad)" stroke="#111827" strokeWidth="0.6" />

      {/* Bandes d'avertissement rouges et blanches */}
      <polygon points="221.6,-10 238.4,-10 238.5,-3 221.5,-3" fill="#ef4444" />
      <polygon points="221.6,-3 238.4,-3 238.4,4 221.6,4" fill="#f4f4f5" />
      <polygon points="221.5,4 238.5,4 238.5,11 221.5,11" fill="#ef4444" />

      {/* Col de la cheminée et embouchure sombre */}
      <ellipse cx="230" cy="-20" rx="8.5" ry="4.25" fill="#3f3f46" stroke="#111827" strokeWidth="0.6" />
      <ellipse cx="230" cy="-20" rx="6" ry="3" fill="#090a0f" />

      {/* ── PANACHE DE FUMÉE/VAPEUR (ANIMÉ) ── */}
      {(active || isStarved) && (
        <g filter="url(#cg-blur)">
          <circle
            cx="230"
            cy="-22"
            r="4"
            fill={isStarved ? "rgba(120,113,108,0.45)" : "rgba(226,232,240,0.4)"}
            className="cg-smoke-1"
          />
          <circle
            cx="230"
            cy="-22"
            r="6.5"
            fill={isStarved ? "rgba(120,113,108,0.35)" : "rgba(226,232,240,0.3)"}
            className="cg-smoke-2"
          />
          <circle
            cx="230"
            cy="-22"
            r="9"
            fill={isStarved ? "rgba(120,113,108,0.22)" : "rgba(226,232,240,0.2)"}
            className="cg-smoke-3"
          />
        </g>
      )}


      {/* 9. POTEAU ÉLECTRIQUE BOIS DE DÉPART (EXTRÊME DROITE - BREAKS RIGHT FRAME) */}
      {/* Petit transformateur de terre */}
      <polygon points="248,80 256,76 262,79 254,83" fill="#1c1917" stroke="#111827" strokeWidth="0.8" />
      
      {/* Poteau en bois brut */}
      <line x1="258" y1="78" x2="258" y2="108" stroke="#78350f" strokeWidth="1.8" />
      
      {/* Console transversale (T-bar) */}
      <line x1="252" y1="76" x2="264" y2="76" stroke="#78350f" strokeWidth="1.4" />
      
      {/* Isolateurs céramiques cyan néon */}
      <circle cx="253" cy="74.5" r="1" fill="#06b6d4" />
      <circle cx="263" cy="74.5" r="1" fill="#06b6d4" />
      
      {/* Câbles électriques torsadés pendants */}
      <path d="M 238,78 Q 246,84 253,75.5" fill="none" stroke="#090a0f" strokeWidth="0.6" />
      <path d="M 238,78 Q 250,86 263,75.5" fill="none" stroke="#090a0f" strokeWidth="0.6" />
    </svg>
  );
}
