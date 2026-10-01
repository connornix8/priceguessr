/**
 * /game/:code — the live game screen.
 *
 * Everything here is READ live with useQuery: when the server action changes
 * a row (someone joins, guesses, the host reveals), DeepSpace pushes the change
 * over the WebSocket and this page re-renders on every player's screen.
 * Writes go through callAction(...) — never straight to the database.
 */

import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth, useQuery, useUserLookup } from 'deepspace'
import { Check, Copy, Crown, ExternalLink, Star } from 'lucide-react'
import { Button, Input, useToast } from '@/components/ui'
import { cn } from '@/lib/utils'
import { callAction, type ActionName } from '../../../../game/api'
import { findCategory, formatCents, MAX_POINTS, normalizeRoomCode } from '../../../../game/logic'

type GameStatus = 'lobby' | 'guessing' | 'revealed' | 'finished'

interface Game {
  code: string
  hostId: string
  category: string
  status: GameStatus
  roundIndex: number
  totalRounds: number
}
interface Player {
  gameId: string
  userId: string
  score: number
  guessedRound: number
}
interface Round {
  gameId: string
  index: number
  title: string
  image: string
  rating: number | null
  link: string
  price: number | null
  results: Record<string, { guess: number; points: number }> | null
}

export default function GamePage() {
  const { code: rawCode } = useParams()
  const code = normalizeRoomCode(rawCode) ?? ''
  const { userId } = useAuth()
  const { getName } = useUserLookup()

  const games = useQuery<Game>('games', { where: { code }, limit: 1 })
  const gameRecord = games.records[0]
  const gameId = gameRecord?.recordId ?? ''
  const game = gameRecord?.data

  const players = useQuery<Player>('players', { where: { gameId }, limit: 50 })
  const rounds = useQuery<Round>('rounds', { where: { gameId }, orderBy: 'index', limit: 20 })

  if (games.status === 'loading') return <Centered>Loading room…</Centered>
  if (!game) {
    return (
      <Centered>
        <p className="text-lg font-semibold">No room called {code || rawCode}</p>
        <Link to="/play" className="mt-3 text-sm text-primary underline-offset-4 hover:underline">
          Back to Play
        </Link>
      </Centered>
    )
  }

  const nameOf = (uid: string) => (uid === userId ? 'You' : getName(uid) ?? 'Player')
  const playerRows = players.records.map((r) => r.data)
  const isHost = game.hostId === userId
  const isPlayer = playerRows.some((p) => p.userId === userId)
  const currentRound = rounds.records.find((r) => r.data.index === game.roundIndex)

  if (!isPlayer && players.status === 'ready' && game.status !== 'finished') {
    return <JoinPrompt code={game.code} />
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 lg:grid-cols-[1fr_300px]">
      <div className="min-w-0">
        <GameHeader game={game} />
        {game.status === 'lobby' && (
          <Lobby code={game.code} gameId={gameId} isHost={isHost} playerCount={playerRows.length} />
        )}
        {(game.status === 'guessing' || game.status === 'revealed') && currentRound && (
          <RoundView
            key={currentRound.recordId}
            gameId={gameId}
            game={game}
            round={currentRound.data}
            isHost={isHost}
            players={playerRows}
            nameOf={nameOf}
          />
        )}
        {game.status === 'finished' && (
          <FinalResults rounds={rounds.records.map((r) => r.data)} />
        )}
      </div>
      <Scoreboard
        players={playerRows}
        hostId={game.hostId}
        nameOf={nameOf}
        status={game.status}
        roundIndex={game.roundIndex}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------

function useAction() {
  const { error } = useToast()
  const [busy, setBusy] = useState(false)
  async function run(name: ActionName, params: Record<string, unknown>) {
    setBusy(true)
    try {
      return await callAction(name, params)
    } catch (e) {
      error((e as Error).message)
      return null
    } finally {
      setBusy(false)
    }
  }
  return { busy, run }
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center text-muted-foreground">
      {children}
    </div>
  )
}

function GameHeader({ game }: { game: Game }) {
  const category = findCategory(game.category)
  const roundLabel =
    game.status === 'lobby'
      ? `${game.totalRounds} rounds`
      : game.status === 'finished'
        ? 'Game over'
        : `Round ${game.roundIndex + 1} of ${game.totalRounds}`
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <span className="rounded-md bg-primary px-2 py-0.5 font-mono font-bold tracking-widest text-primary-foreground">
        {game.code}
      </span>
      <span>
        {category?.emoji} {category?.label}
      </span>
      <span aria-hidden>·</span>
      <span data-testid="round-label">{roundLabel}</span>
    </div>
  )
}

