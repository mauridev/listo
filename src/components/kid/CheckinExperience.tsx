'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as THREE from 'three'
import { completeTask, requestRedemption } from '@/app/c/actions'
import { localDateStr } from '@/lib/recurrence'

// ── Types ──────────────────────────────────────────────────────────────────

type KidChild = { id: string; name: string; avatar_color: string; pin: string; reward_text: string | null }
type Task = { id: string; title: string; recurrence: string; days: number[] | null; points: number; completed_today: boolean }
type CatalogItem = { id: string; title: string; cost_points: number }
type Redemption = { id: string; status: 'pending' | 'approved' | 'rejected'; rewards_catalog?: { title: string; cost_points: number } | null }
type Screen = 'checkin' | 'done' | 'pending' | 'store'

// ── Shared noise GLSL ──────────────────────────────────────────────────────

const NOISE_GLSL = `
  float _h(vec3 p){p=fract(p*vec3(127.1,311.7,74.7));p+=dot(p,p.yzx+19.19);return fract((p.x+p.y)*p.z);}
  float _n(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(mix(_h(i),_h(i+vec3(1,0,0)),f.x),mix(_h(i+vec3(0,1,0)),_h(i+vec3(1,1,0)),f.x),f.y),mix(mix(_h(i+vec3(0,0,1)),_h(i+vec3(1,0,1)),f.x),mix(_h(i+vec3(0,1,1)),_h(i+vec3(1,1,1)),f.x),f.y),f.z);}
  float fbm(vec3 p){float v=0.;float a=0.5;for(int i=0;i<5;i++){v+=a*_n(p);p=p*2.1+vec3(1.7,9.2,3.4);a*=0.5;}return v;}
`

// ── Three.js Plasma Orb ────────────────────────────────────────────────────

