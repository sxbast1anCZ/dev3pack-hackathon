import type { ReactNode } from 'react'
import { Icon } from './Icon'

export function Brand() {
  return (
    <a className="brand" href="/">
      <span className="brand-mark">
        <Icon name="pill" />
      </span>
      <span className="brand-name">Remedio Seguro</span>
    </a>
  )
}

export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Brand />
        {children}
      </div>
    </header>
  )
}
