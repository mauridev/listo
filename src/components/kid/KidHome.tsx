'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as THREE from 'three'
import { startKidSession } from '@/app/c/actions'
import { localDateStr } from '@/lib/recurrence'

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
  completion_dates?: string[]
  completed_today: boolean
}

// ── Shared noise GLSL ──────────────────────────────────────────────────────

const NOISE_GLSL = `
  float _h(vec3 p){p=fract(p*vec3(127.1,311.7,74.7));p+=dot(p,p.yzx+19.19);return fract((p.x+p.y)*p.z);}
  float _n(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(_h(i),_h(i+vec3(1,0,0)),f.x),mix(_h(i+vec3(0,1,0)),_h(i+vec3(1,1,0)),f.x),f.y),mix(mix(_h(i+vec3(0,0,1)),_h(i+vec3(1,0,1)),f.x),mix(_h(i+vec3(0,1,1)),_h(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float fbm(vec3 p){float v=0.;float a=0.5;for(int i=0;i<5;i++){v+=a*_n(p);p=p*2.1+vec3(1.7,9.2,3.4);a*=0.5;}return v;}
`

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

    // ── Stars ──────────────────────────────────────────────────────────────
    const starPos = new Float32Array(3000 * 3)
    for (let i = 0; i < starPos.length; i++) starPos[i] = (Math.random() - 0.5) * 300
    const starGeo = new THREE.BufferGeometry()
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, transparent: true, opacity: 0.75 })))

    // ── Planet with shader surface ─────────────────────────────────────────
    const col = new THREE.Color(color)

    const planetMat = new THREE.ShaderMaterial({
      uniforms: {
        uCol: { value: col.clone() },
        uT:   { value: 0 },
      },
      vertexShader: `
        varying vec3 vN;
        varying vec3 vP;
        void main() {
          vN = normalize(normalMatrix * normal);
          vP = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        precision highp float;
        uniform vec3  uCol;
        uniform float uT;
        varying vec3  vN;
        varying vec3  vP;
        ${NOISE_GLSL}
        void main() {
          float n1 = fbm(vP * 1.7);
          float n2 = fbm(vP * 3.4 + vec3(4.1, 2.3, 1.7));
          float continent = smoothstep(0.43, 0.57, n1 + n2 * 0.25);

          vec3 oceanCol = uCol * 0.30;
          vec3 landCol  = mix(uCol, vec3(0.96, 0.90, 1.0), 0.24);

          float polar = pow(abs(vP.y), 2.6);
          float snow  = smoothstep(0.55, 0.88, polar);

          vec3 col = mix(oceanCol, landCol, continent);
          col = mix(col, vec3(0.88, 0.92, 1.0), snow);

          vec3 sun  = normalize(vec3(0.60, 0.35, 0.50));
          float diff = max(dot(vN, sun), 0.0);
          col = col * (0.10 + 0.90 * diff);

          // ojo: 'half' es palabra reservada en GLSL — usar ese nombre hacía que
          // el fragment shader no compilara y el planeta se viera como un blob
          // liso, sin continentes ni especular (bug desde ce526ad)
          vec3  halfVec = normalize(sun + vec3(0.0, 0.0, 1.0));
          float spec = pow(max(dot(vN, halfVec), 0.0), 28.0);
          col += vec3(0.35) * spec * (1.0 - continent) * 0.65;

          float rim = pow(1.0 - clamp(dot(vN, vec3(0.0, 0.0, 1.0)), 0.0, 1.0), 2.4);
          col = mix(col, mix(uCol, vec3(0.5, 0.75, 1.0), 0.55), rim * 0.55);

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })

    const planet = new THREE.Mesh(new THREE.SphereGeometry(2.4, 96, 96), planetMat)
    planet.rotation.z = 0.41
    scene.add(planet)

    // ── Atmosphere glow layers ─────────────────────────────────────────────
    const glowData = [
      { r: 2.58, op: 0.18 }, { r: 2.82, op: 0.09 },
      { r: 3.14, op: 0.042 }, { r: 3.65, op: 0.018 },
    ]
    glowData.forEach(({ r, op }) => {
      scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(r, 32, 32),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
      ))
    })

    // ── Ring ───────────────────────────────────────────────────────────────
    const ringGeo = new THREE.RingGeometry(3.1, 4.3, 128)
    const ringMat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, depthWrite: false })
    const ring = new THREE.Mesh(ringGeo, ringMat)
    ring.rotation.x = Math.PI / 2.6
    scene.add(ring)

    // ── Shooting stars ─────────────────────────────────────────────────────
    type Shooter = {
      line: THREE.Line; mat: THREE.LineBasicMaterial; geo: THREE.BufferGeometry
      state: 'wait' | 'go'; delay: number; x: number; y: number; vx: number; vy: number
    }
    const NSHOOT = 5
    const shooters: Shooter[] = []

    for (let i = 0; i < NSHOOT; i++) {
      const sGeo = new THREE.BufferGeometry()
      sGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3))
      const sMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0 })
      const line = new THREE.Line(sGeo, sMat)
      scene.add(line)
      shooters.push({ line, mat: sMat, geo: sGeo, state: 'wait', delay: 50 + i * 90 + Math.floor(Math.random() * 80), x: 0, y: 0, vx: 0, vy: 0 })
    }

    function spawnShooter(s: Shooter) {
      s.x = 6 + Math.random() * 8
      s.y = 2 + Math.random() * 5
      s.vx = -(0.13 + Math.random() * 0.22)
      s.vy = -(0.03 + Math.random() * 0.055)
      s.mat.opacity = 0.8 + Math.random() * 0.2
      s.state = 'go'
    }

    let frameId: number
    let t = 0

    function animate() {
      frameId = requestAnimationFrame(animate)
      t += 0.004
      planet.rotation.y = t
      ring.rotation.z = t * 0.3
      planetMat.uniforms.uT.value = t

      shooters.forEach(s => {
        if (s.state === 'wait') {
          if (--s.delay <= 0) spawnShooter(s)
          return
        }
        s.x += s.vx; s.y += s.vy
        const arr = s.geo.attributes.position.array as Float32Array
        const tail = 5.5
        arr[0] = s.x;             arr[1] = s.y;             arr[2] = 0
        arr[3] = s.x - s.vx*tail; arr[4] = s.y - s.vy*tail; arr[5] = 0
        s.geo.attributes.position.needsUpdate = true
        s.mat.opacity *= 0.975
        if (s.x < -12 || s.mat.opacity < 0.04) {
          s.state = 'wait'; s.delay = 160 + Math.floor(Math.random() * 240); s.mat.opacity = 0
          const a2 = s.geo.attributes.position.array as Float32Array; a2.fill(0)
          s.geo.attributes.position.needsUpdate = true
        }
      })

      renderer.render(scene, camera)
    }
    animate()

    const onResize = () => {
      const W2 = el.clientWidth, H2 = el.clientHeight
      camera.aspect = W2 / H2; camera.updateProjectionMatrix(); renderer.setSize(W2, H2)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', onResize)
      starGeo.dispose(); planetMat.dispose(); ringGeo.dispose()
      shooters.forEach(s => { s.geo.dispose(); s.mat.dispose() })
      renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [color])

  return <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
}

// ── KidHome ────────────────────────────────────────────────────────────────

export function KidHome({
  child,
  tasks: rawTasks,
  balance,
  hasStore,
}: {
  child: KidChild
  tasks: Task[]
  balance: number
  hasStore: boolean
}) {
  const router = useRouter()
  // Recompute completed_today with local browser date (fixes UTC vs local timezone bug)
  const today = localDateStr()
  const tasks = rawTasks.map(t => ({
    ...t,
    completed_today: t.completion_dates ? t.completion_dates.includes(today) : t.completed_today,
  }))
  const allDone = tasks.length > 0 && tasks.every(t => t.completed_today)
  const completedCount = tasks.filter(t => t.completed_today).length

  const [opening, setOpening] = useState<'checkin' | 'tienda' | null>(null)
  const [startError, setStartError] = useState('')

  const storeLabel = hasStore ? 'Ver mis puntos y premios' : 'Ver mis puntos'

  // Spec 0008 (H1): la sesión del hijo la abre el servidor en una cookie
  // firmada. Antes se guardaba el child_id en sessionStorage, donde cualquiera
  // lo podía editar para operar sobre otro chico.
  //
  // Spec 0011: la misma sesión sirve para entrar directo a la tienda, sin
  // pasar por el check-in.
  async function enter(target: 'checkin' | 'tienda') {
    if (opening) return
    setOpening(target)
    setStartError('')

    const result = await startKidSession(child.pin)

    if (result.status === 'ok') {
      router.push(`/c/${child.pin}/${target}`)
      return
    }

    setOpening(null)
    setStartError(
      result.status === 'rate_limited'
        ? 'Demasiados intentos. Esperá unos minutos.'
        : target === 'tienda'
          ? 'No pudimos abrir tu tienda. Probá de nuevo.'
          : 'No pudimos abrir tu check-in. Probá de nuevo.'
    )
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

      {/* Content — always white text: planet scene is always dark regardless of theme */}
      <div style={{
        position: 'relative', zIndex: 2, minHeight: '100vh',
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
        padding: '0 1.5rem 2.5rem', maxWidth: 400, margin: '0 auto',
        color: '#fff',
      }}>

        <div className="mb-5">
          <p className="text-sm font-medium mb-1" style={{ color: 'rgba(167,139,250,0.8)' }}>
            {tasks.length === 0 ? '¡Hoy es todo tuyo!' : allDone ? '¡Todo cumplido hoy!' : 'Antes de tu tiempo libre'}
          </p>
          <div className="flex items-end gap-3">
            <h1 className="text-4xl font-bold tracking-tight flex-1">
              Hola, {child.name}
            </h1>
            {/* Spec 0011 (R4): el día sin tareas esto es lo único que tiene para
                mirar. No lo escondemos detrás de un tap. */}
            <span
              className="text-sm font-semibold px-3 py-1 rounded-full whitespace-nowrap mb-1"
              style={{ background: 'rgba(124,58,237,0.18)', border: '1px solid rgba(124,58,237,0.35)', color: 'rgba(216,180,254,0.95)' }}
            >
              ⭐ {balance}
            </span>
          </div>
        </div>

        {child.reward_text && (
          <div className="mb-4 px-4 py-3 rounded-2xl" style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)' }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'rgba(167,139,250,0.7)' }}>Recompensa de esta semana</p>
            <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.92)' }}>{child.reward_text}</p>
          </div>
        )}

        {tasks.length > 0 && (
          <div className="mb-5 rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
            <div className="px-4 pt-3 pb-2 flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>Tareas de hoy</p>
              <p className="text-xs font-semibold" style={{ color: completedCount === tasks.length ? '#22c55e' : 'rgba(167,139,250,0.8)' }}>
                {completedCount}/{tasks.length}
              </p>
            </div>
            <div className="mx-4 mb-3 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${tasks.length ? (completedCount / tasks.length) * 100 : 0}%`, background: allDone ? '#22c55e' : '#7c3aed' }} />
            </div>
            <div className="pb-3">
              {tasks.map(t => (
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

        {/* Spec 0011 (R1): sin tareas, esta pantalla mostraba una frase gris y
            ningún botón. Un chico de 6 a 14 años quedaba en un callejón justo
            el día libre, que es cuando más ganas tiene de gastar lo que juntó. */}
        {tasks.length === 0 ? (
          <>
            <div className="mb-5 px-4 py-5 rounded-2xl text-center" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <p className="text-3xl mb-2">🛸</p>
              <p className="text-sm font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>
                Hoy no tenés tareas. ¡Disfrutá!
              </p>
              <p className="text-xs mt-1" style={{ color: 'rgba(255,255,255,0.45)' }}>
                Tus puntos te esperan cuando quieras.
              </p>
            </div>
            <button
              onClick={() => enter('tienda')}
              disabled={opening !== null}
              className="w-full py-4 rounded-2xl font-bold text-base disabled:opacity-60"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#fff', boxShadow: '0 0 40px rgba(124,58,237,0.4)' }}
            >
              {opening === 'tienda' ? 'Abriendo…' : `${storeLabel} →`}
            </button>
          </>
        ) : (
          <>
            {allDone ? (
              <button
                onClick={() => enter('checkin')}
                disabled={opening !== null}
                className="w-full py-4 rounded-2xl font-bold text-base disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)', color: '#fff', boxShadow: '0 0 32px rgba(34,197,94,0.3)' }}
              >
                {opening === 'checkin' ? 'Abriendo…' : 'Ver mis puntos →'}
              </button>
            ) : (
              <button
                onClick={() => enter('checkin')}
                disabled={opening !== null}
                className="w-full py-4 rounded-2xl font-bold text-base disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', color: '#fff', boxShadow: '0 0 40px rgba(124,58,237,0.4)' }}
              >
                {opening === 'checkin' ? 'Abriendo…' : 'Empezar check-in →'}
              </button>
            )}
            {/* Spec 0011 (R6): la tienda también se alcanza en días con tareas,
                pero el check-in sigue siendo la acción protagonista. */}
            <button
              onClick={() => enter('tienda')}
              disabled={opening !== null}
              className="w-full mt-3 py-2 text-sm font-medium disabled:opacity-60"
              style={{ background: 'transparent', color: 'rgba(255,255,255,0.5)' }}
            >
              {opening === 'tienda' ? 'Abriendo…' : storeLabel}
            </button>
          </>
        )}

        {startError && (
          <p className="text-sm text-center mt-3" style={{ color: '#fca5a5' }}>
            {startError}
          </p>
        )}
      </div>
    </div>
  )
}
