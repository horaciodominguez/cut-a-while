import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { postMessage } from '../vscodeApi.ts'

interface Session {
  timestamp: number
  type: string
  duration: number
  task: string
}

interface StatsPanelProps {
  onClose: () => void
}

function isToday(ts: number): boolean {
  const d = new Date(ts)
  const n = new Date()
  return d.getDate() === n.getDate() && d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear()
}

function isThisWeek(ts: number): boolean {
  const d = new Date(ts)
  const n = new Date()
  const weekStart = new Date(n)
  weekStart.setDate(n.getDate() - n.getDay())
  weekStart.setHours(0, 0, 0, 0)
  return d >= weekStart
}

function dayLabel(date: Date): string {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const n = new Date()
  if (date.getDate() === n.getDate() && date.getMonth() === n.getMonth()) return 'Today'
  const y = new Date(n)
  y.setDate(n.getDate() - 1)
  if (date.getDate() === y.getDate() && date.getMonth() === y.getMonth()) return 'Yest'
  return days[date.getDay()]
}

function getWeekDays(): Date[] {
  const days: Date[] = []
  const n = new Date()
  for (let i = 6; i >= 0; i--) {
    const d = new Date(n)
    d.setDate(n.getDate() - i)
    d.setHours(0, 0, 0, 0)
    days.push(d)
  }
  return days
}

export function StatsPanel({ onClose }: StatsPanelProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [projects, setProjects] = useState<Record<string, number>>({})

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data
      if (msg.command === 'sessionsUpdate') {
        setSessions(msg.sessions)
      }
      if (msg.command === 'projectFocusUpdate') {
        setProjects(msg.projects || {})
      }
    }
    window.addEventListener('message', handler)
    postMessage({ command: 'getSessions' })
    postMessage({ command: 'getProjectFocus' })
    return () => window.removeEventListener('message', handler)
  }, [])

  const workSessions = useMemo(() => sessions.filter((s) => s.type === 'work'), [sessions])

  const today = useMemo(() => workSessions.filter((s) => isToday(s.timestamp)), [workSessions])
  const week = useMemo(() => workSessions.filter((s) => isThisWeek(s.timestamp)), [workSessions])

  const weekDays = useMemo(() => {
    const days = getWeekDays()
    return days.map((d) => {
      const count = workSessions.filter((s) => {
        const sd = new Date(s.timestamp)
        return sd.getDate() === d.getDate() && sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear()
      }).length
      return { label: dayLabel(d), count, max: 0 }
    })
  }, [workSessions])

  const maxCount = Math.max(1, ...weekDays.map((d) => d.count))
  const weekDaysWithMax = weekDays.map((d) => ({ ...d, max: maxCount }))

  const totalMinutes = useMemo(
    () => workSessions.reduce((sum, s) => sum + Math.round(s.duration / 60), 0),
    [workSessions],
  )

  const topTasks = useMemo(() => {
    const map = new Map<string, number>()
    workSessions.forEach((s) => {
      if (!s.task) return
      map.set(s.task, (map.get(s.task) || 0) + 1)
    })
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  }, [workSessions])

  const topTaskMax = Math.max(1, ...topTasks.map(([, c]) => c))

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed top-0 right-0 z-50 h-full w-72 max-w-[85vw] bg-[#1a1a2e]/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl overflow-y-auto"
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-white/80 uppercase tracking-widest">Stats</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-white/30 hover:text-white/70 hover:bg-white/10 transition-all cursor-pointer"
              aria-label="Close stats"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-6">
            <Card value={today.length} label="Today" />
            <Card value={week.length} label="Week" />
            <Card value={workSessions.length} label="Total" />
          </div>

          {workSessions.length > 0 && (
            <p className="text-xs text-white/40 text-center mb-5">
              {totalMinutes} min of focus
            </p>
          )}

          <div className="space-y-1.5 mb-6">
            <h3 className="text-[10px] uppercase tracking-[0.15em] text-white/30 mb-3 font-semibold">Last 7 days</h3>
            <div className="flex items-end justify-between gap-1.5 h-24">
              {weekDaysWithMax.map((d) => (
                <div key={d.label} className="flex flex-col items-center gap-1.5 flex-1">
                  <span className="text-[10px] text-white/40 tabular-nums">{d.count}</span>
                  <div className="w-full bg-white/8 rounded-t-sm relative" style={{ height: `${(d.count / d.max) * 100}%`, minHeight: d.count > 0 ? '4px' : '2px', backgroundColor: d.count > 0 ? 'rgba(59,130,246,0.6)' : 'rgba(255,255,255,0.05)' }} />
                  <span className="text-[9px] text-white/30">{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          {topTasks.length > 0 && (
            <div className="space-y-1.5 mb-6">
              <h3 className="text-[10px] uppercase tracking-[0.15em] text-white/30 mb-3 font-semibold">Top Tasks</h3>
              <div className="space-y-2">
                {topTasks.map(([taskName, count]) => (
                  <div key={taskName} className="flex items-center gap-2">
                    <span className="text-xs text-white/70 flex-1 truncate">{taskName}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 rounded-full bg-white/8 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500/60" style={{ width: `${(count / topTaskMax) * 100}%` }} />
                      </div>
                      <span className="text-[10px] text-white/40 tabular-nums w-6 text-right">{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(projects).length > 0 && (
            <div className="space-y-1.5">
              <h3 className="text-[10px] uppercase tracking-[0.15em] text-white/30 mb-3 font-semibold">Projects</h3>
              <div className="space-y-2">
                {Object.entries(projects)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, seconds]) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-xs text-white/70 truncate">{name}</span>
                      <span className="text-[10px] text-white/40 tabular-nums">{Math.round(seconds / 60)} min</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}

function Card({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl bg-white/5 border border-white/8">
      <span className="text-lg font-bold text-white/80 tabular-nums">{value}</span>
      <span className="text-[10px] uppercase tracking-wider text-white/40">{label}</span>
    </div>
  )
}
