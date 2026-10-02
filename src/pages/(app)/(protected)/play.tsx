/**
 * /play — start a new room or join a friend's with a 4-letter code.
 */

import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth, useQuery } from 'deepspace'
import { Button, Input, useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import { CategoryIcon } from '../../../components/CategoryIcon'
import { callAction } from '../../../game/api'
import { CATEGORIES, findCategory, normalizeRoomCode, ROUND_OPTIONS } from '../../../game/logic'

export default function PlayPage() {
  const navigate = useNavigate()
  const { error } = useToast()

  const [category, setCategory] = useState(CATEGORIES[0].id)
  const [rounds, setRounds] = useState<number>(5)
  const [creating, setCreating] = useState(false)

  const [code, setCode] = useState('')
  const [joining, setJoining] = useState(false)

  async function createRoom() {
    setCreating(true)
    try {
      const { code } = await callAction<{ code: string }>('createGame', { category, rounds })
      navigate(`/game/${code}`)
    } catch (e) {
      error('Could not create the room', (e as Error).message)
      setCreating(false)
    }
  }

  async function joinRoom(event: FormEvent) {
    event.preventDefault()
    const normalized = normalizeRoomCode(code)
    if (!normalized) return error('Room codes are 4 letters')
    setJoining(true)
    try {
      await callAction('joinGame', { code: normalized })
      navigate(`/game/${normalized}`)
    } catch (e) {
      error('Could not join', (e as Error).message)
      setJoining(false)
    }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6 px-4 py-10 md:grid-cols-[1.4fr_1fr]">
      <section className="rounded-2xl border border-border bg-card p-6">
        <h1 className="text-2xl font-bold">Start a room</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick a category. We'll pull real products from Amazon and hide the prices.
        </p>

        <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Category
        </h2>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              data-testid={`category-${c.id}`}
              onClick={() => setCategory(c.id)}
              aria-pressed={category === c.id}
              className={cn(
                'flex items-center gap-2 rounded-xl border px-3 py-3 text-left text-sm transition-colors',
                category === c.id
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border bg-secondary/40 text-muted-foreground hover:text-foreground',
              )}
            >
              <CategoryIcon
                id={c.id}
                className={cn('h-5 w-5', category === c.id ? 'text-primary' : 'text-muted-foreground')}
              />
              {c.label}
            </button>
          ))}
        </div>

        <h2 className="mt-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Rounds
        </h2>
        <div className="mt-2 flex gap-2">
          {ROUND_OPTIONS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRounds(n)}
              aria-pressed={rounds === n}
              className={cn(
                'h-10 w-14 rounded-lg border text-sm font-semibold transition-colors',
                rounds === n
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              {n}
            </button>
          ))}
        </div>

        <Button
          data-testid="create-room"
          size="lg"
          className="mt-8 w-full text-base font-semibold"
          loading={creating}
          onClick={createRoom}
        >
          {creating ? 'Finding products…' : 'Create room'}
        </Button>
      </section>

      <section className="rounded-2xl border border-border bg-card p-6">
        <h2 className="text-2xl font-bold">Join a room</h2>
        <p className="mt-1 text-sm text-muted-foreground">Got a code from a friend? Type it here.</p>
        <form onSubmit={joinRoom} className="mt-6 flex flex-col gap-3">
          <Input
            data-testid="join-code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 4))}
            placeholder="ABCD"
            aria-label="Room code"
            autoCapitalize="characters"
            className="h-14 text-center font-mono text-2xl tracking-[0.5em]"
          />
          <Button type="submit" variant="secondary" size="lg" loading={joining}>
            Join
          </Button>
        </form>
        <GamesInProgress />
      </section>
    </div>
  )
}

/**
 * Games this user is still part of, so clicking away mid-game never loses it.
 * Player rows are public to signed-in members; we filter to our own userId.
 */
function GamesInProgress() {
  const { userId } = useAuth()
  const mine = useQuery<{ code?: string }>('players', {
    where: { userId: userId ?? '' },
    orderBy: 'createdAt',
    orderDir: 'desc',
    limit: 5,
  })
  const codes = mine.records.map((r) => r.data.code).filter((c): c is string => !!c)
  if (codes.length === 0) return null
  return (
    <div className="mt-8 border-t border-border pt-6" data-testid="games-in-progress">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Your games in progress
      </h3>
      <ul className="mt-2 space-y-2">
        {codes.map((code) => (
          <ActiveGameRow key={code} code={code} />
        ))}
      </ul>
    </div>
  )
}

/** One row per game; hides itself once the game has finished. */
function ActiveGameRow({ code }: { code: string }) {
  const { records } = useQuery<{ status: string; category: string; roundIndex: number; totalRounds: number }>(
    'games',
    { where: { code }, limit: 1 },
  )
  const game = records[0]?.data
  if (!game || game.status === 'finished') return null
  const category = findCategory(game.category)
  const progress = game.status === 'lobby' ? 'In lobby' : `Round ${game.roundIndex + 1} of ${game.totalRounds}`
  return (
    <li className="flex items-center gap-3 rounded-xl border border-border bg-secondary/40 px-3 py-2 text-sm">
      <span className="font-mono font-bold tracking-widest text-primary">{code}</span>
      <CategoryIcon id={game.category} className="text-muted-foreground" />
      <span className="flex-1 truncate text-muted-foreground">
        {category?.label} · {progress}
      </span>
      <Link to={`/game/${code}`} className="font-semibold text-foreground hover:text-primary">
        Rejoin
      </Link>
    </li>
  )
}
