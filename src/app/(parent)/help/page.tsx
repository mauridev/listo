import Link from 'next/link'

export default function AyudaPage() {
  return (
    <div className="max-w-lg mx-auto space-y-2 pb-10">
      <div className="mb-8">
        <Link href="/dashboard" className="text-sm" style={{ color: 'var(--t3)' }}>← Volver</Link>
        <h1 className="text-2xl font-bold mt-4 mb-1">Centro de ayuda</h1>
        <p className="text-sm" style={{ color: 'var(--t2)' }}>Todo lo que necesitás saber para usar Listo con tu familia.</p>
      </div>

      {/* ── Para padres ── */}
      <SectionHeader>Para padres</SectionHeader>

      <Accordion title="¿Cómo funciona Listo?" emoji="🏠">
        <p>Listo es una app familiar para que los chicos hagan un check-in con sus tareas del día antes de tener tiempo libre (pantallas, juegos, salidas).</p>
        <ol className="mt-3 space-y-1.5 list-decimal list-inside">
          <li>El padre crea las tareas de cada hijo y define cuánto vale cada una en puntos.</li>
          <li>El hijo abre Listo desde su teléfono o computadora usando el código familiar.</li>
          <li>El avatar de IA le pregunta por cada tarea. El hijo responde si la hizo o no.</li>
          <li>Si completó todo, gana sus puntos y puede ir a disfrutar su tiempo libre.</li>
        </ol>
      </Accordion>

      <Accordion title="¿Cómo agrego a mi hijo?" emoji="👦">
        <p>Desde el Dashboard, tocá <strong>+ Hijo</strong>. Elegí nombre y color de avatar. Eso es todo — no necesita crear una cuenta.</p>
        <p className="mt-2">Tu hijo accede usando el <strong>código familiar</strong> que aparece en la parte de arriba del dashboard (6 letras, ej: <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--surf2)' }}>V39QC5</code>). Ese código es único de tu familia.</p>
      </Accordion>

      <Accordion title="¿Cómo creo tareas?" emoji="✅">
        <p>Entrá al perfil de tu hijo (tocá su nombre en el dashboard) y tocá <strong>+ Agregar tarea</strong>. Por cada tarea configurás:</p>
        <ul className="mt-2 space-y-2">
          <Item label="Nombre">Lo que el hijo tiene que hacer. Ej: "Hacer los deberes", "Bañarse".</Item>
          <Item label="Puntos al completar">Cuántos puntos gana el hijo por hacerla. El default es 10. Podés darle más puntos a las tareas más importantes.</Item>
          <Item label="Frecuencia">Cuándo aplica esa tarea:
            <ul className="mt-1 space-y-1 ml-3">
              <li><strong>Todos los días</strong> — aparece siempre.</li>
              <li><strong>Lun–Vie</strong> — solo días de semana.</li>
              <li><strong>Fin de semana</strong> — sábado y domingo.</li>
              <li><strong>Días específicos</strong> — elegís exactamente qué días (ej: Martes y Jueves).</li>
            </ul>
          </Item>
        </ul>
        <Tip>El hijo solo ve las tareas que aplican al día de hoy. Si una tarea es "Bañarse · Mar, Jue, Sáb", el lunes no aparece.</Tip>
      </Accordion>

      <Accordion title="Sistema de puntos" emoji="⭐">
        <p>Cada tarea vale una cantidad de puntos que el padre define. Cuando el hijo completa una tarea en el check-in, esos puntos se suman a su balance automáticamente.</p>
        <ul className="mt-2 space-y-1.5">
          <li>• Los puntos <strong>se acumulan</strong> — no se reinician solos.</li>
          <li>• El balance de cada hijo se ve en su perfil.</li>
          <li>• Si el hijo dice que NO hizo la tarea, no gana puntos.</li>
          <li>• Los puntos se usan para canjear recompensas en la tienda.</li>
        </ul>
        <Tip>Definí los puntos según la dificultad: una tarea simple vale 10, una difícil puede valer 30 o 50.</Tip>
      </Accordion>

      <Accordion title="Tienda de recompensas" emoji="🏆">
        <p>La tienda es un catálogo de premios que el padre crea. El hijo acumula puntos y los canjea por lo que quiere.</p>
        <p className="mt-2 font-medium">Cómo configurarla (como padre):</p>
        <ol className="mt-1 space-y-1.5 list-decimal list-inside">
          <li>Entrá al perfil del hijo.</li>
          <li>Bajá hasta la sección <strong>Tienda de recompensas</strong>.</li>
          <li>Tocá <strong>+ Agregar recompensa</strong>.</li>
          <li>Poné el nombre del premio y cuántos puntos cuesta.</li>
        </ol>
        <p className="mt-3 font-medium">Cómo funciona el canje:</p>
        <ol className="mt-1 space-y-1.5 list-decimal list-inside">
          <li>El hijo va a la tienda desde su pantalla de check-in.</li>
          <li>Ve los premios disponibles y los que puede pagar con sus puntos.</li>
          <li>Toca <strong>Pedir</strong> en el que quiere.</li>
          <li>Vos ves la solicitud en el perfil del hijo bajo "Canjes pendientes".</li>
          <li>Aprobás o rechazás con un toque.</li>
        </ol>
        <Tip>Ejemplos de recompensas: "1 hora extra de pantalla · 30 pts", "Elegís la cena del viernes · 20 pts", "Salida con amigos · 80 pts".</Tip>
      </Accordion>

      <Accordion title="Recompensa de la semana" emoji="🎁">
        <p>Es un texto libre que el padre escribe cada semana. Aparece en la pantalla de bienvenida del hijo como motivación antes de arrancar el check-in.</p>
        <p className="mt-2">No tiene lógica automática — es simplemente un recordatorio visible para el hijo de lo que se gana si cumple. Vos decidís cuándo y cómo dárselo en la vida real.</p>
        <p className="mt-2">Ejemplos: <em>"100$"</em>, <em>"Elegís la película del viernes"</em>, <em>"Permiso para quedarte hasta las 11"</em>.</p>
        <Tip>Cambiala cada semana para mantenerla relevante. Es diferente a la tienda: aquí no hay puntos, es una motivación extra puntual.</Tip>
      </Accordion>

      <Accordion title="La barra de progreso en el dashboard" emoji="📊">
        <p>Cada hijo tiene una barra de progreso que muestra cuántas tareas completó hoy del total que le corresponden.</p>
        <ul className="mt-2 space-y-1.5">
          <li>• Solo cuenta las tareas que aplican al día de hoy (según la frecuencia).</li>
          <li>• Se actualiza en tiempo real cuando el hijo hace el check-in.</li>
          <li>• Cuando llega al 100%, el hijo completó todo lo de hoy.</li>
        </ul>
      </Accordion>

      {/* ── Para hijos ── */}
      <SectionHeader>Para hijos</SectionHeader>

      <Accordion title="¿Cómo entro a Listo?" emoji="📱">
        <p>Tu papá o mamá tiene un <strong>código familiar</strong> de 6 letras (ej: <code className="px-1 py-0.5 rounded text-xs" style={{ background: 'var(--surf2)' }}>V39QC5</code>).</p>
        <ol className="mt-2 space-y-1.5 list-decimal list-inside">
          <li>Abrí el navegador y entrá a la dirección que te dieron.</li>
          <li>Poné el código familiar.</li>
          <li>Elegí tu nombre.</li>
          <li>¡Listo! Ya podés hacer el check-in.</li>
        </ol>
        <p className="mt-2">No necesitás cuenta ni contraseña.</p>
      </Accordion>

      <Accordion title="¿Cómo funciona el check-in?" emoji="🤖">
        <p>El check-in es una charla corta con el avatar de IA. Te va a preguntar por cada tarea del día.</p>
        <ul className="mt-2 space-y-1.5">
          <li>• Si la hiciste → tocá <strong>Sí, ya la hice ✅</strong> y ganás los puntos de esa tarea.</li>
          <li>• Si te falta un poco → tocá <strong>Me falta un poco ⏳</strong>.</li>
          <li>• Si no la hiciste → tocá <strong>No la hice todavía ❌</strong>.</li>
        </ul>
        <p className="mt-2">Si completás todas las tareas, ¡ganás tu tiempo libre!</p>
        <Tip>Solo aparecen las tareas del día de hoy. Si el martes no tenés que bañarte, no te pregunta.</Tip>
      </Accordion>

      <Accordion title="¿Cómo uso mis puntos?" emoji="⭐">
        <p>Cada tarea que completás te da puntos. Los puntos se acumulan y los podés usar en la tienda de recompensas.</p>
        <ol className="mt-2 space-y-1.5 list-decimal list-inside">
          <li>Desde tu pantalla de bienvenida o al terminar el check-in, tocá <strong>Ver tienda de recompensas</strong>.</li>
          <li>Ves todos los premios y cuántos puntos cuestan.</li>
          <li>Si tenés suficientes puntos, tocá <strong>Pedir</strong>.</li>
          <li>Tu papá o mamá recibe la solicitud y la aprueba.</li>
        </ol>
        <Tip>Si un premio dice "Faltan pts", necesitás completar más tareas para juntar los puntos que faltan.</Tip>
      </Accordion>

      {/* ── FAQ ── */}
      <SectionHeader>Preguntas frecuentes</SectionHeader>

      <Accordion title="¿Los puntos se borran?" emoji="❓">
        <p>No. Los puntos se acumulan con el tiempo. No hay reset automático.</p>
      </Accordion>

      <Accordion title="¿Qué pasa si el hijo miente sobre una tarea?" emoji="❓">
        <p>Listo confía en la honestidad del hijo. La app no verifica si la tarea fue hecha en la vida real — eso queda en vos como padre. Lo que sí podés hacer es revisar el historial y pausar o desactivar tareas si algo no funciona.</p>
      </Accordion>

      <Accordion title="¿Puedo tener más de un hijo?" emoji="❓">
        <p>Sí. Podés agregar todos los hijos que quieras. Cada uno tiene su propio perfil, sus propias tareas, su propio balance de puntos y su propia tienda.</p>
      </Accordion>

      <Accordion title="¿El hijo necesita una cuenta?" emoji="❓">
        <p>No. Los hijos entran solo con el código familiar. No hay cuentas, no hay contraseñas, no hay datos personales del hijo guardados.</p>
      </Accordion>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-4 pb-1">
      <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'var(--t3)' }}>{children}</p>
    </div>
  )
}

function Accordion({ title, emoji, children }: { title: string; emoji: string; children: React.ReactNode }) {
  return (
    <details className="group rounded-2xl overflow-hidden" style={{ background: 'var(--surf)', border: '1px solid var(--bdr)' }}>
      <summary className="flex items-center gap-3 px-4 py-4 cursor-pointer select-none list-none">
        <span className="text-lg flex-shrink-0">{emoji}</span>
        <span className="flex-1 text-sm font-semibold" style={{ color: 'var(--t1)' }}>{title}</span>
        <svg className="flex-shrink-0 transition-transform group-open:rotate-180" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--t3)' }} />
        </svg>
      </summary>
      <div className="px-4 pb-4 text-sm space-y-2 leading-relaxed" style={{ color: 'var(--t2)', borderTop: '1px solid var(--bdr)' }}>
        <div className="pt-3">{children}</div>
      </div>
    </details>
  )
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="text-sm">
      <strong style={{ color: 'var(--t1)' }}>{label}:</strong>{' '}
      <span style={{ color: 'var(--t2)' }}>{children}</span>
    </li>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-3 px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)', color: 'var(--ac)' }}>
      💡 {children}
    </div>
  )
}
