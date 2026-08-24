import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { formatSecondsToTime } from '../core/utils/time.ts'
import { Surface } from './components/Surface.tsx'
import { TimerRing } from './components/TimerRing.tsx'
import { ActionButton } from './components/ActionButton.tsx'
import { SessionDots } from './components/SessionDots.tsx'
import { IconPlay, IconPause, IconStop, IconReset, IconSkip, IconSettings, IconStats, IconTodo } from './components/Icons.tsx'
import { useSound } from './hooks/useSound.ts'
import { SettingsPanel } from './components/SettingsPanel.tsx'
import { StatsPanel } from './components/StatsPanel.tsx'
import { TodoPanel } from './components/TodoPanel.tsx'
import { StreakIndicator } from './components/StreakIndicator.tsx'
import { applyAccent, accentColor } from './theme.ts'
import { postMessage, setVsCodeState } from './vscodeApi.ts'

type TimerStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'break'

interface TimerState {
  status: TimerStatus
  timeLeft: number
  totalTime: number
  cycleType: 'work' | 'break'
  completedSessions: number
  currentTask: string
}

interface TodoItem {
  id: string
  text: string
  done: boolean
  createdAt: number
  completedAt?: number
}

const STATUS_LABELS: Record<TimerStatus, string> = {
  idle: 'Ready',
  running: 'Focus',
  paused: 'Paused',
  stopped: 'Stopped',
  break: 'Break',
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function App() {
  const [state, setState] = useState<TimerState>({
    status: 'idle',
    timeLeft: 25 * 60,
    totalTime: 25 * 60,
    cycleType: 'work',
    completedSessions: 0,
    currentTask: '',
  })
  const [task, setTask] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [statsOpen, setStatsOpen] = useState(false)
  const [todoOpen, setTodoOpen] = useState(false)
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [showNewInput, setShowNewInput] = useState(false)
  const [accent, setAccent] = useState('blue')
  const [pulse, setPulse] = useState(false)
  const prevCompletedRef = useRef(state.completedSessions)
  const prevCycleRef = useRef(state.cycleType)
  const firstStateRef = useRef(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [soundTheme, setSoundTheme] = useState('bell')
  const [streak, setStreak] = useState(0)
  const { playWorkComplete, playBreakComplete } = useSound(
    soundEnabled,
    soundTheme as 'bell' | 'digital' | 'nature' | 'zen' | 'soft' | 'classic',
  )

  const handleAccentChange = useCallback((id: string) => {
    setAccent(id)
    applyAccent(id)
  }, [])

  useEffect(() => {
    applyAccent(accent)
  }, [accent])

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data
      if (msg.command === 'stateUpdate') {
        const timerState: TimerState = msg
        setState(timerState)
        setVsCodeState(timerState)
        if (typeof msg.streak === 'number') setStreak(msg.streak)
      }
      if (msg.command === 'settingsUpdate') {
        setSoundEnabled(msg.settings.soundEnabled)
        if (msg.settings.soundTheme) setSoundTheme(msg.settings.soundTheme)
        if (msg.settings.accent) handleAccentChange(msg.settings.accent)
      }
      if (msg.command === 'todosUpdate') {
        setTodos(msg.todos)
      }
      if (msg.command === 'openStats') {
        setStatsOpen(true)
        setSettingsOpen(false)
        setTodoOpen(false)
      }
    }
    window.addEventListener('message', handler)
    postMessage({ command: 'getState' })
    postMessage({ command: 'getSettings' })
    postMessage({ command: 'getTodos' })
    return () => window.removeEventListener('message', handler)
  }, [handleAccentChange])

  useEffect(() => {
    if (firstStateRef.current) {
      firstStateRef.current = false
      prevCompletedRef.current = state.completedSessions
      prevCycleRef.current = state.cycleType
      return
    }
    if (state.completedSessions > prevCompletedRef.current) {
      playWorkComplete()
      if (!prefersReducedMotion()) {
        setPulse(true)
        const t = setTimeout(() => setPulse(false), 300)
        prevCompletedRef.current = state.completedSessions
        prevCycleRef.current = state.cycleType
        return () => clearTimeout(t)
      }
    }
    if (prevCycleRef.current === 'break' && state.cycleType === 'work') {
      playBreakComplete()
    }
    prevCompletedRef.current = state.completedSessions
    prevCycleRef.current = state.cycleType
  }, [state.completedSessions, state.cycleType, playWorkComplete, playBreakComplete])

  const send = useCallback((command: string, payload?: Record<string, unknown>) => {
    postMessage({ command, ...payload })
  }, [])

  const handleStart = (taskText?: string) => {
    if (state.status === 'break') {
      send('skipBreak')
      setTask('')
      return
    }
    const t = (taskText ?? task).trim()
    if (t) {
      const exists = todos.some((td) => td.text === t && !td.done)
      if (!exists) {
        postMessage({ command: 'addTodo', text: t })
      }
      send('setTask', { task: t })
    }
    send('start', { task: t || undefined })
    setShowNewInput(false)
  }

  const handleChipClick = (text: string) => {
    setTask(text)
    handleStart(text)
  }

  const openPanel = (panel: 'settings' | 'stats' | 'todo') => {
    setSettingsOpen(panel === 'settings')
    setStatsOpen(panel === 'stats')
    setTodoOpen(panel === 'todo')
  }

  const pendingTodos = todos.filter((t) => !t.done)
  const isBreak = state.cycleType === 'break'
  const timeStr = formatSecondsToTime(state.timeLeft)
  const accentHex = accentColor(accent)
  const reduceMotion = prefersReducedMotion()

  return (
    <>
      <div className={`timer-bg ${isBreak ? 'is-break' : 'is-work'}`} aria-hidden="true" />

      <div className="fixed top-3 right-3 z-30 flex items-center gap-0.5">
        <button className="icon-btn" onClick={() => openPanel('settings')} aria-label="Open settings">
          <IconSettings />
        </button>
        <button className="icon-btn" onClick={() => openPanel('stats')} aria-label="Open stats">
          <IconStats />
        </button>
        <button className="icon-btn" onClick={() => openPanel('todo')} aria-label="Open tasks">
          <IconTodo />
        </button>
      </div>

      <SettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onAccentChange={handleAccentChange}
      />
      <StatsPanel open={statsOpen} onClose={() => setStatsOpen(false)} />
      <TodoPanel open={todoOpen} onClose={() => setTodoOpen(false)} />

      <div className="flex flex-col items-center min-h-screen px-4 py-6 select-none">
        <Surface className="w-full max-w-xs p-6 sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={reduceMotion ? 'static' : state.status}
              initial={reduceMotion ? false : { opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className="flex flex-col items-center gap-5"
            >
              <div className="relative w-56 h-56 sm:w-60 sm:h-60">
                <TimerRing
                  timeLeft={state.timeLeft}
                  totalTime={state.totalTime}
                  isBreak={isBreak}
                  status={state.status}
                  accent={accentHex}
                  pulse={pulse}
                />
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span
                    className="font-mono text-5xl sm:text-6xl font-semibold tabular-nums tracking-tight"
                    style={{ color: 'var(--text)' }}
                  >
                    {timeStr}
                  </span>
                  <span
                    className="text-xs mt-2 font-medium"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {STATUS_LABELS[state.status]}
                  </span>
                </div>
              </div>

              <SessionDots completed={state.completedSessions} accent={accentHex} />
              <StreakIndicator streak={streak} />

              <div className="w-full space-y-3">
                {state.status === 'idle' && !showNewInput && pendingTodos.length > 0 && (
                  <div className="flex flex-wrap justify-center gap-1.5">
                    {pendingTodos.slice(0, 6).map((td) => (
                      <button
                        key={td.id}
                        onClick={() => handleChipClick(td.text)}
                        className="px-2.5 py-1 text-xs rounded cursor-pointer truncate max-w-[140px] border transition-colors"
                        style={{
                          color: 'var(--text-muted)',
                          borderColor: 'var(--surface-border)',
                          background: 'transparent',
                        }}
                      >
                        {td.text}
                      </button>
                    ))}
                    <button
                      onClick={() => setShowNewInput(true)}
                      className="px-2.5 py-1 text-xs rounded cursor-pointer border border-dashed"
                      style={{ color: 'var(--text-muted)', borderColor: 'var(--surface-border)' }}
                    >
                      + new
                    </button>
                  </div>
                )}
                {state.status === 'idle' && (showNewInput || pendingTodos.length === 0) && (
                  <input
                    type="text"
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                    placeholder="What are you working on?"
                    className="w-full px-3 py-2 rounded text-sm text-center focus:outline-none"
                    style={{
                      background: 'var(--input-bg)',
                      border: '1px solid var(--input-border)',
                      color: 'var(--input-fg)',
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                  />
                )}
                {state.status === 'running' && state.currentTask && (
                  <p className="text-xs text-center truncate px-2" style={{ color: 'var(--text-muted)' }}>
                    {state.currentTask}
                  </p>
                )}

                <div className="flex justify-center gap-2">
                  {(state.status === 'idle' || state.status === 'stopped') && (
                    <ActionButton icon={<IconPlay />} label="Start" onClick={handleStart} primary />
                  )}
                  {state.status === 'running' && (
                    <ActionButton icon={<IconPause />} label="Pause" onClick={() => send('pause')} primary />
                  )}
                  {state.status === 'paused' && (
                    <ActionButton icon={<IconPlay />} label="Resume" onClick={() => send('resume')} primary />
                  )}
                  {state.status === 'break' && (
                    <ActionButton icon={<IconSkip />} label="Skip Break" onClick={handleStart} primary />
                  )}
                  {(state.status === 'running' || state.status === 'paused') && (
                    <ActionButton icon={<IconStop />} label="Stop" onClick={() => send('stop')} secondary />
                  )}
                  {state.status === 'stopped' && (
                    <ActionButton icon={<IconReset />} label="Reset" onClick={() => send('reset')} secondary />
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </Surface>

        {state.completedSessions > 0 && (
          <p className="mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
            {state.completedSessions} pomodoro{state.completedSessions !== 1 ? 's' : ''} completed today
          </p>
        )}
      </div>
    </>
  )
}

export default App
