'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import * as THREE from 'three'

// ── Three.js hero scene ────────────────────────────────────────────────────

function HeroScene() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const W = el.clientWidth
    const H = el.clientHeight

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(W, H)
    renderer.setClearColor(0x000000, 0)
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 200)
    camera.position.set(0, 0, 28)

    const NODE_COUNT = 28
    const nodes: { mesh: THREE.Mesh; vel: THREE.Vector3 }[] = []
    const positions: THREE.Vector3[] = []

    const matBright = new THREE.MeshBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.9 })
    const matDim = new THREE.MeshBasicMaterial({ color: 0x4c1d95, transparent: true, opacity: 0.55 })

    for (let i = 0; i < NODE_COUNT; i++) {
      const r = i < 6 ? 0.18 : 0.09
      const geo = new THREE.SphereGeometry(r, 8, 8)
      const mesh = new THREE.Mesh(geo, i < 6 ? matBright : matDim)
      const pos = new THREE.Vector3(
        (Math.random() - 0.5) * 36,
        (Math.random() - 0.5) * 16,
        (Math.random() - 0.5) * 10,
      )
      mesh.position.copy(pos)
      scene.add(mesh)
      positions.push(pos.clone())
      nodes.push({
        mesh,
        vel: new THREE.Vector3(
          (Math.random() - 0.5) * 0.018,
          (Math.random() - 0.5) * 0.012,
          (Math.random() - 0.5) * 0.006,
        ),
      })
    }

    const lineMat = new THREE.LineBasicMaterial({ color: 0x7c3aed, transparent: true, opacity: 0.12 })
    const edgeLines: THREE.Line[] = []

    function rebuildEdges() {
      edgeLines.forEach(l => { scene.remove(l); l.geometry.dispose() })
      edgeLines.length = 0
      for (let i = 0; i < NODE_COUNT; i++) {
        for (let j = i + 1; j < NODE_COUNT; j++) {
          if (positions[i].distanceTo(positions[j]) < 10) {
            const geo = new THREE.BufferGeometry().setFromPoints([positions[i].clone(), positions[j].clone()])
            const line = new THREE.Line(geo, lineMat)
            scene.add(line)
            edgeLines.push(line)
          }
        }
      }
    }
    rebuildEdges()

    let frameId: number
    let t = 0
    let edgeTick = 0

    function animate() {
      frameId = requestAnimationFrame(animate)
      t += 0.008
      edgeTick++

      nodes.forEach((n, i) => {
        n.mesh.position.addScaledVector(n.vel, 1)
        positions[i].copy(n.mesh.position)
        if (Math.abs(n.mesh.position.x) > 18) n.vel.x *= -1
        if (Math.abs(n.mesh.position.y) > 8) n.vel.y *= -1
        if (Math.abs(n.mesh.position.z) > 5) n.vel.z *= -1
        const s = 1 + 0.08 * Math.sin(t + i)
        n.mesh.scale.setScalar(s)
      })

      if (edgeTick % 30 === 0) rebuildEdges()

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
      edgeLines.forEach(l => l.geometry.dispose())
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}

// ── Accordion ──────────────────────────────────────────────────────────────

function Accordion({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: 'var(--surf)', border: `1px solid ${open ? 'rgba(124,58,237,0.35)' : 'var(--bdr)'}`, transition: 'border-color 0.2s' }}
    >
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left"
        onClick={() => setOpen(o => !o)}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--t1)' }}>{title}</span>
        <svg
          width="16" height="16" viewBox="0 0 16 16" fill="none"
          style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
        >
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--t3)' }} />
        </svg>
      </button>
      {open && (
        <div className="px-5 pb-5 text-sm space-y-3 leading-relaxed" style={{ color: 'var(--t2)', borderTop: '1px solid var(--bdr)' }}>
          <div className="pt-4">{children}</div>
        </div>
      )}
    </div>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-3 rounded-xl text-xs leading-relaxed" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.18)', color: 'rgba(167,139,250,0.9)' }}>
      {children}
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-md mx-0.5" style={{ background: 'rgba(124,58,237,0.12)', color: 'var(--ac)' }}>
      {children}
    </span>
  )
}