function JoinPrompt({ code }: { code: string }) {
  const { busy, run } = useAction()
  return (
    <Centered>
      <p className="text-lg font-semibold text-foreground">You've been invited to room {code}</p>
      <Button
        data-testid="join-this-room"
        className="mt-4"
        size="lg"
        loading={busy}
        onClick={() => run('joinGame', { code })}
      >
        Join game
      </Button>
    </Centered>
  )
}

function Lobby({
  code,
  gameId,
  isHost,
  playerCount,
}: {
  code: string
  gameId: string
  isHost: boolean
  playerCount: number
}) {
  const { busy, run } = useAction()
  const [copied, setCopied] = useState(false)
  const link = `${window.location.origin}/game/${code}`

  async function copyLink() {
    await navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-8 text-center">
      <p className="text-sm uppercase tracking-widest text-muted-foreground">Room code</p>
      <p data-testid="room-code" className="mt-2 font-mono text-6xl font-black tracking-[0.3em] text-primary">
        {code}
      </p>
      <button
        onClick={copyLink}
        className="mx-auto mt-4 flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        {copied ? 'Copied!' : 'Copy invite link'}
      </button>
      <p className="mt-8 text-sm text-muted-foreground">
        {playerCount === 1 ? 'Just you so far. Start solo, or wait for friends.' : `${playerCount} players in the room.`}
      </p>
      {isHost ? (
        <Button
          data-testid="start-game"
          size="lg"
          className="mt-4 px-10 text-base font-semibold"
          loading={busy}
          onClick={() => run('startGame', { gameId })}
        >
          Start game
        </Button>
      ) : (
        <p className="mt-4 font-medium text-foreground">Waiting for the host to start…</p>
      )}
    </section>
  )
}

