import type { MachineState } from '@/graph/machineStatus';

interface HarvesterIllustrationProps {
  state: MachineState;
  powered: boolean;
  /** Activity pulse speed ('0s' = stopped) */
  pulseSpeed: string;
}

/**
 * 2D High-Tech Retro 90s Cathodic CRT Monitor Console.
 * Horizontal layout (viewBox 0 0 440 180).
 */
export function HarvesterIllustration({ state, powered, pulseSpeed: _pulseSpeed }: HarvesterIllustrationProps) {
  const active = powered && state === 'nominal';
  const isStarved = state === 'starved';

  return (
    <svg
      viewBox="0 0 440 180"
      className="absolute inset-0 h-full w-full overflow-visible animate-fade-in"
      preserveAspectRatio="none"
    >
      <defs>
        {/* Glow Filters */}
        <filter id="harv-led-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
        <filter id="harv-dish-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.5" />
        </filter>

        {/* Gradients */}
        <linearGradient id="harv-chassis-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2e3037" />
          <stop offset="100%" stopColor="#181a1e" />
        </linearGradient>

        <linearGradient id="harv-screen-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#01140e" /> {/* CRT Black-Green Phosphor */}
          <stop offset="100%" stopColor="#000704" />
        </linearGradient>

        <linearGradient id="harv-metal-dark" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>

        {/* Matrix Rain Fade Gradient */}
        <linearGradient id="harv-matrix-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#10b981" stopOpacity="0.05" />
          <stop offset="75%" stopColor="#10b981" stopOpacity="0.45" />
          <stop offset="90%" stopColor="#34d399" stopOpacity="0.8" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="1" />
        </linearGradient>

        {/* Clipping path for CRT screen area */}
        <clipPath id="harv-screen-clip">
          <rect x="22" y="22" width="286" height="136" rx="10" />
        </clipPath>
      </defs>

      <style>{`
        @keyframes crt-screen-flicker {
          0%, 100% { opacity: 0.96; }
          50% { opacity: 1; }
        }
        .crt-flicker {
          animation: crt-screen-flicker 0.12s infinite;
        }
        @keyframes matrix-fall {
          0% { transform: translateY(-150px); }
          100% { transform: translateY(150px); }
        }
        .matrix-col {
          writing-mode: vertical-rl;
          text-orientation: upright;
          font-family: monospace;
          font-weight: 900;
          font-size: 5px;
          fill: url(#harv-matrix-fade);
          animation: matrix-fall var(--fall-duration, 3.5s) linear infinite;
        }
      `}</style>

      {/* 1. RETRO COMPUTER CABINET FRAME */}
      <rect x="5" y="5" width="430" height="170" rx="8" fill="url(#harv-chassis-grad)" stroke="#374151" strokeWidth="2" />
      
      {/* Corner screws for 90s industrial build */}
      <circle cx="12" cy="12" r="2" fill="#4b5563" stroke="#1f2937" strokeWidth="0.5" />
      <circle cx="428" cy="12" r="2" fill="#4b5563" stroke="#1f2937" strokeWidth="0.5" />
      <circle cx="12" cy="168" r="2" fill="#4b5563" stroke="#1f2937" strokeWidth="0.5" />
      <circle cx="428" cy="168" r="2" fill="#4b5563" stroke="#1f2937" strokeWidth="0.5" />

      {/* 2. CATHODIC MONITOR BEZEL (Left side) */}
      <rect x="15" y="15" width="300" height="150" rx="14" fill="#1c1e22" stroke="#2a2e35" strokeWidth="5" />
      <rect x="19" y="19" width="292" height="142" rx="10" fill="#0c0e12" stroke="#000000" strokeWidth="2" />
      
      {/* Curved Cathodic Tube Screen */}
      <rect x="22" y="22" width="286" height="136" rx="8" fill="url(#harv-screen-grad)" />

      {/* 3. MATRIX RAIN & TELEMETRY INSIDE CRT TUBE */}
      {active && (
        <g className="crt-flicker">
          {/* Matrix Rain */}
          <g clipPath="url(#harv-screen-clip)" opacity="0.5">
            {[
              { x: 35, char: '0110101101', delay: '0s', duration: '2.4s' },
              { x: 60, char: '10001110', delay: '0.8s', duration: '3.1s' },
              { x: 85, char: 'SCRAP_7F', delay: '1.4s', duration: '4.0s' },
              { x: 110, char: '01011001', delay: '0.3s', duration: '2.7s' },
              { x: 135, char: '11001010', delay: '2.0s', duration: '3.5s' },
              { x: 160, char: 'GET_DATA_OK', delay: '0.5s', duration: '3.0s' },
              { x: 185, char: '00101101', delay: '1.1s', duration: '2.5s' },
              { x: 210, char: '10100101', delay: '2.3s', duration: '3.8s' },
              { x: 235, char: 'F5E9D2', delay: '0.2s', duration: '3.1s' },
              { x: 260, char: '01100101', delay: '1.6s', duration: '2.6s' },
              { x: 285, char: '10101100', delay: '0.8s', duration: '2.9s' }
            ].map((col, idx) => (
              <text
                key={idx}
                x={col.x}
                y={0}
                className="matrix-col"
                style={{
                  animationDelay: col.delay,
                  '--fall-duration': col.duration
                } as React.CSSProperties}
              >
                {col.char}
              </text>
            ))}
          </g>

          {/* Oscilloscope Waveform */}
          <path
            d="M 30,95 Q 65,40 100,90 T 170,60 T 240,115 T 290,75"
            fill="none"
            stroke="#10b981"
            strokeWidth="1.2"
            strokeLinecap="round"
            opacity="0.65"
          />
          <circle cx="100" cy="90" r="2.5" fill="#ffffff" filter="url(#harv-led-glow)" />
          <circle cx="170" cy="60" r="2.5" fill="#ffffff" filter="url(#harv-led-glow)" />
          <circle cx="240" cy="115" r="2" fill="#34d399" />
        </g>
      )}

      {isStarved && (
        <g className="crt-flicker" clipPath="url(#harv-screen-clip)">
          <line x1="22" y1="90" x2="308" y2="90" stroke="#f59e0b" strokeWidth="1" strokeDasharray="4 4" />
        </g>
      )}

      {!powered && (
        <g clipPath="url(#harv-screen-clip)" opacity="0.1">
          <line x1="22" y1="90" x2="308" y2="90" stroke="#4b5563" strokeWidth="1" />
        </g>
      )}

      {/* Glass Bulb Glare Reflection (Overlay) */}
      <path d="M 23,23 L 230,23 L 23,120 Z" fill="rgba(255, 255, 255, 0.05)" pointerEvents="none" />

      {/* 4. CONTROL RACK PANEL (Right side) */}
      {/* Horizontal vents */}
      <rect x="330" y="20" width="85" height="3" rx="1.5" fill="#0d0e12" />
      <rect x="330" y="28" width="85" height="3" rx="1.5" fill="#0d0e12" />
      <rect x="330" y="36" width="85" height="3" rx="1.5" fill="#0d0e12" />

      {/* Physical Floppy Disk slot / cassette drive */}
      <g transform="translate(330, 48)">
        <rect x="0" y="0" width="85" height="36" rx="2" fill="#131519" stroke="#252830" strokeWidth="1" />
        {/* Drive entry slot */}
        <rect x="6" y="8" width="73" height="4" rx="1" fill="#020203" />
        <rect x="6" y="12" width="73" height="1" fill="#2d3039" />
        {/* Eject button */}
        <rect x="62" y="18" width="14" height="8" rx="1" fill="#383d48" stroke="#1f2228" strokeWidth="0.5" />
        <rect x="65" y="21" width="8" height="2" fill="#525866" />
        {/* Busy LED */}
        <circle cx="14" cy="22" r="1.5" fill={active ? '#22c55e' : '#3f3f46'} />
        {/* Disk label hint */}
        <text x="35" y="24" fill="#4b5563" fontSize="5" fontFamily="monospace" fontWeight="bold">DISK A</text>
      </g>

      {/* Rotary Dials Plate */}
      <g transform="translate(330, 94)">
        <rect x="0" y="0" width="85" height="66" rx="3" fill="#131519" stroke="#252830" strokeWidth="1" />
        
        {/* Dial 1 */}
        <g transform="translate(18, 22)">
          <circle cx="0" cy="0" r="9" fill="url(#harv-metal-dark)" stroke="#1a1c23" strokeWidth="1" />
          <line x1="0" y1="0" x2="-6" y2="-6" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
          <text x="0" y="17" fill="#64748b" fontSize="4.5" fontFamily="monospace" textAnchor="middle" fontWeight="bold">FRQ</text>
        </g>

        {/* Dial 2 */}
        <g transform="translate(42, 22)">
          <circle cx="0" cy="0" r="9" fill="url(#harv-metal-dark)" stroke="#1a1c23" strokeWidth="1" />
          <line x1="0" y1="0" x2="6" y2="-6" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
          <text x="0" y="17" fill="#64748b" fontSize="4.5" fontFamily="monospace" textAnchor="middle" fontWeight="bold">AMP</text>
        </g>

        {/* Dial 3 */}
        <g transform="translate(66, 22)">
          <circle cx="0" cy="0" r="9" fill="url(#harv-metal-dark)" stroke="#1a1c23" strokeWidth="1" />
          <line x1="0" y1="0" x2="0" y2="-8" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
          <text x="0" y="17" fill="#64748b" fontSize="4.5" fontFamily="monospace" textAnchor="middle" fontWeight="bold">RES</text>
        </g>

        {/* Heavy toggle switch / power key */}
        <g transform="translate(15, 48)">
          <rect x="0" y="0" width="55" height="12" rx="1.5" fill="#0b0c0f" stroke="#1f2229" strokeWidth="0.8" />
          <circle cx="8" cy="6" r="2.5" fill={active ? '#10b981' : '#ef4444'} />
          <text x="16" y="9" fill="#94a3b8" fontSize="5.5" fontFamily="monospace" fontWeight="bold">SYS_PWR: {active ? 'ON' : 'OFF'}</text>
        </g>
      </g>
    </svg>
  );
}