function SectionDivider({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 pt-6 pb-1">
      <div className="h-px flex-1" style={{ background: 'var(--bdr)' }} />
      <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--t3)' }}>{children}</span>
      <div className="h-px flex-1" style={{ background: 'var(--bdr)' }} />
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function HelpPage() {
  return (
    <div className="max-w-lg mx-auto pb-16">

      <Link href="/dashboard" className="inline-block mb-6 text-sm transition-opacity hover:opacity-60" style={{ color: 'var(--t3)' }}>
        ← Volver
      </Link>

      {/* Hero with Three.js */}
      <div className="relative rounded-3xl overflow-hidden mb-8" style={{ height: 200, background: 'linear-gradient(135deg, #0d0118 0%, #1a0533 50%, #0d0118 100%)', border: '1px solid rgba(124,58,237,0.2)' }}>
        <div className="absolute inset-0">
          <HeroScene />
        </div>
        <div className="absolute inset-0 flex flex-col justify-end p-6" style={{ background: 'linear-gradient(to top, rgba(13,1,24,0.92) 0%, transparent 65%)' }}>
          <h1 className="text-2xl font-bold tracking-tight">Centro de ayuda</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--t2)' }}>Todo lo que necesitás saber para usar Listo.</p>
        </div>
      </div>

      {/* ── Para padres ── */}
      <SectionDivider>Para padres</SectionDivider>

      <div className="space-y-2 mt-3">
        <Accordion title="Cómo funciona Listo" defaultOpen>
          <p>Listo es una app familiar para que los chicos hagan un check-in con sus tareas del día antes de tener tiempo libre.</p>
          <ol className="mt-3 space-y-2 list-decimal list-inside">
            <li>El padre crea las tareas de cada hijo y define cuánto vale cada una en puntos.</li>
            <li>El hijo abre Listo desde su teléfono usando el código familiar.</li>
            <li>El avatar de IA le pregunta por cada tarea.</li>
            <li>Si completó todo, gana sus puntos y puede disfrutar su tiempo libre.</li>
          </ol>
        </Accordion>

        <Accordion title="Agregar hijos">
          <p>Desde el Dashboard, tocá <Label>+ Hijo</Label>. Elegí nombre y color de avatar. El hijo no necesita crear una cuenta.</p>
          <p className="mt-2">Tu hijo accede con el <strong style={{ color: 'var(--t1)' }}>código familiar</strong> de 6 letras que aparece en la parte superior del dashboard.</p>
        </Accordion>

        <Accordion title="Crear y configurar tareas">
          <p>Entrá al perfil del hijo y tocá <Label>+ Agregar tarea</Label>. Cada tarea tiene tres parámetros:</p>
          <div className="mt-3 space-y-2">
            <div className="rounded-xl p-3" style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--t1)' }}>Nombre</p>
              <p className="text-xs" style={{ color: 'var(--t3)' }}>Lo que el hijo tiene que hacer. Ej: "Hacer los deberes", "Bañarse".</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: 'var(--t1)' }}>Puntos al completar</p>
              <p className="text-xs" style={{ color: 'var(--t3)' }}>Cuántos puntos gana el hijo (default: 10). Asigná más puntos a las tareas más difíciles.</p>
            </div>
            <div className="rounded-xl p-3" style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)' }}>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--t1)' }}>Frecuencia</p>
              <div className="space-y-1.5 text-xs" style={{ color: 'var(--t3)' }}>
                <p><Label>Todos los días</Label> aparece siempre.</p>
                <p><Label>Lun–Vie</Label> solo días de semana.</p>
                <p><Label>Fin de semana</Label> sábado y domingo.</p>
                <p><Label>Días específicos</Label> elegís exactamente qué días.</p>
              </div>
            </div>
          </div>
          <Tip>El hijo solo ve las tareas que aplican al día de hoy según la frecuencia.</Tip>
        </Accordion>

        <Accordion title="Sistema de puntos">
          <p>Cada tarea vale una cantidad de puntos. Al completar una tarea en el check-in, esos puntos se suman al balance del hijo automáticamente.</p>
          <ul className="mt-3 space-y-1.5 text-xs" style={{ color: 'var(--t3)' }}>
            <li>— Los puntos se acumulan y no se reinician solos.</li>
            <li>— Si el hijo dice que no hizo la tarea, no gana puntos.</li>
            <li>— El balance se ve en el perfil del hijo.</li>
            <li>— Los puntos se usan para canjear recompensas en la tienda.</li>
          </ul>
          <Tip>Definí los puntos según la dificultad: simple = 10 pts, difícil = 30-50 pts.</Tip>
        </Accordion>

        <Accordion title="Tienda de recompensas">
          <p>Catálogo de premios que el padre crea. El hijo acumula puntos y los canjea por lo que quiere.</p>
          <div className="mt-3 space-y-4">
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--t1)' }}>Configurar la tienda</p>
              <ol className="space-y-1.5 list-decimal list-inside text-xs" style={{ color: 'var(--t3)' }}>
                <li>Entrá al perfil del hijo.</li>
                <li>Bajá hasta Tienda de recompensas.</li>
                <li>Tocá <Label>+ Agregar recompensa</Label> con nombre y costo en puntos.</li>
              </ol>
            </div>
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--t1)' }}>Flujo de canje</p>
              <ol className="space-y-1.5 list-decimal list-inside text-xs" style={{ color: 'var(--t3)' }}>
                <li>El hijo va a la tienda desde el check-in.</li>
                <li>Toca <Label>Pedir</Label> en el premio que quiere.</li>
                <li>Aparece en Canjes pendientes en el perfil del hijo.</li>
                <li>Vos aprobás o rechazás con un toque.</li>
              </ol>
            </div>
          </div>
          <Tip>Ejemplos: "1 hora extra de pantalla · 30 pts", "Elegís la cena · 20 pts".</Tip>
        </Accordion>

        <Accordion title="Recompensa de la semana">
          <p>Un texto libre que el padre escribe cada semana. Aparece en la pantalla de bienvenida del hijo como motivación antes del check-in. No tiene lógica automática — vos decidís cuándo dárselo en la vida real.</p>
          <Tip>Diferente a la tienda: aquí no hay puntos, es una motivación extra puntual. Cambiala cada semana.</Tip>
        </Accordion>
      </div>

      {/* ── Para hijos ── */}
      <SectionDivider>Para hijos</SectionDivider>

      <div className="space-y-2 mt-3">
        <Accordion title="Cómo entrar a Listo">
          <p>Tu papá o mamá tiene un código familiar de 6 letras. Abrí el navegador, entrá a la dirección que te dieron, poné el código y elegís tu nombre. Sin cuenta, sin contraseña.</p>
        </Accordion>

        <Accordion title="Cómo funciona el check-in">
          <p>Una charla corta con el avatar de IA que te pregunta por cada tarea del día.</p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.18)' }}>
              <span className="text-xs font-semibold w-28 flex-shrink-0" style={{ color: '#22c55e' }}>Sí, la hice</span>
              <p className="text-xs" style={{ color: 'var(--t3)' }}>Ganás los puntos de esa tarea.</p>
            </div>
            <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(234,179,8,0.07)', border: '1px solid rgba(234,179,8,0.18)' }}>
              <span className="text-xs font-semibold w-28 flex-shrink-0" style={{ color: '#eab308' }}>Me falta un poco</span>
              <p className="text-xs" style={{ color: 'var(--t3)' }}>La tarea queda pendiente.</p>
            </div>
            <div className="flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)' }}>
              <span className="text-xs font-semibold w-28 flex-shrink-0" style={{ color: '#ef4444' }}>No la hice</span>
              <p className="text-xs" style={{ color: 'var(--t3)' }}>Sin puntos. Podés volver cuando termines.</p>
            </div>
          </div>
          <Tip>Solo aparecen las tareas del día de hoy.</Tip>
        </Accordion>

        <Accordion title="Cómo usar mis puntos">
          <p>Cada tarea completada te da puntos. Los puntos se acumulan y los podés usar en la tienda.</p>
          <ol className="mt-3 space-y-1.5 list-decimal list-inside text-xs" style={{ color: 'var(--t3)' }}>
            <li>Desde la bienvenida o al terminar el check-in, tocá <Label>Ver tienda</Label>.</li>
            <li>Ves los premios y cuánto cuestan.</li>
            <li>Si tenés suficientes puntos, tocá <Label>Pedir</Label>.</li>
            <li>Tu papá o mamá recibe la solicitud y la aprueba.</li>
          </ol>
        </Accordion>
      </div>

      {/* ── FAQ ── */}
      <SectionDivider>Preguntas frecuentes</SectionDivider>

      <div className="space-y-2 mt-3">
        <Accordion title="¿Los puntos se borran?">
          <p>No. Los puntos se acumulan con el tiempo y no hay reset automático.</p>
        </Accordion>

        <Accordion title="¿Qué pasa si el hijo miente sobre una tarea?">
          <p>Listo confía en la honestidad del hijo. La app no verifica si la tarea fue hecha en la vida real — eso queda en vos. Podés pausar o eliminar tareas si algo no funciona.</p>
        </Accordion>

        <Accordion title="¿Puedo tener más de un hijo?">
          <p>Sí. Cada hijo tiene su propio perfil, tareas, balance y tienda.</p>
        </Accordion>

        <Accordion title="¿El hijo necesita una cuenta?">
          <p>No. Los hijos entran solo con el código familiar. Sin cuentas, sin contraseñas, sin datos personales guardados.</p>
        </Accordion>
      </div>
    </div>
  )
}