function RoundView({
  gameId,
  game,
  round,
  isHost,
  players,
  nameOf,
}: {
  gameId: string
  game: Game
  round: Round
  isHost: boolean
  players: Player[]
  nameOf: (uid: string) => string
}) {
  const { userId } = useAuth()
  const { busy, run } = useAction()
  const [amount, setAmount] = useState('')
  // Guesses are hidden from every browser until the reveal, so we remember
  // our own locked-in guess locally just to show it back.
  const [myGuess, setMyGuess] = useState<number | null>(null)
  const revealed = game.status === 'revealed' && round.price !== null

  const waitingOn = players.filter((p) => p.guessedRound !== game.roundIndex)
  const isLastRound = game.roundIndex + 1 >= game.totalRounds

  async function submit(event: FormEvent) {
    event.preventDefault()
    const dollars = Number(amount)
    const ok = await run('submitGuess', { gameId, amount: dollars })
    if (ok) setMyGuess(dollars)
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid gap-0 md:grid-cols-2">
        <div className="flex items-center justify-center bg-white p-6">
          <img
            src={round.image}
            alt={round.title}
            className="max-h-72 w-auto object-contain"
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="flex flex-col p-6">
          <h2 data-testid="product-title" className="line-clamp-4 text-lg font-semibold leading-snug">
            {round.title}
          </h2>
          {round.rating ? (
            <p className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
              <Star className="h-4 w-4 fill-primary text-primary" /> {round.rating.toFixed(1)} on Amazon
            </p>
          ) : null}

          {!revealed ? (
            <div className="mt-auto pt-6">
              <form onSubmit={submit} className="flex gap-2">
                <div className="relative flex-1">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xl text-muted-foreground">
                    $
                  </span>
                  <Input
                    data-testid="guess-input"
                    type="number"
                    inputMode="decimal"
                    min="0.01"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    aria-label="Your price guess in dollars"
                    className="h-14 pl-8 text-2xl font-semibold"
                  />
                </div>
                <Button data-testid="submit-guess" type="submit" size="lg" className="h-14" loading={busy}>
                  {myGuess === null ? 'Lock in' : 'Change'}
                </Button>
              </form>
              <p className="mt-3 text-sm text-muted-foreground" data-testid="guess-status">
                {myGuess !== null
                  ? `Locked in at ${formatCents(Math.round(myGuess * 100))}. `
                  : ''}
                {waitingOn.length > 0
                  ? `Waiting on ${waitingOn.map((p) => nameOf(p.userId)).join(', ')}.`
                  : 'Everyone is in!'}
              </p>
              {isHost && waitingOn.length > 0 && players.length > 1 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  disabled={busy}
                  onClick={() => run('revealRound', { gameId })}
                >
                  Reveal now
                </Button>
              )}
            </div>
          ) : (
            <Reveal
              round={round}
              players={players}
              nameOf={nameOf}
              userId={userId}
            />
          )}

          {revealed && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              {isHost ? (
                <Button
                  data-testid="next-round"
                  size="lg"
                  loading={busy}
                  onClick={() => run('nextRound', { gameId })}
                >
                  {isLastRound ? 'See final results' : 'Next product'}
                </Button>
              ) : (
                <p className="text-sm text-muted-foreground">Waiting for the host to continue…</p>
              )}
              {round.link && (
                <a
                  href={round.link}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                >
                  View on Amazon <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function Reveal({
  round,
  players,
  nameOf,
  userId,
}: {
  round: Round
  players: Player[]
  nameOf: (uid: string) => string
  userId: string | null
}) {
  const results = round.results ?? {}
  const rows = players
    .map((p) => ({ userId: p.userId, result: results[p.userId] }))
    .sort((a, b) => (b.result?.points ?? -1) - (a.result?.points ?? -1))

  return (
    <div className="mt-6 animate-in fade-in-0 zoom-in-95">
      <p className="text-sm uppercase tracking-widest text-muted-foreground">Actual price</p>
      <p data-testid="actual-price" className="text-5xl font-black text-primary">
        {formatCents(round.price ?? 0)}
      </p>
      <ul className="mt-4 divide-y divide-border rounded-xl border border-border">
        {rows.map(({ userId: uid, result }) => (
          <li
            key={uid}
            className={cn('flex items-center justify-between px-3 py-2 text-sm', uid === userId && 'bg-primary/5')}
          >
            <span className="font-medium">{nameOf(uid)}</span>
            <span className="text-muted-foreground">
              {result ? formatCents(result.guess) : 'no guess'}
            </span>
            <span className="w-20 text-right font-semibold tabular-nums">
              +{result?.points ?? 0}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Scoreboard({
  players,
  hostId,
  nameOf,
  status,
  roundIndex,
}: {
  players: Player[]
  hostId: string
  nameOf: (uid: string) => string
  status: GameStatus
  roundIndex: number
}) {
  const sorted = [...players].sort((a, b) => b.score - a.score)
  return (
    <aside className="h-fit rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Scoreboard
      </h3>
      <ol className="space-y-1" data-testid="scoreboard">
        {sorted.map((p, i) => (
          <li key={p.userId} className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm">
            <span className="w-5 text-muted-foreground tabular-nums">{i + 1}</span>
            <span className="flex-1 truncate font-medium">
              {nameOf(p.userId)}
              {p.userId === hostId && (
                <Crown className="ml-1 inline h-3.5 w-3.5 text-primary" aria-label="host" />
              )}
            </span>
            {status === 'guessing' && (
              <span
                className={cn(
                  'text-xs',
                  p.guessedRound === roundIndex ? 'text-success' : 'text-muted-foreground',
                )}
              >
                {p.guessedRound === roundIndex ? 'locked in' : 'thinking…'}
              </span>
            )}
            <span className="w-14 text-right font-semibold tabular-nums">{p.score}</span>
          </li>
        ))}
      </ol>
    </aside>
  )
}

function FinalResults({ rounds }: { rounds: Round[] }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <h2 className="text-3xl font-black">Game over!</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Max {MAX_POINTS} points per product. Here's what everything really cost:
      </p>
      <ul className="mt-6 space-y-3">
        {[...rounds]
          .sort((a, b) => a.index - b.index)
          .map((r) => (
            <li key={r.index} className="flex items-center gap-4 rounded-xl border border-border p-3">
              <img
                src={r.image}
                alt=""
                className="h-14 w-14 shrink-0 rounded-lg bg-white object-contain p-1"
                referrerPolicy="no-referrer"
              />
              <span className="line-clamp-2 flex-1 text-sm">{r.title}</span>
              <span className="font-bold text-primary">{r.price !== null ? formatCents(r.price) : '—'}</span>
            </li>
          ))}
      </ul>
      <Link to="/play" className="mt-6 inline-block">
        <Button size="lg">Play again</Button>
      </Link>
    </section>
  )
}
