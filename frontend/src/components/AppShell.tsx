import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { WalletModal } from './WalletModal'

const PAGE_TITLES: Record<string, { title: string; subtitle: string }> = {
  '/investor': { title: 'Investor Dashboard', subtitle: 'Manage your liquidity positions and earnings' },
  '/borrower': { title: 'Borrower Dashboard', subtitle: 'Create and manage your financing requests' },
  '/admin':    { title: 'Admin Dashboard',    subtitle: 'Review requests and monitor pool activity' },
  '/pool':     { title: 'Liquidity Pool',     subtitle: 'Live pool statistics and investor breakdown' },
  '/financing':{ title: 'Financing Requests', subtitle: 'Browse and manage all financing requests' },
}

export function AppShell() {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [walletModalOpen, setWalletModalOpen] = useState(false)
  const { pathname } = useLocation()

  const meta = PAGE_TITLES[pathname] ?? { title: 'StellarGive', subtitle: 'Invoice Finance Platform' }

  return (
    <div className="app-shell">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="main-content">
        <TopBar
          title={meta.title}
          subtitle={meta.subtitle}
          onHamburger={() => setSidebarOpen(o => !o)}
          onWalletClick={() => setWalletModalOpen(true)}
        />
        <main className="page-content">
          <Outlet />
        </main>
      </div>

      {walletModalOpen && <WalletModal onClose={() => setWalletModalOpen(false)} />}
    </div>
  )
}
