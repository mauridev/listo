'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

// ── Types ──────────────────────────────────────────────────────────────────

type KidChild = { id: string; name: string; avatar_color: string; familyId: string; pin: string; reward_text: string | null }
type Task = { id: string; title: string; recurrence: string; days: number[] | null; points: number; completed_today: boolean }
type CatalogItem = { id: string; title: string; cost_points: number }
type Redemption = { id: string; status: 'pending' | 'approved' | 'rejected'; rewards_catalog?: { title: string; cost_points: number } }
type Screen = 'checkin' | 'done' | 'pending' | 'store'

function taskAppliesToday(task: { recurrence: string; days: number[] | null }): boolean {
  const day = new Date().getDay()
  if (task.recurrence === 'daily') return true
  if (task.recurrence === 'weekdays') return day >= 1 && day <= 5
  if (task.recurrence === 'weekend') return day === 0 || day === 6
  if (task.recurrence === 'custom') return task.days?.includes(day) ?? false
  return true
}

// ── Orb ───────────────────────────────────────────────────────────────────

function OrbCanvas({ size, speaking, color }: { size: number; speaking: boolean; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<number>(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const p = size * dpr
    canvas.width = p; canvas.height = p
    canvas.style.width = `${size}px`; canvas.style.height = `${size}px`
    const ctx = canvas.getContext('2d')!
    const cx = p / 2, cy = p / 2, r = p * 0.37
    const waves = Array.from({ length: 7 }, () => ({
      fr: 2 + Math.floor(Math.random() * 3),
      am: (0.022 + Math.random() * 0.038) * r,
      ph: Math.random() * Math.PI * 2,
      sp: 0.38 + Math.random() * 0.72,
    }))

    function draw(t: number) {
      ctx.clearRect(0, 0, p, p)
      const N = 72
      ctx.beginPath()
      for (let i = 0; i <= N; i++) {
        const a = (i / N) * Math.PI * 2
        const rr = waves.reduce((acc, w) => acc + w.am * Math.sin(w.fr * a + t * w.sp + w.ph), r)
        i === 0 ? ctx.moveTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
                : ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr)
      }
      ctx.closePath()
      const pulse = (Math.sin(t * 0.55) + 1) / 2
      const g = ctx.createRadialGradient(cx - r * 0.2, cy - r * 0.26, 0, cx, cy, r * 1.15)
      g.addColorStop(0, `rgba(180,140,255,${0.8 + pulse * 0.2})`)
      g.addColorStop(0.42, color); g.addColorStop(0.78, '#4C1D95'); g.addColorStop(1, '#2E1065')
      ctx.fillStyle = g; ctx.fill()
      const h = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.36, 0, cx, cy, r * 0.72)
      h.addColorStop(0, 'rgba(255,255,255,0.28)'); h.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = h; ctx.fill()
      const gl = ctx.createRadialGradient(cx, cy, r * 0.92, cx, cy, r * 1.6)
      gl.addColorStop(0, `rgba(124,58,237,${speaking ? 0.12 + pulse * 0.1 : 0.05 + pulse * 0.04})`)
      gl.addColorStop(1, 'rgba(124,58,237,0)')
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r * 1.6, 0, Math.PI * 2)
      ctx.fillStyle = gl; ctx.fill(); ctx.restore()
    }

    let t = 0
    function tick(ms: number) { t = ms * 0.003; draw(t); frameRef.current = requestAnimationFrame(tick) }
    frameRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frameRef.current)
  }, [size, color, speaking])

  return <canvas ref={canvasRef} style={{ borderRadius: '50%' }} />
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

