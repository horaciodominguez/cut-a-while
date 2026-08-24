import { useEffect, useMemo, useState } from 'react'
import { postMessage } from '../vscodeApi.ts'
import { DrawerPanel } from './DrawerPanel.tsx'

interface Session {
  timestamp: number
  type: string
  duration: number
  task: string
}

interface StatsPanelProps {
  open: boolean
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

export function StatsPanel({ open, onClose }: StatsPanelProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [projects, setProjects] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!open) return
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
  }, [open])

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
      return { label: dayLabel(d), count }
    })
  }, [workSessions])

  const maxCount = Math.max(1, ...weekDays.map((d) => d.count))
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
    <DrawerPanel title="Stats" open={open} onClose={onClose}>
      {workSessions.length === 0 ? (
        <EmptyState
          icon={
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="20" x2="18" y2="10" />
              <line x1="12" y1="20" x2="12" y2="4" />
              <line x1="6" y1="20" x2="6" y2="14" />
            </svg>
          }
          message="No sessions yet — start a pomodoro to see stats here."
        />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-5">
            <Card value={today.length} label="Today" />
            <Card value={week.length} label="Week" />
            <Card value={workSessions.length} label="Total" />
          </div>

          <p className="text-xs text-center mb-5" style={{ color: 'var(--text-secondary)' }}>
            {totalMinutes} min of focus
          </p>

          <div className="mb-6">
            <h3 className="section-label">Last 7 days</h3>
            <div className="flex items-end justify-between gap-1.5 h-24">
              {weekDays.map((d) => (
                <div key={d.label} className="flex flex-col items-center gap-1.5 flex-1">
                  <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>{d.count}</span>
                  <div
                    className="w-full rounded-t-sm"
                    style={{
                      height: `${(d.count / maxCount) * 100}%`,
                      minHeight: d.count > 0 ? '4px' : '2px',
                      background: d.count > 0
                        ? 'color-mix(in srgb, var(--accent) 65%, transparent)'
                        : 'var(--border-subtle)',
                    }}
                  />
                  <span className="text-[9px]" style={{ color: 'var(--text-secondary)' }}>{d.label}</span>
                </div>
              ))}
            </div>
          </div>

          {topTasks.length > 0 && (
            <div className="mb-6">
              <h3 className="section-label">Top tasks</h3>
              <div className="space-y-2">
                {topTasks.map(([taskName, count]) => (
                  <div key={taskName} className="flex items-center gap-2">
                    <span className="text-xs flex-1 truncate" style={{ color: 'var(--text)' }}>{taskName}</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${(count / topTaskMax) * 100}%`,
                            background: 'var(--accent)',
                            opacity: 0.7,
                          }}
                        />
                      </div>
                      <span className="text-[10px] tabular-nums w-6 text-right" style={{ color: 'var(--text-secondary)' }}>{count}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {Object.keys(projects).length > 0 && (
            <div>
              <h3 className="section-label">Projects</h3>
              <div className="space-y-2">
                {Object.entries(projects)
                  .sort((a, b) => b[1] - a[1])
                  .map(([name, seconds]) => (
                    <div key={name} className="flex items-center justify-between">
                      <span className="text-xs truncate" style={{ color: 'var(--text)' }}>{name}</span>
                      <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-secondary)' }}>
                        {Math.round(seconds / 60)} min
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
    </DrawerPanel>
  )
}

function Card({ value, label }: { value: number; label: string }) {
  return (
    <div
      className="flex flex-col items-center gap-1 py-2.5 px-2 rounded-[var(--radius-sm)]"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
    >
      <span className="text-lg font-semibold tabular-nums" style={{ color: 'var(--text)' }}>{value}</span>
      <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{label}</span>
    </div>
  )
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-10 px-4 text-center">
      <span style={{ color: 'var(--text-secondary)' }}>{icon}</span>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{message}</p>
    </div>
  )
}
