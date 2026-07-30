import { useCallback, useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { postMessage } from '../vscodeApi.ts'

interface TodoItem {
  id: string
  text: string
  done: boolean
  createdAt: number
  completedAt?: number
}

interface TodoPanelProps {
  onClose: () => void
}

export function TodoPanel({ onClose }: TodoPanelProps) {
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [newText, setNewText] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const msg = event.data
      if (msg.command === 'todosUpdate') { setTodos(msg.todos) }
    }
    window.addEventListener('message', handler)
    postMessage({ command: 'getTodos' })
    return () => window.removeEventListener('message', handler)
  }, [])

  const addTodo = useCallback(() => {
    const text = newText.trim()
    if (!text) return
    postMessage({ command: 'addTodo', text })
    setNewText('')
    inputRef.current?.focus()
  }, [newText])

  const toggleTodo = useCallback((id: string) => {
    postMessage({ command: 'toggleTodo', id })
  }, [])

  const deleteTodo = useCallback((id: string) => {
    postMessage({ command: 'deleteTodo', id })
  }, [])

  const clearCompleted = useCallback(() => {
    const completed = todos.filter((t) => t.done)
    completed.forEach((t) => postMessage({ command: 'deleteTodo', id: t.id }))
  }, [todos])

  const pending = todos.filter((t) => !t.done)
  const completed = todos.filter((t) => t.done)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={onClose}
      />
      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="fixed top-0 right-0 z-50 h-full w-72 max-w-[85vw] bg-[#1a1a2e]/95 backdrop-blur-2xl border-l border-white/10 shadow-2xl overflow-y-auto"
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-sm font-semibold text-white/80 uppercase tracking-widest">Todo List</h2>
            <button onClick={onClose} className="p-1 rounded-md text-white/30 hover:text-white/70 hover:bg-white/10 transition-all cursor-pointer" aria-label="Close todo list">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <div className="flex items-center gap-2 mb-5">
            <input
              ref={inputRef}
              type="text"
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addTodo()}
              placeholder="Add a task..."
              className="flex-1 px-3 py-2 bg-white/8 border border-white/10 rounded-lg text-white placeholder-white/35 text-xs focus:outline-none focus:border-blue-400/50 focus:bg-white/10 transition-all duration-200"
            />
            <button
              onClick={addTodo}
              className="px-3 py-2 bg-blue-500/80 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-all duration-200 cursor-pointer whitespace-nowrap"
            >
              +Add
            </button>
          </div>

          <div className="space-y-1">
            {pending.length === 0 && (
              <p className="text-xs text-white/30 text-center py-8">No pending tasks</p>
            )}
            {pending.map((todo) => (
              <div key={todo.id} className="flex items-center gap-2 group">
                <button
                  onClick={() => toggleTodo(todo.id)}
                  className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-all duration-200 cursor-pointer ${
                    todo.done ? 'bg-blue-500 border-blue-500' : 'border-white/25 hover:border-white/50'
                  }`}
                  aria-label={todo.done ? 'Mark as pending' : 'Mark as done'}
                >
                  {todo.done && (
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </button>
                <span className="flex-1 text-xs text-white/70 truncate">{todo.text}</span>
                <button
                  onClick={() => deleteTodo(todo.id)}
                  className="p-0.5 rounded text-white/20 hover:text-white/60 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
                  aria-label="Delete task"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            ))}
          </div>

          {completed.length > 0 && (
            <div className="mt-6">
              <button
                onClick={() => setShowCompleted(!showCompleted)}
                className="flex items-center gap-2 text-[10px] uppercase tracking-[0.15em] text-white/30 font-semibold w-full text-left cursor-pointer hover:text-white/50 transition-colors"
              >
                <span className={`transition-transform duration-200 ${showCompleted ? 'rotate-90' : ''}`}>▸</span>
                Completed ({completed.length})
              </button>
              {showCompleted && (
                <div className="space-y-1 mt-2">
                  {completed.map((todo) => (
                    <div key={todo.id} className="flex items-center gap-2 group">
                      <button
                        onClick={() => toggleTodo(todo.id)}
                        className="w-4 h-4 rounded border border-blue-500/50 bg-blue-500/20 flex items-center justify-center flex-shrink-0 cursor-pointer"
                        aria-label="Mark as pending"
                      >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </button>
                      <span className="flex-1 text-xs text-white/40 line-through truncate">{todo.text}</span>
                      <button
                        onClick={() => deleteTodo(todo.id)}
                        className="p-0.5 rounded text-white/20 hover:text-white/60 hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all duration-200 cursor-pointer"
                        aria-label="Delete task"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={clearCompleted}
                    className="mt-3 text-[10px] text-white/30 hover:text-white/60 transition-colors cursor-pointer"
                  >
                    Clear completed
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
