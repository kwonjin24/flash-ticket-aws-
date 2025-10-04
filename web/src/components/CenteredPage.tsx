import type { ReactNode } from 'react'

export const CenteredPage = ({ children }: { children: ReactNode }) => (
  <div className="center-layout">
    <div className="center-layout__inner">{children}</div>
  </div>
)
