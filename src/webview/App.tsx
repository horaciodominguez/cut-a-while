import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { formatSecondsToTime } from '../core/utils/time.ts'
import type { WebviewToHostMessage } from '../shared/messages.ts'
import { TimerArc } from './components/TimerArc.tsx'
import { SessionDots } from './components/SessionDots.tsx'
import { IconPlay, IconPause, IconStop, IconReset, IconSkip, IconSettings, IconStats, IconTodo } from './components/Icons.tsx'
import { playCycleSound, unlockAudio } from './hooks/useSound.ts'
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
  const [accent, setAccent] = useState('blue')
  const [pulse, setPulse] = useState(false)
  const prevCompletedRef = useRef(state.completedSessions)
  const prevCycleRef = useRef(state.cycleType)
  const firstStateRef = useRef(true)
  const taskInputRef = useRef<HTMLInputElement>(null)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const [soundTheme, setSoundTheme] = useState('bell')
  const [longBreakInterval, setLongBreakInterval] = useState(4)
  const [streak, setStreak] = useState(0)
  const soundEnabledRef = useRef(soundEnabled)
  const soundThemeRef = useRef(soundTheme)
  soundEnabledRef.current = soundEnabled
  soundThemeRef.current = soundTheme

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
        if (typeof msg.settings.longBreakInterval === 'number') {
          setLongBreakInterval(Math.max(1, msg.settings.longBreakInterval))
        }
      }
      if (msg.command === 'todosUpdate') setTodos(msg.todos)
      if (msg.command === 'openStats') {
        setStatsOpen(true)
        setSettingsOpen(false)
        setTodoOpen(false)
      }
      if (msg.command === 'playSound' && (msg.type === 'work' || msg.type === 'break')) {
        unlockAudio()
        void playCycleSound(
          typeof msg.theme === 'string' ? msg.theme : soundThemeRef.current,
          msg.type,
          msg.preview === true ? true : soundEnabledRef.current,
        )
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
    if (state.completedSessions > prevCompletedRef.current && !prefersReducedMotion()) {
      setPulse(true)
      const t = setTimeout(() => setPulse(false), 280)
      prevCompletedRef.current = state.completedSessions
      prevCycleRef.current = state.cycleType
      return () => clearTimeout(t)
    }
    prevCompletedRef.current = state.completedSessions
    prevCycleRef.current = state.cycleType
  }, [state.completedSessions, state.cycleType])

  useEffect(() => {
    if (document.activeElement === taskInputRef.current) return
    setTask(state.currentTask)
  }, [state.currentTask])

  const send = useCallback((msg: WebviewToHostMessage) => {
    postMessage(msg)
  }, [])

  const handleStart = (taskText?: string) => {
    if (state.status === 'break') {
      send({ command: 'skipBreak' })
      setTask('')
      return
    }
    const t = (taskText ?? task).trim()
    if (t) {
      const exists = todos.some((td) => td.text === t && !td.done)
      if (!exists) postMessage({ command: 'addTodo', text: t })
      send({ command: 'setTask', task: t })
    }
    send(t ? { command: 'start', task: t } : { command: 'start' })
  }

  const commitTaskEdit = () => {
    if (state.status !== 'running' && state.status !== 'paused') return
    const t = task.trim()
    if (t === state.currentTask) return
    send({ command: 'setTask', task: t })
  }

  const openPanel = (panel: 'settings' | 'stats' | 'todo') => {
    setSettingsOpen(panel === 'settings')
    setStatsOpen(panel === 'stats')
    setTodoOpen(panel === 'todo')
  }

  const confirmStop = () => {
    if (state.status === 'running' || state.status === 'paused') {
      send({ command: 'confirmStop' })
      return
    }
    send({ command: 'stop' })
  }

  const confirmReset = () => {
    send({ command: 'confirmReset' })
  }

  const pendingTodos = todos.filter((t) => !t.done)
  const isBreak = state.cycleType === 'break'
  const isActive = state.status === 'running' || state.status === 'break'
  const timeStr = formatSecondsToTime(state.timeLeft)
  const accentHex = accentColor(accent)
  const phaseColor = isBreak ? 'var(--break)' : accentHex
  const arcStroke = isBreak ? '#34d399' : accentHex
  const dotsColor = arcStroke

  return (
    <div className={`timer-shell ${isBreak ? 'is-break' : 'is-work'}`}>
      <header className="timer-header">
        <span className="wordmark">Cut a While</span>
        <nav className="header-actions" aria-label="Panel navigation">
          <button className="icon-btn" onClick={() => openPanel('settings')} aria-label="Settings" aria-pressed={settingsOpen}>
            <IconSettings />
          </button>
          <button className="icon-btn" onClick={() => openPanel('stats')} aria-label="Stats" aria-pressed={statsOpen}>
            <IconStats />
          </button>
          <button className="icon-btn" onClick={() => openPanel('todo')} aria-label="Tasks" aria-pressed={todoOpen}>
            <IconTodo />
          </button>
        </nav>
      </header>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} onAccentChange={handleAccentChange} />
      <StatsPanel open={statsOpen} onClose={() => setStatsOpen(false)} />
      <TodoPanel open={todoOpen} onClose={() => setTodoOpen(false)} />

      <section className="timer-hero">
        <div className="relative">
          <TimerArc
            timeLeft={state.timeLeft}
            totalTime={state.totalTime}
            stroke={arcStroke}
            status={state.status}
            pulse={pulse}
          />
          <div className="timer-display">
            <time
              className={`timer-time ${pulse ? 'is-pulse' : ''}`}
              dateTime={`PT${state.timeLeft}S`}
              style={{ '--phase-color': phaseColor } as CSSProperties}
            >
              {timeStr}
            </time>
            <span
              className={`timer-phase ${isActive ? 'is-active' : ''}`}
              style={{ '--phase-color': phaseColor } as CSSProperties}
              aria-live="polite"
            >
              {STATUS_LABELS[state.status]}
            </span>
          </div>
        </div>
      </section>

      <div className="timer-meta">
        <SessionDots completed={state.completedSessions} total={longBreakInterval} accent={dotsColor} />
        <StreakIndicator streak={streak} />

        {(state.status === 'idle' || state.status === 'stopped') && pendingTodos.length > 0 && (
          <div className="task-chips">
            {pendingTodos.slice(0, 5).map((td) => (
              <button
                key={td.id}
                type="button"
                className={`task-chip${task === td.text ? ' is-selected' : ''}`}
                aria-pressed={task === td.text}
                onClick={() => setTask(td.text)}
              >
                {td.text}
              </button>
            ))}
          </div>
        )}

        {state.status !== 'break' && (
          <input
            ref={taskInputRef}
            type="text"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            onBlur={commitTaskEdit}
            placeholder="What are you working on?"
            className="task-input"
            aria-label="Current task"
            onKeyDown={(e) => {
              if (e.key !== 'Enter') return
              if (state.status === 'running' || state.status === 'paused') {
                commitTaskEdit()
                return
              }
              handleStart()
            }}
          />
        )}

        <div className="timer-actions">
          {(state.status === 'idle' || state.status === 'stopped') && (
            <button className="btn-primary" onClick={() => handleStart()}>
              <IconPlay /> Start
            </button>
          )}
          {state.status === 'running' && (
            <>
              <button className="btn-primary" onClick={() => send({ command: 'pause' })}>
                <IconPause /> Pause
              </button>
              <button className="btn-ghost" onClick={confirmStop}>
                <IconStop /> Stop
              </button>
            </>
          )}
          {state.status === 'paused' && (
            <>
              <button className="btn-primary" onClick={() => send({ command: 'resume' })}>
                <IconPlay /> Resume
              </button>
              <button className="btn-ghost" onClick={confirmStop}>
                <IconStop /> Stop
              </button>
            </>
          )}
          {state.status === 'break' && (
            <button className="btn-primary" onClick={() => handleStart()} style={{ background: 'var(--break)' }}>
              <IconSkip /> Skip break
            </button>
          )}
          {state.status === 'stopped' && (
            <button className="btn-ghost" onClick={confirmReset}>
              <IconReset /> Reset
            </button>
          )}
        </div>
      </div>

      {state.completedSessions > 0 && (
        <footer className="timer-footer">
          {state.completedSessions} pomodoro{state.completedSessions !== 1 ? 's' : ''} today
        </footer>
      )}
    </div>
  )
}

export default App
