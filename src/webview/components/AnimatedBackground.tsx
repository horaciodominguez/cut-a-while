import { useEffect, useRef } from 'react'

const WORK_GRADIENT = [
  { r: 15, g: 23, b: 42 },
  { r: 20, g: 30, b: 60 },
  { r: 10, g: 18, b: 35 },
]

const BREAK_GRADIENT = [
  { r: 30, g: 20, b: 15 },
  { r: 50, g: 25, b: 20 },
  { r: 35, g: 18, b: 10 },
]

type RGB = { r: number; g: number; b: number }

function lerp(a: RGB, b: RGB, t: number): RGB {
  return {
    r: Math.round(a.r + (b.r - a.r) * t),
    g: Math.round(a.g + (b.g - a.g) * t),
    b: Math.round(a.b + (b.b - a.b) * t),
  }
}

function rgbStr(c: RGB) { return `rgb(${c.r},${c.g},${c.b})` }

export function AnimatedBackground({ isBreak }: { isBreak: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const phaseRef = useRef(0)
  const currentRef = useRef(isBreak ? 1 : 0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = () => window.innerWidth
    const h = () => window.innerHeight

    const resize = () => {
      canvas.width = w()
      canvas.height = h()
    }
    resize()
    window.addEventListener('resize', resize)

    currentRef.current = isBreak ? 1 : 0
    const spots = Array.from({ length: 6 }, () => ({
      x: Math.random(),
      y: Math.random(),
      r: 0.3 + Math.random() * 0.4,
      dx: (Math.random() - 0.5) * 0.002,
      dy: (Math.random() - 0.5) * 0.002,
    }))

    function animate() {
      phaseRef.current += 0.003
      const slow = Math.sin(phaseRef.current) * 0.5 + 0.5

      ctx.fillStyle = 'transparent'
      ctx.clearRect(0, 0, w(), h())

      for (const s of spots) {
        s.x += s.dx
        s.y += s.dy
        if (s.x < -0.2) s.x = 1.2
        if (s.x > 1.2) s.x = -0.2
        if (s.y < -0.2) s.y = 1.2
        if (s.y > 1.2) s.y = -0.2

        const cx = s.x * w()
        const cy = s.y * h()
        const radius = s.r * Math.min(w(), h()) * 0.35

        const from = WORK_GRADIENT[s.idx % 3]
        const to = BREAK_GRADIENT[s.idx % 3]
        const color = lerp(from, to, currentRef.current)
        const a = 0.15 + slow * 0.12

        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius)
        grd.addColorStop(0, rgbStr(color).replace('rgb', 'rgba').replace(')', `,${a})`))
        grd.addColorStop(1, 'transparent')
        ctx.fillStyle = grd
        ctx.fillRect(0, 0, w(), h())
      }

      requestAnimationFrame(animate)
    }

    animate()
    return () => { window.removeEventListener('resize', resize) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    currentRef.current = isBreak ? 1 : 0
  }, [isBreak])

  return <canvas ref={canvasRef} className="fixed inset-0 -z-10" aria-hidden="true" />
}
