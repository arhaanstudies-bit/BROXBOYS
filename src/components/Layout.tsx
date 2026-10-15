import { NavLink, useLocation, Outlet } from 'react-router-dom'
import { LayoutDashboard, Users, Radio, Terminal, Settings, Send } from 'lucide-react'

const navItems = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/users', label: 'Users', icon: Users },
  { to: '/broadcasts', label: 'Broadcasts', icon: Radio },
  { to: '/commands', label: 'Commands', icon: Terminal },
  { to: '/settings', label: 'Settings', icon: Settings },
]

export default function Layout() {
  const location = useLocation()
  const current = navItems.find((n) => n.to === location.pathname)

  return (
    <div className="flex h-screen overflow-hidden bg-dark-900">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 bg-dark-850 border-r border-dark-700 flex flex-col">
        <div className="px-6 py-5 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center shadow-lg shadow-primary-600/30">
              <Send className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white tracking-tight">BROXBOYS</h1>
              <p className="text-xs text-dark-400">Bot Panel</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-primary-600/15 text-primary-400 border-l-2 border-primary-500'
                      : 'text-dark-400 hover:text-dark-100 hover:bg-dark-800'
                  }`
                }
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {item.label}
              </NavLink>
            )
          })}
        </nav>

        <div className="px-4 py-4 border-t border-dark-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-dark-600 to-dark-800 flex items-center justify-center text-xs font-bold text-dark-200">
              BB
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-dark-100 truncate">Admin</p>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success-500 animate-pulse" />
                <p className="text-xs text-dark-400">Online</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <header className="sticky top-0 z-10 bg-dark-850/80 backdrop-blur-lg border-b border-dark-700 px-8 py-4">
          <h2 className="text-xl font-semibold text-white">{current?.label ?? 'Dashboard'}</h2>
        </header>
        <div className="p-8 animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
