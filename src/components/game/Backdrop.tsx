import { cn } from '@/lib/utils'

/** Full-screen cybersec backdrop: clean, subtle agency-grade cyber-shell. */
export function Backdrop({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn('cyber-shell no-glow relative flex min-h-screen w-full flex-col text-foreground overflow-x-hidden', className)}>
      
      {/* ── Background Cyber Circuits & Glow Layer ── */}
      <div className="cyber-circuit-bg select-none absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-0" aria-hidden="true">
        
        {/* Central Electric Backlight Glow */}
        <div className="absolute top-[30%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(800px,95vw)] h-[min(800px,95vw)] rounded-full bg-[radial-gradient(circle,rgba(0,191,255,0.08)_0%,transparent_70%)] pointer-events-none blur-2xl z-0" />

        {/* Full Screen Responsive PCB Circuit Network */}
        <svg
          className="absolute inset-0 w-full h-full opacity-40 lg:opacity-50"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
        >
          {/* Static Circuit Lines */}
          {/* Track 1: Upper-left to Lower-right */}
          <path d="M -20,100 L 220,100 L 280,160 L 280,300 L 400,420 L 520,420 L 570,470 L 570,600 L 720,750 L 920,750 L 980,810 L 1460,810" className="cyber-circuit-path" />
          {/* Track 2: Upper-right to Lower-left */}
          <path d="M 1460,150 L 1200,150 L 1140,210 L 1140,380 L 1000,520 L 760,520 L 690,590 L 690,750 L 530,910" className="cyber-circuit-path" />
          {/* Track 3: Middle Interconnect & Branching */}
          <path d="M 100,920 L 250,770 L 450,770 L 520,700 L 520,510 L 600,430 L 860,430 L 920,370 L 920,200 L 1100,20" className="cyber-circuit-path" />
          {/* Detail Branch A */}
          <path d="M 280,220 L 340,280 L 340,390 L 420,470" className="cyber-circuit-path" />
          {/* Detail Branch B */}
          <path d="M 1140,300 L 1080,360 L 1080,480" className="cyber-circuit-path" />
          {/* Detail Branch C */}
          <path d="M 600,430 L 660,370 L 780,370 L 820,330" className="cyber-circuit-path" />

          {/* Animated Glow Flow Lines */}
          <path d="M -20,100 L 220,100 L 280,160 L 280,300 L 400,420 L 520,420 L 570,470 L 570,600 L 720,750 L 920,750 L 980,810 L 1460,810" className="cyber-circuit-path-glow cyber-circuit-path-glow-fast" />
          <path d="M 1460,150 L 1200,150 L 1140,210 L 1140,380 L 1000,520 L 760,520 L 690,590 L 690,750 L 530,910" className="cyber-circuit-path-glow cyber-circuit-path-glow-slow" />
          <path d="M 100,920 L 250,770 L 450,770 L 520,700 L 520,510 L 600,430 L 860,430 L 920,370 L 920,200 L 1100,20" className="cyber-circuit-path-glow cyber-circuit-path-glow-medium" />
          
          <path d="M 280,220 L 340,280 L 340,390 L 420,470" className="cyber-circuit-path-glow cyber-circuit-path-glow-slow" />
          <path d="M 1140,300 L 1080,360 L 1080,480" className="cyber-circuit-path-glow cyber-circuit-path-glow-fast" />
          <path d="M 600,430 L 660,370 L 780,370 L 820,330" className="cyber-circuit-path-glow cyber-circuit-path-glow-medium" />

          {/* Circuit Terminals (Nodes/Junctions) */}
          <circle cx="570" cy="600" r="4.5" className="cyber-circuit-node cyber-circuit-node-glow" />
          <circle cx="1000" cy="520" r="4" className="cyber-circuit-node" />
          <circle cx="920" cy="200" r="4.5" className="cyber-circuit-node cyber-circuit-node-glow" />
          <circle cx="420" cy="470" r="4" className="cyber-circuit-node" />
          <circle cx="1080" cy="480" r="4.5" className="cyber-circuit-node cyber-circuit-node-glow" />
          <circle cx="820" cy="330" r="4" className="cyber-circuit-node" />
          <circle cx="520" cy="510" r="4" className="cyber-circuit-node" />
        </svg>

      </div>

      {/* Main Page Content wrapper */}
      <div className="relative z-10 flex flex-1 flex-col">
        {children}
      </div>
    </div>
  )
}