function OrbThree({ size, speaking, color }: { size: number; speaking: boolean; color: string }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const spkRef = useRef(speaking)
  useEffect(() => { spkRef.current = speaking }, [speaking])

  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(size, size)
    renderer.setClearColor(0, 0)
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera(42, 1, 0.1, 50)
    cam.position.z = 5.0

    const col = new THREE.Color(color)

    // ── Plasma sphere ───────────────────────────────────────────────────────
    const orbMat = new THREE.ShaderMaterial({
      uniforms: {
        uT:   { value: 0 },
        uCol: { value: col.clone() },
        uSpk: { value: 0 },
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
        uniform float uT;
        uniform vec3  uCol;
        uniform float uSpk;
        varying vec3  vN;
        varying vec3  vP;
        ${NOISE_GLSL}
        void main() {
          vec3 p  = vP * 2.4;
          float n1 = fbm(p + vec3(uT*.12, uT*.08, uT*.10));
          float n2 = fbm(p * 1.3 - vec3(uT*.09, -uT*.11, uT*.07));
          float plasma = pow(sin((n1 - n2) * 8.0 + uT * 1.2) * .5 + .5, 1.5);

          float rim = pow(1.0 - clamp(dot(vN, vec3(0,0,1)), 0., 1.), 1.8);
          float lit = pow(clamp(dot(vN, normalize(vec3(-.5,.7,.6))), 0., 1.), 4.0);

          vec3 dark   = uCol * 0.28;
          vec3 bright = mix(uCol, vec3(0.88, 0.72, 1.0), 0.45);
          vec3 col    = mix(dark, bright, plasma);
          col = mix(col, uCol * 1.7, rim * (.55 + uSpk * .55));
          col += lit * 0.28;
          col += uCol * uSpk * (sin(uT * 4.0) * .5 + .5) * .15;

          gl_FragColor = vec4(col, 1.0);
        }
      `,
    })
    scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.2, 96, 96), orbMat))

    // ── Glow layers ─────────────────────────────────────────────────────────
    const glows = [
      { r: 1.38, op: 0.22 }, { r: 1.64, op: 0.11 },
      { r: 1.98, op: 0.055 }, { r: 2.45, op: 0.025 },
    ]
    glows.forEach(({ r, op }) => {
      scene.add(new THREE.Mesh(
        new THREE.SphereGeometry(r, 32, 32),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: op, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })
      ))
    })

    // ── Speaking particles (energy motes rising from the orb) ───────────────
    const NP = 64
    const pArr = new Float32Array(NP * 3)
    const pLife = Array.from({ length: NP }, () => Math.random())
    const pVel = Array.from({ length: NP }, () => ({
      x: (Math.random() - 0.5) * 0.015,
      y: 0.009 + Math.random() * 0.019,
      z: (Math.random() - 0.5) * 0.009,
    }))
    for (let i = 0; i < NP; i++) {
      const th = Math.acos(2 * Math.random() - 1), ph = Math.random() * Math.PI * 2
      pArr[i*3] = Math.sin(th)*Math.cos(ph)*1.25; pArr[i*3+1] = Math.sin(th)*Math.sin(ph)*1.25; pArr[i*3+2] = Math.cos(th)*1.25
    }
    const pGeo = new THREE.BufferGeometry()
    pGeo.setAttribute('position', new THREE.BufferAttribute(pArr, 3))
    const pMat = new THREE.PointsMaterial({ color: col, size: 0.06, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true })
    scene.add(new THREE.Points(pGeo, pMat))

    let frameId: number
    let t = 0, spkSmooth = 0

    function animate() {
      frameId = requestAnimationFrame(animate)
      t += 0.016
      orbMat.uniforms.uT.value = t
      spkSmooth += ((spkRef.current ? 1 : 0) - spkSmooth) * 0.09
      orbMat.uniforms.uSpk.value = spkSmooth
      pMat.opacity = spkSmooth * 0.78

      const pos = pGeo.attributes.position.array as Float32Array
      for (let i = 0; i < NP; i++) {
        pLife[i] += 0.007 + (spkRef.current ? 0.005 : 0)
        if (pLife[i] > 1) {
          const th = Math.acos(2*Math.random()-1), ph = Math.random()*Math.PI*2
          pos[i*3] = Math.sin(th)*Math.cos(ph)*1.25
          pos[i*3+1] = Math.sin(th)*Math.sin(ph)*1.25
          pos[i*3+2] = Math.cos(th)*1.25
          pVel[i] = { x:(Math.random()-.5)*.015, y:0.009+Math.random()*.019, z:(Math.random()-.5)*.009 }
          pLife[i] = 0
        } else {
          pos[i*3] += pVel[i].x; pos[i*3+1] += pVel[i].y; pos[i*3+2] += pVel[i].z
        }
      }
      pGeo.attributes.position.needsUpdate = true
      renderer.render(scene, cam)
    }
    animate()

    return () => {
      cancelAnimationFrame(frameId)
      pGeo.dispose(); orbMat.dispose(); renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [size, color])

  return <div ref={mountRef} style={{ width: size, height: size }} />
}

// ── Celebration burst (full-screen confetti explosion) ─────────────────────

function CelebrationBurst() {
  const mountRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = mountRef.current
    if (!el) return
    const W = window.innerWidth, H = window.innerHeight

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: true })
    renderer.setPixelRatio(1)
    renderer.setSize(W, H)
    renderer.setClearColor(0, 0)
    el.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const cam = new THREE.PerspectiveCamera(60, W / H, 0.1, 50)
    cam.position.z = 10

    const PALETTE = [
      '#FF6B6B', '#FFD93D', '#6BCB77', '#4D96FF', '#FF6FC8',
      '#FFB347', '#78C2FF', '#C878FF', '#78FFD6', '#FFE66D',
    ]
    const N = 240

    const geo = new THREE.BoxGeometry(0.14, 0.28, 0.02)
    const mat = new THREE.MeshBasicMaterial({ vertexColors: true })
    const mesh = new THREE.InstancedMesh(geo, mat, N)
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage)
    scene.add(mesh)

    for (let i = 0; i < N; i++) mesh.setColorAt(i, new THREE.Color(PALETTE[i % PALETTE.length]))
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

    // Half the viewport height in Three.js units at z=0
    const halfH = Math.tan((60 / 2) * Math.PI / 180) * 10
    const halfW = halfH * (W / H)

    const particles = Array.from({ length: N }, () => {
      const angle = Math.random() * Math.PI * 2
      const speed = 0.07 + Math.random() * 0.22
      const vy0   = 0.05 + Math.random() * 0.14
      return {
        x: (Math.random() - 0.5) * halfW * 0.3, // start near center-x
        y: -halfH * 0.25 + (Math.random() - 0.5) * 0.5, // slightly below center
        z: 0,
        vx: Math.cos(angle) * speed,
        vy: vy0,
        vz: (Math.random() - 0.5) * 0.06,
        rx: (Math.random() - 0.5) * 0.09,
        ry: (Math.random() - 0.5) * 0.11,
        rotX: Math.random() * Math.PI * 2,
        rotY: Math.random() * Math.PI * 2,
      }
    })

    const dummy = new THREE.Object3D()
    const TOTAL_FRAMES = 185
    let frame = 0, frameId: number

    function animate() {
      frameId = requestAnimationFrame(animate)
      frame++

      for (let i = 0; i < N; i++) {
        const p = particles[i]
        p.vy -= 0.005; p.vx *= 0.99; p.vy *= 0.992
        p.x += p.vx; p.y += p.vy; p.z += p.vz
        p.rotX += p.rx; p.rotY += p.ry
        const life = Math.max(0, 1 - Math.max(0, frame - 25) / 148)
        dummy.position.set(p.x, p.y, p.z)
        dummy.rotation.set(p.rotX, p.rotY, 0)
        dummy.scale.setScalar(life)
        dummy.updateMatrix()
        mesh.setMatrixAt(i, dummy.matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
      renderer.render(scene, cam)

      if (frame >= TOTAL_FRAMES) cancelAnimationFrame(frameId)
    }
    animate()

    return () => {
      cancelAnimationFrame(frameId)
      geo.dispose(); mat.dispose(); renderer.dispose()
      if (el.contains(renderer.domElement)) el.removeChild(renderer.domElement)
    }
  }, [])

  return <div ref={mountRef} style={{ position: 'fixed', inset: 0, zIndex: 100, pointerEvents: 'none' }} />
}

// ── Speech ─────────────────────────────────────────────────────────────────

function stripEmoji(text: string) {
  return text.replace(/[\u{1F000}-\u{1FFFF}]/gu, '').replace(/[\u{2600}-\u{27BF}]/gu, '').replace(/\s{2,}/g, ' ').trim()
}

let speechCancelled = false
function speak(text: string, onDone?: () => void) {
  if (!window.speechSynthesis) { onDone?.(); return }
  speechCancelled = false
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(stripEmoji(text))
  u.lang = 'es-419'; u.rate = 0.92; u.pitch = 1.08
  const v = window.speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith('es') && v.localService)
         || window.speechSynthesis.getVoices().find(v => v.lang.toLowerCase().startsWith('es'))
  if (v) u.voice = v
  u.onend = () => { if (!speechCancelled) onDone?.() }
  u.onerror = () => onDone?.()
  window.speechSynthesis.speak(u)
}
function stopSpeech() { speechCancelled = true; window.speechSynthesis?.cancel() }

// ── Main Component ─────────────────────────────────────────────────────────

export function CheckinExperience({
  child,
  initialTasks,
  initialBalance,
  initialCatalog,
  initialRedemptions,
}: {
  child: KidChild
  initialTasks: Task[]
  initialBalance: number
  initialCatalog: CatalogItem[]
  initialRedemptions: Redemption[]
}) {
  const router = useRouter()
  // Spec 0008: la data llega del servidor ya scopeada al child_id de la cookie
  // firmada. Este componente no consulta más la DB por su cuenta.
  const tasks = initialTasks
  const catalog = initialCatalog
  const [balance, setBalance] = useState(initialBalance)
  const [redemptions, setRedemptions] = useState<Redemption[]>(initialRedemptions)
  const [screen, setScreen] = useState<Screen>('checkin')
  const [taskIndex, setTaskIndex] = useState(0)
  const [speaking, setSpeaking] = useState(false)
  const [questionText, setQuestionText] = useState('')
  const [thinking, setThinking] = useState(false)
  const [chips, setChips] = useState<string[]>([])
  const [pendingTasks, setPendingTasks] = useState<Task[]>([])
  const [completedTasks, setCompletedTasks] = useState<Task[]>([])
  const [requesting, setRequesting] = useState<string | null>(null)
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set())
  const [storeError, setStoreError] = useState('')

  const pendingResponse = useRef<{ task: Task; idx: number; pending: Task[]; completed: Task[] } | null>(null)

  // Arranca el guion del check-in una sola vez, al montar.
  useEffect(() => {
    startCheckinWith(initialTasks, child)
    return () => stopSpeech()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function startCheckinWith(loadedTasks: Task[], c: KidChild) {
    stopSpeech()
    setSpeaking(true)
    setTimeout(() => {
      speak(`¡Hola ${c.name}! Vamos con tus tareas.`, () => {
        setSpeaking(false)
        askTask(0, loadedTasks, [], [])
      })
    }, 400)
  }

  function askTask(idx: number, currentTasks: Task[], pending: Task[], completed: Task[]) {
    setTaskIndex(idx)
    if (idx >= currentTasks.length) { finishCheckin(pending, completed); return }
    const task = currentTasks[idx]
    if (task.completed_today) { askTask(idx + 1, currentTasks, pending, [...completed, task]); return }
    setSpeaking(true); setThinking(true); setChips([]); setQuestionText('')
    pendingResponse.current = null
    setTimeout(() => {
      setThinking(false)
      const q = `¿Ya hiciste "${task.title}"?`
      revealText(q)
      speak(q, () => {
        setSpeaking(false)
        pendingResponse.current = { task, idx, pending, completed }
        setChips(['Sí, ya la hice ✅', 'Me falta un poco ⏳', 'No la hice todavía ❌'])
      })
    }, 600)
  }

  function revealText(text: string) {
    setQuestionText('')
    const words = text.split(' ')
    let i = 0
    function next() {
      if (i >= words.length) return
      setQuestionText(prev => prev + (i > 0 ? ' ' : '') + words[i++])
      setTimeout(next, 65 + Math.random() * 35)
    }
    next()
  }

  async function respondTask(response: string) {
    const ctx = pendingResponse.current
    if (!ctx) return
    pendingResponse.current = null
    stopSpeech(); setChips([])
    const { task, idx, pending, completed } = ctx
    const didComplete = response.includes('✅') || response.toLowerCase().startsWith('sí') || response.toLowerCase().startsWith('si')
    let newPending = pending, newCompleted = completed
    if (didComplete) {
      // Spec 0008 (C1): el servidor decide cuántos puntos vale la tarea leyendo
      // tasks.points. Acá ya no se manda ningún delta, y el saldo que se muestra
      // es el que devuelve la DB, no una suma optimista del cliente.
      const result = await completeTask(task.id, localDateStr())

      if (result.status === 'ok' || result.status === 'already_done') {
        setBalance(result.balance)
      } else if (result.status === 'no_session') {
        router.push(`/c/${child.pin}`)
        return
      }

      newCompleted = [...completed, task]
      setCompletedTasks(newCompleted)
    } else {
      newPending = [...pending, task]
      setPendingTasks(newPending)
    }
    askTask(idx + 1, tasks, newPending, newCompleted)
  }

  function finishCheckin(pending: Task[], completed: Task[]) {
    setSpeaking(false); setThinking(false)
    if (pending.length === 0) {
      setScreen('done')
      setSpeaking(true)
      speak('¡Muy bien! Completaste todas tus tareas.', () => setSpeaking(false))
    } else {
      setScreen('pending')
    }
  }

  async function requestReward(item: CatalogItem) {
    if (requesting || requestedIds.has(item.id)) return
    setRequesting(item.id)

    // Spec 0008 (H2): el saldo lo valida el servidor y el canje nace 'pending'.
    // El chequeo de `canAfford` de abajo es solo UX.
    const result = await requestRedemption(item.id)

    if (result.status === 'ok' || result.status === 'already_requested') {
      setRedemptions(prev => [
        ...prev,
        { id: `pending-${item.id}`, status: 'pending', rewards_catalog: { title: item.title, cost_points: item.cost_points } },
      ])
      setRequestedIds(prev => new Set([...prev, item.id]))
    } else if (result.status === 'insufficient_points') {
      setBalance(result.balance)
      setStoreError('Te faltan puntos para ese premio.')
    } else if (result.status === 'no_session') {
      router.push(`/c/${child.pin}`)
      return
    } else {
      setStoreError('No pudimos pedir el premio. Probá de nuevo.')
    }

    setRequesting(null)
  }

  const totalTasks = tasks.length
  const pct = totalTasks > 0 ? (taskIndex / totalTasks) * 100 : 0

  return (
    <div className="min-h-screen flex flex-col items-center" style={{ background: 'var(--bg)', maxWidth: 400, margin: '0 auto' }}>

      {/* ── Check-in ── */}
      {screen === 'checkin' && (
        <div className="flex flex-col items-center w-full flex-1 pb-16">
          <div className="w-full px-6 pt-6 pb-2">
            <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--t3)' }}>
              <span>Tarea {Math.min(taskIndex + 1, totalTasks)} de {totalTasks}</span>
              <span>{Math.round(pct)}%</span>
            </div>
            <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--surf2)' }}>
              <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: 'var(--ac)' }} />
            </div>
          </div>

          <div className="relative my-8 flex-shrink-0">
            <OrbThree size={150} speaking={speaking} color={child.avatar_color} />
            {speaking && [1,2,3].map(i => (
              <div key={i} className="absolute rounded-full border" style={{
                inset: `${-i * 14}px`,
                borderColor: `rgba(124,58,237,${0.4 - i * 0.1})`,
                animation: `sring 1.4s ease-out ${(i-1) * 0.38}s infinite`,
              }} />
            ))}
          </div>

          {speaking && (
            <div className="flex items-center gap-1 mb-4" style={{ height: 24 }}>
              {[6,12,20,14,8,18,10].map((h, i) => (
                <div key={i} className="w-[3px] rounded-full" style={{ height: h, background: 'var(--ac)', animation: `wavebar 0.9s ease-in-out ${i * 0.1}s infinite` }} />
              ))}
            </div>
          )}

          <div className="px-8 w-full text-center">
            {thinking && (
              <div className="flex justify-center gap-1.5 py-4">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--t3)', animation: `tdot 1.1s ease-in-out ${i * 0.16}s infinite` }} />
                ))}
              </div>
            )}
            <p className="text-xl font-medium leading-relaxed italic min-h-[80px]" style={{ color: 'var(--t1)' }}>
              {questionText}
            </p>
          </div>

          {chips.length > 0 && (
            <div className="flex flex-col gap-3 px-6 mt-6 w-full">
              {chips.map((chip, i) => (
                <button
                  key={chip}
                  onClick={() => respondTask(chip)}
                  className="w-full py-3.5 rounded-2xl text-sm font-semibold transition-transform active:scale-95"
                  style={{
                    background: i === 0 ? 'rgba(34,197,94,0.12)' : i === 1 ? 'rgba(234,179,8,0.12)' : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${i === 0 ? 'rgba(34,197,94,0.3)' : i === 1 ? 'rgba(234,179,8,0.3)' : 'rgba(239,68,68,0.2)'}`,
                    color: i === 0 ? '#22c55e' : i === 1 ? '#eab308' : '#ef4444',
                  }}
                >
                  {chip}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Done ── */}
      {screen === 'done' && (
        <>
          <CelebrationBurst />
          <div className="flex flex-col items-center justify-center flex-1 p-6 text-center gap-6 w-full">
            <div className="relative">
              <OrbThree size={150} speaking={speaking} color={child.avatar_color} />
              {speaking && [1,2,3].map(i => (
                <div key={i} className="absolute rounded-full border" style={{
                  inset: `${-i * 14}px`,
                  borderColor: `rgba(124,58,237,${0.4 - i * 0.1})`,
                  animation: `sring 1.4s ease-out ${(i-1) * 0.38}s infinite`,
                }} />
              ))}
            </div>

            <div>
              <div className="text-5xl mb-3">🎉</div>
              <h1 className="text-3xl font-bold mb-2">¡Todo listo, {child.name}!</h1>
              <p style={{ color: 'var(--t2)' }}>Te lo ganaste. ¡A disfrutar!</p>
              <div className="mt-3">
                <span className="text-sm font-semibold px-3 py-1 rounded-full" style={{ background: 'rgba(124,58,237,0.12)', color: 'var(--ac)' }}>
                  ⭐ {balance} puntos totales
                </span>
              </div>
            </div>

            <div className="w-full rounded-2xl p-4" style={{ background: 'var(--surf)', border: '1px solid rgba(34,197,94,0.3)' }}>
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--t3)' }}>Completaste hoy</p>
              {completedTasks.map(t => (
                <div key={t.id} className="flex items-center gap-2 py-1.5 text-sm">
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <circle cx="7" cy="7" r="7" fill="rgba(34,197,94,0.15)" />
                    <polyline points="3.5 7 6 9.5 10.5 4.5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <span className="flex-1" style={{ color: 'var(--t2)' }}>{t.title}</span>
                  <span className="text-xs font-semibold" style={{ color: 'var(--ac)' }}>+{t.points} pts</span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-3 w-full">
              {catalog.length > 0 && (
                <button onClick={() => setScreen('store')} className="w-full py-3 rounded-2xl font-semibold text-sm" style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.25)', color: 'var(--ac)' }}>
                  🏆 Canjear en la tienda · {balance} pts
                </button>
              )}
              <button
                onClick={() => { stopSpeech(); router.push(`/c/${child.pin}`) }}
                className="w-full py-4 rounded-2xl font-bold text-lg"
                style={{ background: 'var(--ac)', color: '#fff' }}
              >
                ¡A jugar! →
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Pending ── */}
      {screen === 'pending' && (
        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center gap-6 w-full">
          <OrbThree size={130} speaking={false} color={child.avatar_color} />
          <div>
            <h1 className="text-2xl font-bold mb-2">Casi, {child.name}</h1>
            <p style={{ color: 'var(--t2)' }}>Todavía te falta completar:</p>
          </div>
          <div className="w-full rounded-2xl p-4" style={{ background: 'var(--surf)', border: '1px solid rgba(239,68,68,0.25)' }}>
            {pendingTasks.map(t => (
              <div key={t.id} className="flex items-center gap-2 py-1.5 text-sm">
                <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }} />
                <span>{t.title}</span>
              </div>
            ))}
          </div>
          <p className="italic text-sm" style={{ color: 'var(--t2)' }}>"¡Yo sé que podés! Volvé cuando termines."</p>
          <button
            onClick={() => router.push(`/c/${child.pin}`)}
            className="w-full py-4 rounded-2xl font-bold"
            style={{ background: 'var(--surf2)', color: 'var(--t1)', border: '1px solid var(--bdr)' }}
          >
            Vuelvo cuando termine →
          </button>
        </div>
      )}

      {/* ── Store ── */}
      {screen === 'store' && (
        <div className="flex flex-col w-full flex-1 p-6 gap-5">
          <div className="flex items-center gap-3">
            <button onClick={() => setScreen(completedTasks.length > 0 && pendingTasks.length === 0 ? 'done' : 'checkin')} className="text-sm" style={{ color: 'var(--t3)' }}>←</button>
            <h1 className="flex-1 text-xl font-bold">Tienda</h1>
            <span className="text-sm font-semibold px-3 py-1 rounded-full" style={{ background: 'rgba(124,58,237,0.12)', color: 'var(--ac)' }}>⭐ {balance} pts</span>
          </div>

          {catalog.length === 0 ? (
            <p className="text-sm text-center py-8" style={{ color: 'var(--t3)' }}>La tienda está vacía por ahora.</p>
          ) : (
            <div className="space-y-3">
              {catalog.map(item => {
                const canAfford = balance >= item.cost_points
                const requested = requestedIds.has(item.id)
                return (
                  <div key={item.id} className="flex items-center gap-4 rounded-2xl p-4" style={{ background: 'var(--surf)', border: `1px solid ${requested ? 'rgba(124,58,237,0.4)' : 'var(--bdr)'}`, opacity: !canAfford && !requested ? 0.55 : 1 }}>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.title}</p>
                      <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--ac)' }}>{item.cost_points} pts</p>
                    </div>
                    <button
                      onClick={() => requestReward(item)}
                      disabled={!canAfford || requested || requesting === item.id}
                      className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                      style={{ background: requested ? 'rgba(34,197,94,0.15)' : canAfford ? 'var(--ac)' : 'var(--surf2)', color: requested ? '#22c55e' : canAfford ? '#fff' : 'var(--t3)', border: requested ? '1px solid rgba(34,197,94,0.3)' : 'none' }}
                    >
                      {requested ? '✓ Pedido' : requesting === item.id ? '…' : canAfford ? 'Pedir' : 'Faltan pts'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {redemptions.filter(r => r.status === 'approved').length > 0 && (
            <div className="mt-2">
              <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--t3)' }}>Canjes aprobados</p>
              <div className="space-y-2">
                {redemptions.filter(r => r.status === 'approved').map(r => (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="rgba(34,197,94,0.2)"/><polyline points="4 8 7 11 12 5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    <p className="text-sm flex-1">{r.rewards_catalog?.title}</p>
                    <p className="text-xs font-semibold" style={{ color: '#22c55e' }}>Aprobado</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {storeError && (
            <p className="text-sm text-center" style={{ color: '#ef4444' }}>{storeError}</p>
          )}

          <p className="text-xs text-center" style={{ color: 'var(--t3)' }}>Tu papá/mamá aprueba los canjes</p>
        </div>
      )}

      <style>{`
        @keyframes sring  { 0%{opacity:.7;transform:scale(.88)} 100%{opacity:0;transform:scale(1.55)} }
        @keyframes wavebar{ 0%,100%{transform:scaleY(.4);opacity:.6} 50%{transform:scaleY(1);opacity:1} }
        @keyframes tdot   { 0%,80%,100%{transform:translateY(0);opacity:.35} 40%{transform:translateY(-6px);opacity:1} }
      `}</style>
    </div>
  )
}
