import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { AlertCircle, CheckCircle2, KeyRound } from 'lucide-react'
import pb from '@/lib/pocketbase/client'
import { CampoSenha } from '@/components/CampoSenha'
import { OdontomariLogoCompleta, OdontomariSlogan } from '@/components/OdontomariLogo'

/**
 * Página de redefinição de senha.
 *
 * É o destino do link enviado no e-mail de recuperação. O caminho
 * `/reset-password` é fixo pela plataforma e casa com o placeholder
 * {RESET_URL} do template — não mudar.
 */
export const ResetPasswordPage: React.FC = () => {
  const [params] = useSearchParams()
  const navigate = useNavigate()

  const token = params.get('token') || ''
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [sucesso, setSucesso] = useState(false)
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    if (!token) {
      setErro(
        'Link inválido ou incompleto. Solicite a recuperação de senha novamente na tela de entrada.',
      )
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErro(null)

    if (senha.length < 8) {
      setErro('A senha precisa ter pelo menos 8 caracteres.')
      return
    }
    if (senha !== confirmacao) {
      setErro('As duas senhas não são iguais.')
      return
    }

    setEnviando(true)
    try {
      await pb.collection('users').confirmPasswordReset(token, senha, confirmacao)
      setSucesso(true)
      setTimeout(() => navigate('/', { replace: true }), 3500)
    } catch (err: any) {
      const msg = String(err?.message || '')
      if (msg.toLowerCase().includes('token')) {
        setErro(
          'Este link expirou ou já foi usado. Cada link vale uma vez só e por tempo limitado. Solicite outro na tela de entrada.',
        )
      } else if (msg.toLowerCase().includes('password')) {
        setErro('A senha não atende aos requisitos. Use pelo menos 8 caracteres.')
      } else {
        setErro(msg || 'Não foi possível redefinir a senha. Tente novamente.')
      }
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center gap-3">
          <OdontomariLogoCompleta altura={100} titulo="Odontomari — Clínica Odontológica" />
          <OdontomariSlogan className="text-sm -mt-1" />
        </div>

        <Card className="shadow-md border-slate-200">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-xl flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-marca-vermelho" />
              {sucesso ? 'Senha alterada' : 'Criar nova senha'}
            </CardTitle>
            <CardDescription>
              {sucesso
                ? 'Sua senha foi atualizada.'
                : 'Escolha uma senha nova para entrar no sistema da clínica.'}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4">
            {sucesso ? (
              <>
                <Alert className="bg-emerald-50 text-emerald-800 border-emerald-200">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <AlertDescription className="text-sm">
                    Pronto! Você já pode entrar com a senha nova. Estamos levando você para a tela
                    de entrada.
                  </AlertDescription>
                </Alert>
                <Button
                  className="w-full bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white"
                  onClick={() => navigate('/', { replace: true })}
                >
                  Ir para a entrada
                </Button>
              </>
            ) : (
              <>
                {erro && (
                  <Alert variant="destructive" className="py-2.5">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs sm:text-sm">{erro}</AlertDescription>
                  </Alert>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="nova-senha">Nova senha</Label>
                    <CampoSenha
                      id="nova-senha"
                      value={senha}
                      onChange={(e) => setSenha(e.target.value)}
                      placeholder="Mínimo de 8 caracteres"
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirma-senha">Repita a nova senha</Label>
                    <CampoSenha
                      id="confirma-senha"
                      value={confirmacao}
                      onChange={(e) => setConfirmacao(e.target.value)}
                      placeholder="Digite de novo"
                      required
                      autoComplete="new-password"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white"
                    disabled={enviando || !token}
                  >
                    {enviando ? 'Salvando...' : 'Salvar nova senha'}
                  </Button>
                </form>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => navigate('/', { replace: true })}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Voltar para a entrada
                  </button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
