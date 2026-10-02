/**
 * Icon for each game category. Kept out of src/game/logic.ts so the shared
 * game rules (also used by the server) stay free of UI code.
 */

import { ChefHat, Headphones, Sofa, Sparkles, Tent, ToyBrick, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

const ICONS: Record<string, LucideIcon> = {
  kitchen: ChefHat,
  tech: Headphones,
  toys: ToyBrick,
  home: Sofa,
  outdoors: Tent,
  weird: Sparkles,
}

export function CategoryIcon({ id, className }: { id: string; className?: string }) {
  const Icon = ICONS[id] ?? Sparkles
  return <Icon aria-hidden className={cn('h-4 w-4 shrink-0', className)} />
}
