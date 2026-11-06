import React, { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Calendar, Stethoscope, AlertCircle, Sparkles, UserCheck } from 'lucide-react'
import pb from '@/lib/pocketbase/client'

export const LoginPage: React.FC = () => {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState(false)
  const [forgotLoading, setForgotLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      await login(email, password)
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'Falha ao autenticar. Verifique o e-mail e a senha informados.')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError('Por favor, informe seu e-mail para recuperar a senha.')
      return
    }
    setForgotLoading(true)
    setError(null)
    try {
      await pb.collection('users').requestPasswordReset(email.trim())
      setForgotSuccess(true)
    } catch (err: any) {
      setError('Erro ao solicitar recuperação de senha. Verifique o e-mail digitado.')
    } finally {
      setForgotLoading(false)
    }
  }

  const handleQuickLogin = (quickEmail: string) => {
    setEmail(quickEmail)
    setPassword('Skip@Pass')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-teal-600 text-white shadow-lg shadow-teal-600/30">
            <Stethoscope className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Odontomari Clínica</h1>
          <p className="text-sm text-slate-500">
            Gestão integrada de consultas, pacientes e planejamentos de tratamento
          </p>
        </div>

        <Card className="shadow-md border-slate-200">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl">
              {showForgot ? 'Recuperar Senha' : 'Acesso ao Sistema'}
            </CardTitle>
            <CardDescription>
              {showForgot
                ? 'Digite seu e-mail cadastrado para receber instruções de redefinição.'
                : 'Entre com seu e-mail e senha para acessar seu perfil.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive" className="py-2.5">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-xs sm:text-sm">{error}</AlertDescription>
              </Alert>
            )}

            {forgotSuccess && (
              <Alert className="bg-emerald-50 text-emerald-800 border-emerald-200 py-2.5">
                <Sparkles className="h-4 w-4 text-emerald-600" />
                <AlertDescription className="text-xs sm:text-sm">
                  E-mail de recuperação enviado! Verifique sua caixa de entrada.
                </AlertDescription>
              </Alert>
            )}

            {!showForgot ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="exemplo@odontomari.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="username"
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Senha</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setShowForgot(true)
                        setError(null)
                        setForgotSuccess(false)
                      }}
                      className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                    >
                      Esqueceu a senha?
                    </button>
                  </div>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                  disabled={loading}
                >
                  {loading ? 'Entrando...' : 'Entrar no Sistema'}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="forgot-email">E-mail cadastrado</Label>
                  <Input
                    id="forgot-email"
                    type="email"
                    placeholder="seu.email@odontomari.com.br"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full bg-teal-600 hover:bg-teal-700 text-white"
                  disabled={forgotLoading}
                >
                  {forgotLoading ? 'Enviando link...' : 'Enviar Link de Recuperação'}
                </Button>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setShowForgot(false)
                      setError(null)
                    }}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Voltar para o Login
                  </button>
                </div>
              </form>
            )}
          </CardContent>

          {!showForgot && (
            <CardFooter className="flex flex-col border-t border-slate-100 pt-4 bg-slate-50/70 rounded-b-lg">
              <span className="text-xs text-slate-500 mb-2 font-medium flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-teal-600" />
                Acesso rápido para testes dos perfis:
              </span>
              <div className="grid grid-cols-2 gap-2 w-full text-xs">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-left justify-start h-auto py-2 border-slate-200"
                  onClick={() => handleQuickLogin('ja3dimpressoes3d@gmail.com')}
                >
                  <div>
                    <p className="font-semibold text-slate-800">Administrador</p>
                    <p className="text-[10px] text-slate-500">Dentista / Geral</p>
                  </div>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="text-left justify-start h-auto py-2 border-slate-200"
                  onClick={() => handleQuickLogin('recepcao@odontomari.com.br')}
                >
                  <div>
                    <p className="font-semibold text-slate-800">Recepção</p>
                    <p className="text-[10px] text-slate-500">Agenda e Pacientes</p>
                  </div>
                </Button>
              </div>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  )
}
