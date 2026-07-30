'use client'

import { useEffect, useState } from 'react'

export function ThemeToggle() {
  const [dark, setDark] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('listo-theme')
    if (saved === 'light') setDark(false)
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    if (next) {
      document.documentElement.removeAttribute('data-theme')
      localStorage.removeItem('listo-theme')
    } else {
      document.documentElement.setAttribute('data-theme', 'light')
      localStorage.setItem('listo-theme', 'light')
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? 'Activar modo claro' : 'Activar modo oscuro'}
      style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        border: '1px solid var(--bdr)', background: 'var(--surf2)',
        color: 'var(--t2)', cursor: 'pointer', fontSize: 15,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'background 0.15s',
      }}
    >
      {dark ? '☀' : '🌙'}
    </button>
  )
}
