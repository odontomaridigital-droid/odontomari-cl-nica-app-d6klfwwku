import React, { useState } from 'react'
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { LoginPage } from '@/pages/Login'
import {
  Calendar,
  Users,
  FileText,
  MessageSquare,
  Settings,
  PlusCircle,
  LogOut,
  Menu,
  X,
  Shield,
  User,
  Clock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { OdontomariLogoSimbolo, OdontomariSlogan } from '@/components/OdontomariLogo'

export default function Layout() {
  const { user, isAdmin, isRecepcao, logout, isLoading } = useAuth()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-marca-vermelho border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-500 font-medium">Carregando Odontomari...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  const navItems = [
    {
      title: 'Agenda',
      href: '/agenda',
      icon: Calendar,
      role: 'all',
    },
    {
      title: 'Novo Agendamento',
      href: '/novo-agendamento',
      icon: PlusCircle,
      role: 'all',
    },
    {
      title: 'Pacientes',
      href: '/pacientes',
      icon: Users,
      role: 'all',
    },
    {
      title: 'Planejamentos de Tratamento',
      href: '/orcamentos',
      icon: FileText,
      role: 'all',
    },
    {
      title: 'Lembretes WhatsApp',
      href: '/lembretes',
      icon: MessageSquare,
      role: 'all',
    },
    {
      title: 'Configurações',
      href: '/configuracoes',
      icon: Settings,
      role: 'admin', // Admin only
    },
  ]

  const filteredNavItems = navItems.filter((item) => {
    if (item.role === 'admin') return isAdmin
    return true
  })

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-marca-cinza-grafite text-white shrink-0 border-r border-black/40">
        {/* Brand */}
        <div className="h-20 flex items-center px-5 gap-3 border-b border-white/10">
          <OdontomariLogoSimbolo altura={44} titulo="Odontomari" />
          <div>
            <h1 className="font-bold text-base leading-tight">
              Odonto<span className="text-[#e86a72]">mari</span>
            </h1>
            <p className="text-[11px] text-slate-300 font-medium">Clínica Odontológica</p>
            <OdontomariSlogan sobreFundoEscuro className="text-[11px] mt-0.5" />
          </div>
        </div>

        {/* User Badge */}
        <div className="p-4 mx-3 my-3 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-full bg-marca-vermelho flex items-center justify-center text-white font-semibold shrink-0">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">{user.name}</p>
              <div className="flex items-center gap-1 mt-0.5">
                <Badge
                  variant="secondary"
                  className={cn(
                    'text-[10px] px-1.5 py-0 font-normal',
                    isAdmin
                      ? 'bg-marca-vermelho/30 text-red-100 border-marca-vermelho/60'
                      : 'bg-slate-500/20 text-slate-200 border-slate-400/40',
                  )}
                >
                  {isAdmin ? 'Administrador' : 'Recepção'}
                  <Shield className="w-2.5 h-2.5 ml-0.5" />
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {filteredNavItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href
            return (
              <NavLink
                key={item.href}
                to={item.href}
                className={cn(
                  'flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-marca-vermelho text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-white/10',
                )}
              >
                <Icon className={cn('w-4 h-4', isActive ? 'text-white' : 'text-slate-400')} />
                <span>{item.title}</span>
              </NavLink>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-white/10">
          <button
            onClick={() => logout()}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-red-300 hover:bg-white/10 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair do sistema</span>
          </button>
        </div>
      </aside>

      {/* Mobile Header */}
      <header className="md:hidden bg-marca-cinza-grafite text-white border-b border-black/40 px-4 py-2.5 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-2.5">
          <OdontomariLogoSimbolo altura={34} titulo="Odontomari" />
          <div>
            <h1 className="font-bold text-sm leading-none">
              Odonto<span className="text-[#e86a72]">mari</span>
            </h1>
            <OdontomariSlogan sobreFundoEscuro className="text-[10px] leading-tight" />
            <span className="text-[10px] text-slate-300">
              {isAdmin ? 'Perfil Administrador' : 'Perfil Recepção'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="text-white hover:bg-white/10"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>
      </header>

      {/* Mobile Dropdown Navigation */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-marca-cinza-grafite text-white border-b border-black/40 px-4 py-3 space-y-1 sticky top-[57px] z-30 shadow-xl">
          <div className="pb-2 mb-2 border-b border-white/10 flex items-center justify-between">
            <span className="text-xs text-slate-300">Logado como {user.name}</span>
            <Badge
              variant="outline"
              className={cn(
                'text-[10px] px-2 py-0.5',
                isAdmin ? 'border-red-300 text-red-100' : 'border-slate-400 text-slate-200',
              )}
            >
              {isAdmin ? 'Admin' : 'Recepção'}
            </Badge>
          </div>

          {filteredNavItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.href
            return (
              <NavLink
                to={item.href}
                key={item.href}
                onClick={() => setMobileMenuOpen(false)}
                className={cn(
                  'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium',
                  isActive ? 'bg-marca-vermelho text-white' : 'text-slate-300 hover:bg-white/10',
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{item.title}</span>
              </NavLink>
            )
          })}

          <button
            onClick={() => {
              setMobileMenuOpen(false)
              logout()
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-red-300 hover:bg-white/10 rounded-lg pt-2"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        <div className="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </div>
      </main>

      {/* Mobile Bottom Quick Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 flex justify-around py-2 px-1 z-30 shadow-lg">
        <button
          onClick={() => navigate('/agenda')}
          className={cn(
            'flex flex-col items-center gap-0.5 text-[10px] font-medium py-1 px-2 rounded',
            location.pathname === '/agenda'
              ? 'text-marca-vermelho font-semibold'
              : 'text-slate-500',
          )}
        >
          <Calendar className="w-5 h-5" />
          <span>Agenda</span>
        </button>
        <button
          onClick={() => navigate('/novo-agendamento')}
          className={cn(
            'flex flex-col items-center gap-0.5 text-[10px] font-medium py-1 px-2 rounded',
            location.pathname === '/novo-agendamento'
              ? 'text-marca-vermelho font-semibold'
              : 'text-slate-500',
          )}
        >
          <PlusCircle className="w-5 h-5" />
          <span>Agendar</span>
        </button>
        <button
          onClick={() => navigate('/pacientes')}
          className={cn(
            'flex flex-col items-center gap-0.5 text-[10px] font-medium py-1 px-2 rounded',
            location.pathname.startsWith('/pacientes')
              ? 'text-marca-vermelho font-semibold'
              : 'text-slate-500',
          )}
        >
          <Users className="w-5 h-5" />
          <span>Pacientes</span>
        </button>
        <button
          onClick={() => navigate('/lembretes')}
          className={cn(
            'flex flex-col items-center gap-0.5 text-[10px] font-medium py-1 px-2 rounded',
            location.pathname === '/lembretes'
              ? 'text-marca-vermelho font-semibold'
              : 'text-slate-500',
          )}
        >
          <MessageSquare className="w-5 h-5" />
          <span>Lembretes</span>
        </button>
      </nav>
    </div>
  )
}
