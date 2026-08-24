import { useCallback, useEffect, useRef, useState } from 'react'
import { postMessage } from '../vscodeApi.ts'
import { DrawerPanel } from './DrawerPanel.tsx'

interface TodoItem {
  id: string
  text: string
  done: boolean
  createdAt: number
  completedAt?: number
}

interface TodoPanelProps {
  open: boolean
  onClose: () => void
}

export function TodoPanel({ open, onClose }: TodoPanelProps) {
  const [todos, setTodos] = useState<TodoItem[]>([])
  const [newText, setNewText] = useState('')
  const [showCompleted, setShowCompleted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (event: MessageEvent) => {
      const msg = event.data
      if (msg.command === 'todosUpdate') setTodos(msg.todos)
    }
    window.addEventListener('message', handler)
    postMessage({ command: 'getTodos' })
    return () => window.removeEventListener('message', handler)
  }, [open])

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
    todos.filter((t) => t.done).forEach((t) => postMessage({ command: 'deleteTodo', id: t.id }))
  }, [todos])

  const pending = todos.filter((t) => !t.done)
  const completed = todos.filter((t) => t.done)

  return (
    <DrawerPanel title="Tasks" open={open} onClose={onClose}>
      <div className="flex items-center gap-2 mb-5">
        <input
          ref={inputRef}
          type="text"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTodo()}
          placeholder="Add a task..."
          className="flex-1 px-3 py-2 rounded text-xs focus:outline-none"
          style={{
            background: 'var(--input-bg)',
            border: '1px solid var(--input-border)',
            color: 'var(--input-fg)',
          }}
        />
        <button
          onClick={addTodo}
          className="px-3 py-2 text-xs font-medium rounded cursor-pointer whitespace-nowrap"
          style={{ background: 'var(--btn-bg)', color: 'var(--btn-fg)' }}
        >
          Add
        </button>
      </div>

      <div className="space-y-1">
        {pending.length === 0 && (
          <EmptyState
            icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 11 12 14 22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
            }
            message="No pending tasks — add one or start a session with a focus goal."
          />
        )}
        {pending.map((todo) => (
          <TodoRow
            key={todo.id}
            todo={todo}
            onToggle={() => toggleTodo(todo.id)}
            onDelete={() => deleteTodo(todo.id)}
          />
        ))}
      </div>

      {completed.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-2 text-[11px] font-medium w-full text-left cursor-pointer"
            style={{ color: 'var(--text-muted)' }}
          >
            <span className={`transition-transform duration-150 ${showCompleted ? 'rotate-90' : ''}`}>▸</span>
            Completed ({completed.length})
          </button>
          {showCompleted && (
            <div className="space-y-1 mt-2">
              {completed.map((todo) => (
                <TodoRow
                  key={todo.id}
                  todo={todo}
                  onToggle={() => toggleTodo(todo.id)}
                  onDelete={() => deleteTodo(todo.id)}
                />
              ))}
              <button
                onClick={clearCompleted}
                className="mt-3 text-[10px] cursor-pointer"
                style={{ color: 'var(--text-muted)' }}
              >
                Clear completed
              </button>
            </div>
          )}
        </div>
      )}
    </DrawerPanel>
  )
}

function TodoRow({
  todo,
  onToggle,
  onDelete,
}: {
  todo: TodoItem
  onToggle: () => void
  onDelete: () => void
}) {
  return (
    <div className="flex items-center gap-2 group">
      <button
        onClick={onToggle}
        className="w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 cursor-pointer"
        style={{
          borderColor: todo.done ? 'var(--accent)' : 'var(--surface-border)',
          background: todo.done ? 'var(--accent)' : 'transparent',
        }}
        aria-label={todo.done ? 'Mark as pending' : 'Mark as done'}
      >
        {todo.done && (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </button>
      <span
        className={`flex-1 text-xs truncate ${todo.done ? 'line-through' : ''}`}
        style={{ color: todo.done ? 'var(--text-muted)' : 'var(--text)', opacity: todo.done ? 0.7 : 1 }}
      >
        {todo.text}
      </span>
      <button
        onClick={onDelete}
        className="p-0.5 rounded opacity-0 group-hover:opacity-100 cursor-pointer"
        style={{ color: 'var(--text-muted)' }}
        aria-label="Delete task"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  )
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 px-2 text-center">
      <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>{message}</p>
    </div>
  )
}
