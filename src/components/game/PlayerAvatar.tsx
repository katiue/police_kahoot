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
