import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from '@/components/ui/toaster'
import { Toaster as Sonner } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { AuthProvider } from '@/contexts/AuthContext'
import Layout from './components/Layout'
import Index from './pages/Index'
import { AgendaPage } from './pages/Agenda'
import { NovoAgendamentoPage } from './pages/NovoAgendamento'
import { PacientesPage } from './pages/Pacientes'
import { ProntuarioPage } from './pages/Prontuario'
import { OrcamentosPage } from './pages/Orcamentos'
import { LembretesPage } from './pages/Lembretes'
import { OportunidadesPage } from './pages/Oportunidades'
import { MarketingPage } from './pages/Marketing'
import { ConfiguracoesPage } from './pages/Configuracoes'
import { LogsPage } from './pages/Logs'
import { ImportacaoPage } from './pages/Importacao'
import { EsterilizacaoPage } from './pages/Esterilizacao'
import { ResetPasswordPage } from './pages/ResetPassword'
import NotFound from './pages/NotFound'

const App = () => (
  <BrowserRouter>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Index />} />
            <Route path="/agenda" element={<AgendaPage />} />
            <Route path="/novo-agendamento" element={<NovoAgendamentoPage />} />
            <Route path="/pacientes" element={<PacientesPage />} />
            <Route path="/pacientes/:id/prontuario" element={<ProntuarioPage />} />
            <Route path="/orcamentos" element={<OrcamentosPage />} />
            <Route path="/lembretes" element={<LembretesPage />} />
            <Route path="/oportunidades" element={<OportunidadesPage />} />
            <Route path="/marketing" element={<MarketingPage />} />
            <Route path="/configuracoes" element={<ConfiguracoesPage />} />
            <Route path="/importacao" element={<ImportacaoPage />} />
            <Route path="/esterilizacao" element={<EsterilizacaoPage />} />
            <Route path="/logs" element={<LogsPage />} />
          </Route>
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </TooltipProvider>
    </AuthProvider>
  </BrowserRouter>
)

export default App
