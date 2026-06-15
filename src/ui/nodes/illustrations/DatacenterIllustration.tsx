import type { MachineState } from '@/graph/machineStatus';



interface DatacenterIllustrationProps {
  state: MachineState;
  powered: boolean;
}

/**
 * 2D High-Tech Front-Facing Vector Illustration of a Standing Dual-Rack Server Cabinet.
 * Designed to fit the tall vertical h-[340px] w-[220px] card size (viewBox 0 0 220 340).
 */
export function DatacenterIllustration({ state, powered }: DatacenterIllustrationProps) {
  const active = powered && state === 'nominal';

  return (
    <svg
      viewBox="0 0 220 340"
      className="absolute inset-0 h-full w-full overflow-visible animate-fade-in"
      preserveAspectRatio="none"
    >
      <defs>
        {/* Glow Filters */}
        <filter id="dc-led-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
        <filter id="dc-pipe-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>

        {/* Gradients */}
        <linearGradient id="dc-metal-chassis" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#1e1b4b" /> {/* Dark Indigo */}
          <stop offset="15%" stopColor="#0f0e26" />
          <stop offset="50%" stopColor="#070612" />
          <stop offset="85%" stopColor="#0f0e26" />
          <stop offset="100%" stopColor="#1e1b4b" />
        </linearGradient>

        <linearGradient id="dc-blade-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#18152e" />
          <stop offset="100%" stopColor="#090714" />
        </linearGradient>

        {/* Liquid Cooling Pipes */}
        <linearGradient id="dc-pipe-cool" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#3b82f6" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#1d4ed8" stopOpacity="0.9" />
        </linearGradient>

        <linearGradient id="dc-pipe-hot" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ec4899" stopOpacity="0.9" />
          <stop offset="50%" stopColor="#f43f5e" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#9f1239" stopOpacity="0.9" />
        </linearGradient>
      </defs>

      <style>{`
        @keyframes dc-led-blink-fast {
          0%, 100% { opacity: 0.15; }
          50% { opacity: 1; }
        }
        @keyframes dc-led-blink-slow {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.85; }
        }
        .led-blink-fast {
          animation: dc-led-blink-fast 0.4s infinite alternate;
        }
        .led-blink-slow {
          animation: dc-led-blink-slow 1.2s infinite alternate;
        }
        @keyframes dc-fan-rotate {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .dc-turbine-spin {
          transform-origin: center;
          animation: dc-fan-rotate var(--spin-speed, 2s) linear infinite;
        }
      `}</style>

      {/* 1. OUTER METAL CABINET CHASSIS */}
      <rect x="2" y="2" width="216" height="336" rx="10" fill="url(#dc-metal-chassis)" stroke="#2e1f4d" strokeWidth="2.5" />

      {/* Top ventilation grill mesh decoration */}
      <rect x="12" y="10" width="196" height="16" rx="4" fill="#030208" stroke="#1f1a3a" strokeWidth="1" />
      <g stroke="#1a1533" strokeWidth="1">
        {Array.from({ length: 28 }).map((_, i) => (
          <line key={i} x1={18 + i * 6} y1="13" x2={18 + i * 6} y2="23" />
        ))}
      </g>

      {/* 2. DUAL SERVER RACK COLUMNS */}
      {/* Left Column (Blades 0-9) */}
      <rect x="12" y="32" width="94" height="286" rx="4" fill="#030206" stroke="#1f1a3a" strokeWidth="1.2" />
      {/* Right Column (Blades 0-9) */}
      <rect x="114" y="32" width="94" height="286" rx="4" fill="#030206" stroke="#1f1a3a" strokeWidth="1.2" />

      {/* Renders 10 slots of server blades in each column */}
      {Array.from({ length: 10 }).map((_, slotIdx) => {
        const yOffset = slotIdx * 28;
        const activeColor = slotIdx % 3 === 0 ? '#06b6d4' : (slotIdx % 2 === 0 ? '#a855f7' : '#10b981');
        return (
          <g key={slotIdx} transform={`translate(0, ${yOffset})`}>
            {/* Left Server Blade Slot */}
            <g transform="translate(15, 35)">
              <rect x="0" y="0" width="88" height="24" rx="3" fill="url(#dc-blade-bg)" stroke="#1e183a" strokeWidth="0.8" />
              {/* Vent slots */}
              <line x1="8" y1="12" x2="35" y2="12" stroke="#251b4c" strokeWidth="2" strokeDasharray="2 1.5" />
              {/* Micro diagnostic glowing blue stripe representing custom user image detail */}
              {active && (
                <rect x="38" y="10" width="18" height="4" rx="1" fill="#00f0ff" opacity="0.8" className="led-blink-slow" style={{ animationDelay: `${slotIdx * 0.15}s` }} />
              )}
              {/* Circular LEDs */}
              <circle cx="68" cy="12" r="1.5" fill={active ? activeColor : '#27272a'} className={active ? 'led-blink-fast' : ''} style={{ animationDelay: `${slotIdx * 0.2}s` }} />
              <circle cx="75" cy="12" r="1.5" fill={active ? '#10b981' : '#27272a'} />
              <circle cx="82" cy="12" r="1.5" fill={active ? '#f59e0b' : '#27272a'} />
            </g>

            {/* Right Server Blade Slot */}
            <g transform="translate(117, 35)">
              <rect x="0" y="0" width="88" height="24" rx="3" fill="url(#dc-blade-bg)" stroke="#1e183a" strokeWidth="0.8" />
              {/* Vents */}
              <line x1="8" y1="12" x2="35" y2="12" stroke="#251b4c" strokeWidth="2" strokeDasharray="2 1.5" />
              {/* Micro diagnostic blue stripe */}
              {active && (
                <rect x="38" y="10" width="18" height="4" rx="1" fill="#00f0ff" opacity="0.8" className="led-blink-slow" style={{ animationDelay: `${slotIdx * 0.25}s` }} />
              )}
              {/* Circular LEDs */}
              <circle cx="68" cy="12" r="1.5" fill={active ? activeColor : '#27272a'} className={active ? 'led-blink-fast' : ''} style={{ animationDelay: `${slotIdx * 0.1}s` }} />
              <circle cx="75" cy="12" r="1.5" fill={active ? '#10b981' : '#27272a'} />
              <circle cx="82" cy="12" r="1.5" fill={active ? '#f59e0b' : '#27272a'} />
            </g>
          </g>
        );
      })}

      {/* 3. VERTICAL COOLING FLUID PIPES */}
      {/* Cyan coolant flow pipe on the left outer edge */}
      <g filter="url(#dc-pipe-glow)">
        <path
          d="M 8,30 L 8,322"
          fill="none"
          stroke="url(#dc-pipe-cool)"
          strokeWidth="2.5"
          strokeLinecap="round"
          className="nf-dc-flowline"
        />
      </g>
      {/* Hot pink coolant return pipe on the right outer edge */}
      <g filter="url(#dc-pipe-glow)">
        <path
          d="M 212,30 L 212,322"
          fill="none"
          stroke="url(#dc-pipe-hot)"
          strokeWidth="2"
          strokeLinecap="round"
          className="nf-dc-flowline"
          style={{ animationDirection: 'reverse' }}
        />
      </g>

      {/* Bottom chassis border details */}
      <rect x="12" y="322" width="196" height="10" rx="2" fill="#090516" stroke="#231b3e" strokeWidth="1" />
    </svg>
  );
}
