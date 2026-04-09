import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  LayoutDashboard,
  Wallet,
  ArrowLeftRight,
  TrendingUp,
  Tag,
  Upload,
  Banknote,
  Flame,
  FileBarChart,
  HelpCircle,
  RefreshCw,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  User,
} from 'lucide-react';
import { useRefreshPrices } from '../api/hooks';
import { useAuth } from '../contexts/AuthContext';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, iconColor: 'text-blue-400' },
  { name: 'Assets', href: '/assets', icon: Wallet, iconColor: 'text-emerald-400' },
  { name: 'Transactions', href: '/transactions', icon: ArrowLeftRight, iconColor: 'text-cyan-400' },
  { name: 'Performance', href: '/performance', icon: TrendingUp, iconColor: 'text-green-400' },
  { name: 'Cash Flow', href: '/cash-flow', icon: Banknote, iconColor: 'text-amber-400' },
  { name: 'FIRE', href: '/fire', icon: Flame, iconColor: 'text-orange-400' },
  { name: 'Reports', href: '/reports', icon: FileBarChart, iconColor: 'text-purple-400' },
  { name: 'Tags', href: '/tags', icon: Tag, iconColor: 'text-pink-400' },
  { name: 'Import', href: '/import', icon: Upload, iconColor: 'text-teal-400' },
  { name: 'Help', href: '/help', icon: HelpCircle, iconColor: 'text-surface-500' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const refreshPrices = useRefreshPrices();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const sidebarWidth = collapsed ? 'w-[68px]' : 'w-64';
  const mainMargin = collapsed ? 'ml-[68px]' : 'ml-64';

  return (
    <div className="h-screen flex overflow-hidden">
      {/* Sidebar */}
      <aside
        className={clsx(
          'fixed inset-y-0 left-0 glass-dark z-50 transition-all duration-300 ease-in-out',
          sidebarWidth,
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className={clsx('border-b border-surface-800', collapsed ? 'p-3' : 'p-6')}>
            <Link to="/" className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-500 to-brand-600 flex items-center justify-center shrink-0">
                <span className="text-white font-bold text-lg">M</span>
              </div>
              {!collapsed && (
                <div className="overflow-hidden">
                  <h1 className="font-semibold text-surface-100 whitespace-nowrap">Money Matters</h1>
                  <p className="text-xs text-surface-500 whitespace-nowrap">Asset Tracker</p>
                </div>
              )}
            </Link>
          </div>

          {/* Navigation */}
          <nav className={clsx('flex-1 space-y-1', collapsed ? 'p-2' : 'p-4')}>
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  title={collapsed ? item.name : undefined}
                  className={clsx(
                    'flex items-center rounded-xl text-sm font-medium transition-all duration-200',
                    collapsed ? 'justify-center px-0 py-3' : 'gap-3 px-4 py-3',
                    isActive
                      ? 'bg-brand-600/20 text-brand-400 border border-brand-500/30'
                      : 'text-surface-400 hover:text-surface-100 hover:bg-surface-800/50'
                  )}
                >
                  <item.icon className={clsx('w-5 h-5 shrink-0', isActive ? 'text-brand-400' : item.iconColor)} />
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              );
            })}
          </nav>

          {/* Refresh Prices */}
          <div className={clsx('border-t border-surface-800', collapsed ? 'p-2' : 'p-4')}>
            <button
              onClick={() => refreshPrices.mutate()}
              disabled={refreshPrices.isPending}
              title={collapsed ? (refreshPrices.isPending ? 'Updating...' : 'Refresh Prices') : undefined}
              className={clsx(
                'w-full btn btn-secondary text-sm',
                collapsed && 'px-0 justify-center',
                refreshPrices.isPending && 'opacity-50 cursor-not-allowed'
              )}
            >
              <RefreshCw
                className={clsx('w-4 h-4 shrink-0', refreshPrices.isPending && 'animate-spin')}
              />
              {!collapsed && (refreshPrices.isPending ? 'Updating...' : 'Refresh Prices')}
            </button>
          </div>

          {/* User & Logout */}
          {user && (
            <div className={clsx('border-t border-surface-800', collapsed ? 'p-2' : 'p-4')}>
              {!collapsed && (
                <div className="flex items-center gap-2 px-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-surface-700 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-surface-300" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-surface-200 truncate">{user.name}</p>
                    <p className="text-[10px] text-surface-500 truncate">{user.email}</p>
                  </div>
                </div>
              )}
              <button
                onClick={logout}
                title={collapsed ? 'Sign out' : undefined}
                className={clsx(
                  'w-full flex items-center rounded-xl py-2 text-sm text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-colors',
                  collapsed ? 'justify-center px-0' : 'gap-3 px-4',
                )}
              >
                <LogOut className="w-4 h-4 shrink-0" />
                {!collapsed && <span>Sign out</span>}
              </button>
            </div>
          )}

          {/* Collapse Toggle */}
          <div className={clsx('border-t border-surface-800', collapsed ? 'p-2' : 'p-4')}>
            <button
              onClick={() => setCollapsed((c) => !c)}
              className={clsx(
                'w-full flex items-center rounded-xl py-2 text-sm text-surface-400 hover:text-surface-100 hover:bg-surface-800/50 transition-colors',
                collapsed ? 'justify-center px-0' : 'gap-3 px-4',
              )}
            >
              {collapsed ? (
                <PanelLeftOpen className="w-5 h-5" />
              ) : (
                <>
                  <PanelLeftClose className="w-5 h-5" />
                  <span>Collapse</span>
                </>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className={clsx('flex-1 h-screen overflow-hidden transition-all duration-300 ease-in-out', mainMargin)}>
        <div className="p-8 max-w-7xl mx-auto h-full flex flex-col">{children}</div>
      </main>
    </div>
  );
}
