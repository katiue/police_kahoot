'use client'
import { cn } from '@/lib/utils'

/**
 * Deterministic avatar — icon + color ring derived from nickname.
 * No server changes required; purely cosmetic client-side identity.
 *
 * Future: accept an `avatarId` prop (from PlayerView.avatarId) to override.
 */

// 8 HUD-themed SVG icon paths (shield, lock, fingerprint, radar, camera, badge, circuit, satellite)
export const AVATAR_ICONS = [
  // Shield
  (color: string) => (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path
        d="M12 2L4 6v6c0 5.25 3.5 10.15 8 11.35C16.5 22.15 20 17.25 20 12V6L12 2Z"
        fill={color}
        fillOpacity="0.25"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path d="M9 12l2 2 4-4" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  // Lock
  (color: string) => (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <rect x="5" y="11" width="14" height="10" rx="2" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5"/>
      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="16" r="1.5" fill={color}/>
    </svg>
  ),
  // Fingerprint
  (color: string) => (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path d="M12 3C8.13 3 5 6.13 5 10" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M19 10c0-3.87-3.13-7-7-7" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 10a5 5 0 0 1 10 0" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 10v5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M9 13a3 3 0 0 0 6 0" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 17c.5 1.5 2 3 5 3s4.5-1.5 5-3" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  // Radar / target
  (color: string) => (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <circle cx="12" cy="12" r="9" stroke={color} strokeWidth="1.5" strokeOpacity="0.5"/>
      <circle cx="12" cy="12" r="5" stroke={color} strokeWidth="1.5" strokeOpacity="0.7"/>
      <circle cx="12" cy="12" r="1.5" fill={color}/>
      <line x1="12" y1="3" x2="12" y2="7" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="12" y1="17" x2="12" y2="21" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="3" y1="12" x2="7" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="17" y1="12" x2="21" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  // Eye / Camera
  (color: string) => (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" fill={color} fillOpacity="0.18" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="3" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.5"/>
      <circle cx="12" cy="12" r="1" fill={color}/>
    </svg>
  ),
  // Badge / ID
  (color: string) => (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <rect x="4" y="4" width="16" height="16" rx="2" fill={color} fillOpacity="0.15" stroke={color} strokeWidth="1.5"/>
      <circle cx="12" cy="10" r="3" stroke={color} strokeWidth="1.5"/>
      <path d="M6 20c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  // Circuit node
  (color: string) => (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <circle cx="12" cy="12" r="3" fill={color} fillOpacity="0.3" stroke={color} strokeWidth="1.5"/>
      <line x1="12" y1="3" x2="12" y2="9" stroke={color} strokeWidth="1.5"/>
      <line x1="12" y1="15" x2="12" y2="21" stroke={color} strokeWidth="1.5"/>
      <line x1="3" y1="12" x2="9" y2="12" stroke={color} strokeWidth="1.5"/>
      <line x1="15" y1="12" x2="21" y2="12" stroke={color} strokeWidth="1.5"/>
      <circle cx="12" cy="3" r="1.5" fill={color}/>
      <circle cx="12" cy="21" r="1.5" fill={color}/>
      <circle cx="3" cy="12" r="1.5" fill={color}/>
      <circle cx="21" cy="12" r="1.5" fill={color}/>
    </svg>
  ),
  // Satellite / signal
  (color: string) => (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path d="M4 4l4 4" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="9" cy="9" r="3" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5"/>
      <path d="M13 11l6 6" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M15 20a5 5 0 0 0 5-5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M12 20a8 8 0 0 0 8-8" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  // Crosshair / Target
  (color: string) => (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <circle cx="12" cy="12" r="8" stroke={color} strokeWidth="1.5" strokeDasharray="3 3"/>
      <circle cx="12" cy="12" r="3" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5"/>
      <line x1="12" y1="1" x2="12" y2="5" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="12" y1="19" x2="12" y2="23" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="1" y1="12" x2="5" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="19" y1="12" x2="23" y2="12" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  // Flashlight / Torch
  (color: string) => (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path d="M18 3H6c-.55 0-1 .45-1 1v4c0 .35.18.66.45.85l3.55 2.5V19c0 1.1.9 2 2 2h2c1.1 0 2-.9 2-2v-8.65l3.55-2.5c.27-.19.45-.5.45-.85V4c0-.55-.45-1-1-1Z" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.5"/>
      <line x1="9" y1="7" x2="15" y2="7" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="15" r="1.5" fill={color}/>
    </svg>
  ),
  // Megaphone / Siren Alert
  (color: string) => (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path d="M3 17v-6c0-1.1.9-2 2-2h3l7-5v16l-7-5H5c-1.1 0-2-.9-2-2Z" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M19 8c1.5 1.5 1.5 4.5 0 6M21 5c2.5 2.5 2.5 7.5 0 10" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M11 14l-2 5.5a1 1 0 0 1-1.8-.6L8.5 14" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  // Handcuffs
  (color: string) => (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <circle cx="7" cy="14" r="4.5" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5"/>
      <circle cx="17" cy="14" r="4.5" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5"/>
      <path d="M10.5 11.5s2-2 3.5 0" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <rect x="5" y="8" width="4" height="2" rx="0.5" fill={color}/>
      <rect x="15" y="8" width="4" height="2" rx="0.5" fill={color}/>
    </svg>
  ),
  // Police Car / Cruiser
  (color: string) => (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path d="M19 10h-2L15.3 7.3a1.5 1.5 0 0 0-1.2-.6H9.9a1.5 1.5 0 0 0-1.2.6L6.7 10H5a3 3 0 0 0-3 3v4a1 1 0 0 0 1 1h1a2.5 2.5 0 0 0 5 0h6a2.5 2.5 0 0 0 5 0h1a1 1 0 0 0 1-1v-4a3 3 0 0 0-3-3Z" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="6" cy="18" r="1.5" fill={color}/>
      <circle cx="18" cy="18" r="1.5" fill={color}/>
      <path d="M11 6.7V5a1 1 0 0 1 2 0v1.7" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
  // Star Badge / Sheriff Star
  (color: string) => (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path d="M12 2l2.6 5.3 5.8.9-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.9L12 2Z" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="12" cy="12" r="2" fill={color}/>
    </svg>
  ),
  // Flame / Fire
  (color: string) => (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1.5-3.5C8 11.5 7 13 7 14.5a1.5 1.5 0 0 0 1.5 1.5Z" fill={color}/>
      <path d="M17.66 11.2c-.37-.89-.96-1.68-1.58-2.4C14.73 7 13.5 5 13.5 3c0 0-3 2.5-3 6.5 0 1.63.77 3.2 2.03 4.25a4.5 4.5 0 0 0 6.64-.8c.4-.73.4-1.75-.51-2.75Z" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  // Trophy / Crown
  (color: string) => (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path d="M6 9H4.5A2.5 2.5 0 0 1 2 6.5V6a1 1 0 0 1 1-1h3m12 4h1.5A2.5 2.5 0 0 0 22 6.5V6a1 1 0 0 0-1-1h-3M6 5v5c0 3.3 2.7 6 6 6s6-2.7 6-6V5H6Z" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <path d="M12 16v4M8 20h8" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  // Heart / Life
  (color: string) => (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35Z" fill={color} fillOpacity="0.25" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
    </svg>
  ),
  // Skull
  (color: string) => (
    <svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
      <path d="M12 2a7 7 0 0 0-7 7v4c0 1.63.75 3.08 2 4v3a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-3c1.25-.92 2-2.37 2-4V9a7 7 0 0 0-7-7Z" fill={color} fillOpacity="0.2" stroke={color} strokeWidth="1.5" strokeLinejoin="round"/>
      <circle cx="9.5" cy="9.5" r="1.5" fill={color}/>
      <circle cx="14.5" cy="9.5" r="1.5" fill={color}/>
      <line x1="12" y1="14" x2="12" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
      <line x1="10" y1="17" x2="14" y2="17" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  ),
]

export const AVATAR_COLORS = [
  '#00d4ff', // cyan
  '#1a8fff', // blue
  '#a855f7', // violet
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#ef4444', // red
  '#f97316', // orange
]

/** Simple string hash — deterministic, no randomness */
function hashNickname(name: string): number {
  let h = 0
  for (let i = 0; i < name.length; i++) {
    h = (Math.imul(31, h) + name.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

export function getAvatarIndex(nickname: string) {
  const h = hashNickname(nickname)
  return {
    iconIndex: h % AVATAR_ICONS.length,
    colorIndex: (h * 7) % AVATAR_COLORS.length,
  }
}

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

const SIZE_MAP: Record<AvatarSize, { outer: string; inner: string; ring: string }> = {
  xs: { outer: 'w-7 h-7',  inner: 'w-4 h-4',  ring: 'ring-[1.5px]' },
  sm: { outer: 'w-9 h-9',  inner: 'w-5 h-5',  ring: 'ring-2' },
  md: { outer: 'w-12 h-12', inner: 'w-7 h-7', ring: 'ring-2' },
  lg: { outer: 'w-16 h-16', inner: 'w-9 h-9', ring: 'ring-[2.5px]' },
  xl: { outer: 'w-20 h-20', inner: 'w-11 h-11', ring: 'ring-[3px]' },
}

export function PlayerAvatar({
  nickname,
  size = 'md',
  pulse = false,
  eliminated = false,
  className,
  iconIndex,
  colorIndex,
}: {
  nickname: string
  size?: AvatarSize
  pulse?: boolean
  eliminated?: boolean
  className?: string
  iconIndex?: number
  colorIndex?: number
}) {
  const defaultIdx = getAvatarIndex(nickname)
  const finalIconIdx = iconIndex !== undefined ? iconIndex : defaultIdx.iconIndex
  const finalColorIdx = colorIndex !== undefined ? colorIndex : defaultIdx.colorIndex
  
  const color = AVATAR_COLORS[finalColorIdx]
  const Icon = AVATAR_ICONS[finalIconIdx]
  const s = SIZE_MAP[size]


  return (
    <div
      className={cn(
        'relative flex items-center justify-center rounded-full',
        'transition-all duration-700 ease-[cubic-bezier(0.32,0.72,0,1)]',
        s.outer,
        s.ring,
        eliminated
          ? 'ring-red-500/30 grayscale opacity-50'
          : pulse
          ? 'animate-avatar-pulse'
          : '',
        className
      )}
      style={
        eliminated
          ? { background: 'rgba(6,24,48,0.8)' }
          : {
              background: `radial-gradient(circle at 35% 35%, ${color}22, ${color}08)`,
              boxShadow: `0 0 0 1px ${color}40, 0 0 12px ${color}30`,
              outline: `1.5px solid ${color}60`,
            }
      }
    >
      {/* Inner icon */}
      <div className={cn('flex items-center justify-center', s.inner)}>
        {Icon(eliminated ? '#4a6a8a' : color)}
      </div>

      {/* Eliminated X overlay */}
      {eliminated && (
        <div className="absolute inset-0 flex items-center justify-center rounded-full">
          <svg viewBox="0 0 12 12" className="w-1/3 h-1/3 opacity-70">
            <line x1="2" y1="2" x2="10" y2="10" stroke="#ff3d3d" strokeWidth="2" strokeLinecap="round"/>
            <line x1="10" y1="2" x2="2" y2="10" stroke="#ff3d3d" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
      )}
    </div>
  )
}
