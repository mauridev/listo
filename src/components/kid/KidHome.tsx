'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import * as THREE from 'three'

type KidChild = {
  id: string
  name: string
  avatar_color: string
  reward_text: string | null
  familyId: string
  pin: string
}

type Task = {
  id: string
  title: string
  points: number
  completed_today: boolean
}

// ── Planet scene ───────────────────────────────────────────────────────────

function PlanetScene({ color }: { color: string }) {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = mountRef.current
    if (!el) return
    const W = el.clientWidth, H = el.clientHeight

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H)
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(50, W / H, 0.1, 500)
    camera.position.set(0, 0, 9)

    // Stars
    const starPositions = new Float32Array(3000 * 3)
    for (let i = 0; i < 3000 * 3; i++) starPositions[i] = (Math.random() - 0.5) * 300
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPositions, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, transparent: true, opacity: 0.75 })))

    // Planet
    const col = new THREE.Color(color)
    const planet = new THREE.Mesh(
      new THREE.SphereGeometry(2.4, 64, 64),
      new THREE.MeshPhongMaterial({ color: col, shininess: 55, specular: new THREE.Color(0x333333) })
    )
    scene.add(planet)

    // Atmosphere layers (glow)
    const glowColors = [
      { r: 2.58, opacity: 0.14 },
      { r: 2.76, opacity: 0.07 },
      { r: 3.0,  opacity: 0.03 },
    ]
    glowColors.forEach(({ r, opacity }) => {
      const mat = new THREE.MeshBasicMaterial({
        color: col,
        transparent: true,
        opacity,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(r, 32, 32), mat))
    })

    // Ring
    const ringGeo = new THREE.RingGeometry(3.1, 4.3, 128)
    const ringMat = new THREE.MeshBasicMaterial({
      color: col,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.13,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI / 2.6
    scene.add(ring)

    // Lights
    scene.add(new THREE.AmbientLight(0x111111))
    const sun = new THREE.DirectionalLight(0xffffff, 1.3)
    sun.position.set(6, 4, 5)
    scene.add(sun)
    // Subtle fill from opposite side
    const fill = new THREE.DirectionalLight(col, 0.18)
    fill.position.set(-4, -2, -3)
    scene.add(fill)

    // Planet tilt (like Earth)
    planet.rotation.z = 0.41

    let frameId: number
    let t = 0
    function animate() {
      frameId = requestAnimationFrame(animate)
      t += 0.004
      planet.rotation.y = t
      ring.rotation.z = t * 0.3
      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      const W2 = el.clientWidth, H2 = el.clientHeight
      camera.aspect = W2 / H2
      camera.updateProjectionMatrix()
      renderer.setSize(W2, H2)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', onResize)
      starGeo.dispose()
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [color])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}

// ── KidHome ────────────────────────────────────────────────────────────────

export function KidHome({ child, tasks }: { child: KidChild; tasks: Task[] }) {
  const router = useRouter()
  const allDone = tasks.length > 0 && tasks.every(t => t.completed_today)
  const completedCount = tasks.filter(t => t.completed_today).length

  function start() {
    sessionStorage.setItem('listo_child', JSON.stringify(child))
    router.push(`/c/${child.pin}/checkin`)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#050008', position: 'relative', overflow: 'hidden' }}>

      {/* Three.js planet fills the screen */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0 }}>
        <PlanetScene color={child.avatar_color} />
      </div>

      {/* Bottom gradient overlay */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%', zIndex: 1,
        background: 'linear-gradient(to top, #050008 55%, rgba(5,0,8,0.7) 80%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 2,
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: '0 1.5rem 2.5rem',
        maxWidth: 400, margin: '0 auto',
      }}>

        {/* Greeting */}
        <div className="mb-5">
          <p className="text-sm font-medium mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>
            {allDone ? '¡Todo cumplido hoy!' : 'Antes de tu tiempo libre'}
          </p>
          <h1 className="text-4xl font-bold tracking-tight">
            Hola, {child.name}
          </h1>
        </div>

        {/* Weekly reward */}
        {child.reward_text && (
          <div className="mb-4 px-4 py-3 rounded-2xl" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'rgba(167,139,250,0.7)' }}>Recompensa de esta semana</p>
            <p className="text-sm font-medium" style={{ color: 'var(--t1)' }}>{child.reward_text}</p>
          </div>
        )}

        {/* Tasks */}
        {tasks.length > 0 && (
          <div className="mb-5 rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="px-4 pt-3 pb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>Tareas de hoy</p>
              <p className="text-xs font-semibold" style={{ color: completedCount === tasks.length ? '#22c55e' : 'rgba(167,139,250,0.8)' }}>
                {completedCount}/{tasks.length}
              </p>
            </div>
            {/* Progress bar */}
            <div className="mx-4 mb-3 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${tasks.length ? (completedCount / tasks.length) * 100 : 0}%`, background: allDone ? '#22c55e' : '#7c3aed' }} />
            </div>
            <div className="pb-3">
              {tasks.map((t, i) => (
                <div key={t.id} className="flex items-center gap-3 px-4 py-2">
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                    background: t.completed_today ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)',
                    border: `1px solid ${t.completed_today ? '#22c55e' : 'rgba(255,255,255,0.15)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {t.completed_today && (
                      <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                        <polyline points="1.5 5 4 7.5 8.5 2.5" stroke="#22c55e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm flex-1" style={{ color: t.completed_today ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.85)', textDecoration: t.completed_today ? 'line-through' : 'none' }}>
                    {t.title}
                  </span>
                  <span className="text-xs font-medium" style={{ color: 'rgba(167,139,250,0.6)' }}>+{t.points}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        {tasks.length === 0 ? (
          <div className="text-center py-4" style={{ color: 'rgba(255,255,255,0.4)' }}>
            <p className="text-sm">No tenés tareas para hoy.</p>
          </div>
        ) : allDone ? (
          <button
            onClick={start}
            className="w-full py-4 rounded-2xl font-bold text-base"
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', boxShadow: '0 0 32px rgba(34,197,94,0.3)' }}
          >
            Ver mis puntos →
          </button>
        ) : (
          <button
            onClick={start}
            className="w-full py-4 rounded-2xl font-bold text-base"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#fff', boxShadow: '0 0 40px rgba(124,58,237,0.4)' }}
          >
            Empezar check-in →
          </button>
        )}
      </div>
    </div>
  )
}
