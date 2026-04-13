import { useEffect, useRef } from 'react'

export default function Starfield() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animFrame

    const stars = []
    const STAR_COUNT = 180

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const init = () => {
      resize()
      stars.length = 0
      for (let i = 0; i < STAR_COUNT; i++) {
        stars.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          r: Math.random() * 1.2 + 0.2,
          alpha: Math.random() * 0.7 + 0.1,
          speed: Math.random() * 0.003 + 0.001,
          phase: Math.random() * Math.PI * 2,
          color: Math.random() > 0.8 ? '#c8d0f8' : Math.random() > 0.5 ? '#ffffff' : '#b8a8ff',
        })
      }
    }

    let t = 0
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      t += 0.016

      for (const s of stars) {
        const flicker = Math.sin(t * s.speed * 200 + s.phase) * 0.3 + 0.7
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = s.color
        ctx.globalAlpha = s.alpha * flicker
        ctx.fill()
      }

      ctx.globalAlpha = 1
      animFrame = requestAnimationFrame(draw)
    }

    init()
    draw()
    window.addEventListener('resize', init)

    return () => {
      cancelAnimationFrame(animFrame)
      window.removeEventListener('resize', init)
    }
  }, [])

  return <canvas ref={canvasRef} className="starfield" />
}
