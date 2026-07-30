import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { formatSecondsToTime } from '../core/utils/time.ts'
import { AnimatedBackground } from './components/AnimatedBackground.tsx'
import { GlassCard } from './components/GlassCard.tsx'
import { TimerRing } from './components/TimerRing.tsx'
import { FlipCard } from './components/FlipCard.tsx'
import { RippleButton } from './components/RippleButton.tsx'
import { SessionDots } from './components/SessionDots.tsx'
import { IconPlay, IconPause, IconStop, IconReset, IconSkip } from './components/Icons.tsx'
import { useConfetti } from './hooks/useConfetti.ts'
import { useSound } from './hooks/useSound.ts'
import { SettingsPanel } from './components/SettingsPanel.tsx'
import { StatsPanel } from './components/StatsPanel.tsx'

type TimerStatus = 'idle' | 'running' | 'paused' | 'stopped' | 'break'

interface TimerState {
  status: TimerStatus
  timeLeft: number
  totalTime: number
  cycleType: 'work' | 'break'
  completedSessions: number
  currentTask: string
}

import { postMessage, setVsCodeState } from './vscodeApi.ts'

const STATUS_LABELS: Record<TimerStatus, string> = {
  idle: 'Ready',
  running: 'Focus',
  paused: 'Paused',
  stopped: 'Stopped',
  break: 'Break',
}

function App() {
  const [state, setState] = useState<TimerState>({
    status: 'idle',
    timeLeft: 60,
    totalTime: 60,
    cycleType: 'work',
    completedSessions: 0,
    currentTask: '',
  })
  const [task, setTask] = useState('')
  const [statsOpen, setStatsOpen] = useState(false)
  const prevCompletedRef = useRef(state.completedSessions)
  const prevCycleRef = useRef(state.cycleType)
  const firstStateRef = useRef(true)
  const [soundEnabled, setSoundEnabled] = useState(true)
  const fireConfetti = useConfetti()
  const { playWorkComplete, playBreakComplete } = useSound(soundEnabled)

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data
      console.log('[Webview] message received:', msg.command, msg)
      if (msg.command === 'stateUpdate') {
        const timerState: TimerState = msg
        setState(timerState)
        setVsCodeState(timerState)
      }
      if (msg.command === 'settingsUpdate') {
        setSoundEnabled(msg.settings.soundEnabled)
      }
    }
    window.addEventListener('message', handler)
    postMessage({ command: 'getState' })
    postMessage({ command: 'getSettings' })
    return () => window.removeEventListener('message', handler)
  }, [])

  useEffect(() => {
    if (firstStateRef.current) {
      firstStateRef.current = false
      prevCompletedRef.current = state.completedSessions
      prevCycleRef.current = state.cycleType
      return
    }
    if (state.completedSessions > prevCompletedRef.current) {
      fireConfetti(state.completedSessions % 4 === 0)
      playWorkComplete()
    }
    if (prevCycleRef.current === 'break' && state.cycleType === 'work') {
      playBreakComplete()
    }
    prevCompletedRef.current = state.completedSessions
    prevCycleRef.current = state.cycleType
  }, [state.completedSessions, fireConfetti, state.cycleType, playWorkComplete, playBreakComplete])

  const send = useCallback((command: string, payload?: Record<string, unknown>) => {
    postMessage({ command, ...payload })
  }, [])

  const handleStart = () => {
    if (state.status === 'break') {
      send('skipBreak')
      setTask('')
      return
    }
    const t = task.trim()
    if (t) {
      send('setTask', { task: t })
    }
    send('start', { task: t || undefined })
  }

  const isBreak = state.cycleType === 'break'
  const timeStr = formatSecondsToTime(state.timeLeft)
  const digits = timeStr.replace(':', '').split('')

  return (
    <>
      <AnimatedBackground isBreak={isBreak} />
      <SettingsPanel />
      <button
        onClick={() => setStatsOpen(true)}
        className="fixed top-14 right-4 z-30 p-2 rounded-full bg-white/8 border border-white/10 text-white/50 hover:text-white/80 hover:bg-white/15 transition-all duration-200 cursor-pointer"
        aria-label="Open stats"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="18" rx="1"/>
          <rect x="14" y="8" width="7" height="13" rx="1"/>
        </svg>
      </button>
      {statsOpen && <StatsPanel onClose={() => setStatsOpen(false)} />}

      <div className="flex flex-col items-center min-h-screen px-4 py-6 select-none">
        <GlassCard className="w-full max-w-xs p-6 sm:p-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={state.status}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="flex flex-col items-center gap-6"
            >
              <div className="relative w-64 h-64 sm:w-64 sm:h-64">
                <TimerRing
                  timeLeft={state.timeLeft}
                  totalTime={state.totalTime}
                  isBreak={isBreak}
                  status={state.status}
                />

                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <div className="flex items-center gap-0.5 mb-1">
                    <FlipCard digit={digits[0]} label="" />
                    <FlipCard digit={digits[1]} label="" />
                    <span className="text-white/40 text-xl font-bold mx-0.5 mt-0.5">:</span>
                    <FlipCard digit={digits[2]} label="" />
                    <FlipCard digit={digits[3]} label="" />
                  </div>
                  <motion.span
                    key={state.status}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-white/50 mt-2 uppercase tracking-[0.2em] font-medium"
                  >
                    {STATUS_LABELS[state.status]}
                  </motion.span>
                </div>
              </div>

              <SessionDots completed={state.completedSessions} />

              <div className="w-full space-y-3">
                {state.status === 'idle' && (
                  <motion.input
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    type="text"
                    value={task}
                    onChange={(e) => setTask(e.target.value)}
                    placeholder="What are you working on?"
                    className="w-full px-4 py-2.5 bg-white/8 border border-white/10 rounded-xl text-white placeholder-white/35 text-sm text-center focus:outline-none focus:border-blue-400/50 focus:bg-white/10 transition-all duration-200"
                    onKeyDown={(e) => e.key === 'Enter' && handleStart()}
                  />
                )}
                {state.status === 'running' && state.currentTask && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-white/40 text-center truncate px-2"
                  >
                    {state.currentTask}
                  </motion.p>
                )}

                <div className="flex justify-center gap-2.5">
                  {(state.status === 'idle' || state.status === 'stopped') && (
                    <RippleButton icon={<IconPlay />} label="Start" onClick={handleStart} primary />
                  )}
                  {state.status === 'running' && (
                    <RippleButton icon={<IconPause />} label="Pause" onClick={() => send('pause')} primary />
                  )}
                  {state.status === 'paused' && (
                    <RippleButton icon={<IconPlay />} label="Resume" onClick={() => send('resume')} primary />
                  )}
                  {state.status === 'break' && (
                    <RippleButton icon={<IconSkip />} label="Skip Break" onClick={handleStart} primary />
                  )}
                  {(state.status === 'running' || state.status === 'paused') && (
                    <RippleButton icon={<IconStop />} label="Stop" onClick={() => send('stop')} secondary />
                  )}
                  {state.status === 'stopped' && (
                    <RippleButton icon={<IconReset />} label="Reset" onClick={() => send('reset')} secondary />
                  )}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </GlassCard>

        {state.completedSessions > 0 && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 text-xs text-white/35"
          >
            {state.completedSessions} pomodoro{state.completedSessions !== 1 ? 's' : ''} completed today
          </motion.p>
        )}
      </div>
    </>
  )
}

export default App