export function CheckinExperience() {
  const router = useRouter()
  const [child, setChild] = useState<KidChild | null>(null)
  const [tasks, setTasks] = useState<Task[]>([])
  const [balance, setBalance] = useState(0)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
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

  // Ref that captures current task context for respondTask — avoids stale closure bugs
  const pendingResponse = useRef<{ task: Task; idx: number; pending: Task[]; completed: Task[] } | null>(null)

  useEffect(() => {
    const stored = sessionStorage.getItem('listo_child')
    if (!stored) { router.push('/'); return }
    const c: KidChild = JSON.parse(stored)
    setChild(c)

    async function fetchAll() {
      const supabase = createClient()
      const today = new Date().toISOString().split('T')[0]

      const [{ data: tasksData }, { data: balanceData }, { data: catalogData }, { data: redemptionsData }] = await Promise.all([
        supabase.from('tasks').select('*, task_completions(id, date)').eq('child_id', c.id).eq('active', true),
        supabase.rpc('get_child_balance', { p_child_id: c.id }),
        supabase.from('rewards_catalog').select('id, title, cost_points').eq('child_id', c.id).eq('active', true).order('cost_points'),
        supabase.from('reward_redemptions').select('*, rewards_catalog(title, cost_points)').eq('child_id', c.id).order('created_at', { ascending: false }).limit(10),
      ])

      const todayTasks: Task[] = (tasksData ?? [])
        .filter((t: any) => taskAppliesToday(t))
        .map((t: any) => ({
          id: t.id,
          title: t.title,
          recurrence: t.recurrence,
          days: t.days ?? null,
          points: t.points ?? 10,
          completed_today: t.task_completions?.some((tc: any) => tc.date === today) ?? false,
        }))

      setTasks(todayTasks)
      setBalance(balanceData ?? 0)
      setCatalog(catalogData ?? [])
      setRedemptions(redemptionsData ?? [])

      // Start check-in immediately after loading
      startCheckinWith(todayTasks, c)
    }
    fetchAll()
  }, [router])

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

    if (idx >= currentTasks.length) {
      finishCheckin(pending, completed)
      return
    }

    const task = currentTasks[idx]

    // Skip already-completed tasks silently
    if (task.completed_today) {
      askTask(idx + 1, currentTasks, pending, [...completed, task])
      return
    }

    setSpeaking(true)
    setThinking(true)
    setChips([])
    setQuestionText('')
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

    stopSpeech()
    setChips([])

    const { task, idx, pending, completed } = ctx
    const didComplete = response.includes('✅') || response.toLowerCase().startsWith('sí') || response.toLowerCase().startsWith('si')

    let newPending = pending
    let newCompleted = completed

    if (didComplete) {
      const supabase = createClient()
      const today = new Date().toISOString().split('T')[0]
      await supabase.from('task_completions').upsert(
        { task_id: task.id, child_id: child!.id, date: today },
        { onConflict: 'task_id,date' }
      )
      await supabase.from('point_transactions').insert({ child_id: child!.id, delta: task.points, reason: task.title })
      setBalance(prev => prev + task.points)
      newCompleted = [...completed, task]
      setCompletedTasks(newCompleted)
    } else {
      newPending = [...pending, task]
      setPendingTasks(newPending)
    }

    askTask(idx + 1, tasks, newPending, newCompleted)
  }

  function finishCheckin(pending: Task[], completed: Task[]) {
    setSpeaking(false)
    setThinking(false)
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
    const supabase = createClient()
    await supabase.from('reward_redemptions').insert({ child_id: child!.id, reward_id: item.id })
    setRedemptions(prev => [...prev, { id: Date.now().toString(), status: 'pending', rewards_catalog: { title: item.title, cost_points: item.cost_points } }])
    setRequestedIds(prev => new Set([...prev, item.id]))
    setRequesting(null)
  }

  if (!child) return null

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
            <OrbCanvas size={150} speaking={speaking} color={child.avatar_color} />
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
        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center gap-6">
          <div className="relative">
            <OrbCanvas size={150} speaking={speaking} color={child.avatar_color} />
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
      )}

      {/* ── Pending ── */}
      {screen === 'pending' && (
        <div className="flex flex-col items-center justify-center flex-1 p-6 text-center gap-6">
          <OrbCanvas size={130} speaking={false} color={child.avatar_color} />
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

          {/* Catalog */}
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

          {/* Approved redemptions */}
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

          <p className="text-xs text-center" style={{ color: 'var(--t3)' }}>Tu papá/mamá aprueba los canjes</p>
        </div>
      )}

      <style>{`
        @keyframes sring { 0% { opacity: 0.7; transform: scale(0.88); } 100% { opacity: 0; transform: scale(1.55); } }
        @keyframes wavebar { 0%, 100% { transform: scaleY(0.4); opacity: 0.6; } 50% { transform: scaleY(1); opacity: 1; } }
        @keyframes tdot { 0%, 80%, 100% { transform: translateY(0); opacity: 0.35; } 40% { transform: translateY(-6px); opacity: 1; } }
      `}</style>
    </div>
  )
}
