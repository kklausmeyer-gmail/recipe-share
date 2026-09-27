import { BookOpen, CalendarDays, Plus, Settings, ShoppingCart } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/store'

export default function Layout() {
  const { isOwner } = useAuth()
  const items = [
    { to: '/', label: 'Recipes', icon: BookOpen, end: true },
    { to: '/add', label: 'Add', icon: Plus },
    ...(isOwner
      ? [
          { to: '/plan', label: 'Plan', icon: CalendarDays },
          { to: '/grocery', label: 'Groceries', icon: ShoppingCart },
        ]
      : []),
    { to: '/settings', label: 'Settings', icon: Settings },
  ]

  return (
    <div className="min-h-dvh pb-[calc(4.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <header className="sticky top-0 z-30 hidden border-b border-line bg-cream/90 backdrop-blur md:block">
        <div className="mx-auto flex max-w-6xl items-center gap-8 px-6 py-3">
          <NavLink to="/" className="font-serif text-xl font-semibold text-accent">
            Recipe Box
          </NavLink>
          <nav className="flex gap-1">
            {items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${isActive ? 'bg-accent-soft text-accent-dark' : 'text-muted hover:text-ink'}`
                }
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-6 md:pt-6">
        <Outlet />
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-cream/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="flex justify-around">
          {items.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] ${isActive ? 'text-accent' : 'text-muted'}`
              }
            >
              <Icon size={22} />
              {label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
