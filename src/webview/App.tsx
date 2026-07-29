import { useCallback, useEffect, useState } from 'react'
import { formatSecondsToTime } from '../core/utils/time.ts'

type TimerStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'break'
type CycleType = 'work' | 'break'

interface TimerState {
  status: TimerStatus
  timeLeft: number
  cycleType: CycleType
  completedSessions: number
  currentTask: string
}

declare global {
  function acquireVsCodeApi(): {
    postMessage: (msg: unknown) => void
    getState: () => unknown
    setState: (state: unknown) => void
  }
}

const vscode = acquireVsCodeApi()

const STATUS_LABELS: Record<TimerStatus, string> = {
  idle: 'Ready',
  running: 'Focus',
  paused: 'Paused',
  stopped: 'Stopped',
  break: 'Break',
}

const CYCLE_COLORS: Record<CycleType, string> = {
  work: 'from-blue-500 via-cyan-400 to-blue-300',
  break: 'from-emerald-500 via-green-400 to-emerald-300',
}

function App() {
  const [state, setState] = useState<TimerState>({
    status: 'idle',
    timeLeft: 25 * 60,
    cycleType: 'work',
    completedSessions: 0,
    currentTask: '',
  })
  const [task, setTask] = useState('')

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data
      if (msg.command === 'stateUpdate') {
        const { command, ...timerState } = msg as { command: string } & TimerState
        setState(timerState as TimerState)
        vscode.setState(timerState)
      }
    }
    window.addEventListener('message', handler)
    vscode.postMessage({ command: 'getState' })
    return () => window.removeEventListener('message', handler)
  }, [])

  const send = useCallback((command: string, payload?: Record<string, unknown>) => {
    vscode.postMessage({ command, ...payload })
  }, [])

  const handleStart = () => {
    const t = task.trim()
    if (t) {
      send('setTask', { task: t })
    }
    send('start', { task: t || undefined })
  }

  const progress = state.cycleType === 'work'
    ? state.timeLeft / (25 * 60)
    : state.timeLeft / (5 * 60)

  const circumference = 2 * Math.PI * 120
  const offset = circumference * (1 - Math.min(Math.max(progress, 0), 1))

  const sessionDots = Array.from({ length: 4 }, (_, i) => i < state.completedSessions % 4)

  return (
    <div className="flex flex-col items-center min-h-screen px-4 py-6 select-none">
      <div className="relative w-72 h-72 mb-6">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 260 260">
          <circle
            cx="130" cy="130" r="120"
            fill="none"
            stroke="currentColor"
            strokeWidth="6"
            className="text-white/10"
          />
          <circle
            cx="130" cy="130" r="120"
            fill="none"
            stroke="url(#ringGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-linear"
          />
          <defs>
            <linearGradient id="ringGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="currentColor" className="text-blue-500" />
              <stop offset="100%" stopColor="currentColor" className="text-cyan-400" />
            </linearGradient>
          </defs>
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-5xl font-mono font-bold tracking-wider text-white tabular-nums">
            {formatSecondsToTime(state.timeLeft)}
          </span>
          <span className="text-sm text-white/60 mt-1 uppercase tracking-widest">
            {STATUS_LABELS[state.status]}
          </span>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {sessionDots.map((filled, i) => (
          <span
            key={i}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              filled ? 'bg-blue-400 scale-110' : 'bg-white/20'
            }`}
          />
        ))}
      </div>

      <div className="w-full max-w-xs space-y-3">
        {state.status === 'idle' && (
          <input
            type="text"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="What are you working on?"
            className="w-full px-4 py-2 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/40 text-center text-sm focus:outline-none focus:border-blue-400/50 transition-colors"
            onKeyDown={(e) => e.key === 'Enter' && handleStart()}
          />
        )}

        <div className="flex justify-center gap-3">
          {(state.status === 'idle' || state.status === 'stopped') && (
            <ControlButton icon="▶" label="Start" onClick={handleStart} primary />
          )}
          {state.status === 'running' && (
            <ControlButton icon="⏸" label="Pause" onClick={() => send('pause')} primary />
          )}
          {state.status === 'paused' && (
            <ControlButton icon="▶" label="Resume" onClick={() => send('resume')} primary />
          )}
          {state.status === 'break' && (
            <ControlButton icon="▶" label="Skip Break" onClick={handleStart} primary />
          )}
          {(state.status === 'running' || state.status === 'paused') && (
            <ControlButton icon="⏹" label="Stop" onClick={() => send('stop')} secondary />
          )}
          {state.status === 'stopped' && (
            <ControlButton icon="↺" label="Reset" onClick={() => send('reset')} secondary />
          )}
        </div>
      </div>

      {state.completedSessions > 0 && (
        <p className="mt-6 text-xs text-white/40">
          {state.completedSessions} pomodoro{state.completedSessions !== 1 ? 's' : ''} completed today
        </p>
      )}
    </div>
  )
}

function ControlButton({
  icon,
  label,
  onClick,
  primary,
  secondary,
}: {
  icon: string
  label: string
  onClick: () => void
  primary?: boolean
  secondary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`px-5 py-2 rounded-full text-sm font-medium transition-all duration-200 active:scale-95 cursor-pointer
        ${primary
          ? 'bg-blue-500/80 text-white hover:bg-blue-500/90 shadow-lg shadow-blue-500/20'
          : secondary
            ? 'bg-white/10 text-white/70 hover:bg-white/20 border border-white/10'
            : ''
        }`}
    >
      {icon} {label}
    </button>
  )
}

export default App
