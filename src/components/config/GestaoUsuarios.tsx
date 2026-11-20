import React, { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Users,
  Plus,
  Trash2,
  Edit2,
  KeyRound,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  Mail,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { usuariosService, UsuarioSistema } from '@/services/usuarios'
import { useAuth } from '@/contexts/AuthContext'
import { CampoSenha } from '@/components/CampoSenha'

const ROTULO_PERFIL: Record<string, string> = {
  admin: 'Dentista / Administrador',
  recepcao: 'Recepção',
}

/**
 * Gestão de usuários da clínica.
 *
 * Antes desta tela, criar ou corrigir um usuário dependia de acesso ao banco.
 * Só o administrador vê e usa esta aba — a recepção não tem acesso.
 */
export const GestaoUsuarios: React.FC = () => {
  const { toast } = useToast()
  const { user } = useAuth()
  const [usuarios, setUsuarios] = useState<UsuarioSistema[]>([])
  const [carregando, setCarregando] = useState(true)

  // --- diálogo de criar/editar
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<UsuarioSistema | null>(null)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [perfil, setPerfil] = useState<'admin' | 'recepcao'>('recepcao')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [salvando, setSalvando] = useState(false)

  // --- diálogo de redefinir senha
  const [senhaAberto, setSenhaAberto] = useState<UsuarioSistema | null>(null)
  const [novaSenha, setNovaSenha] = useState('')
  const [novaConfirmacao, setNovaConfirmacao] = useState('')

  const [salvandoSenha, setSalvandoSenha] = useState(false)

  const carregar = async () => {
    setCarregando(true)
    try {
      setUsuarios(await usuariosService.getAll())
    } catch (err: any) {
      toast({
        title: 'Erro ao carregar usuários',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const abrirNovo = () => {
    setEditando(null)
    setNome('')
    setEmail('')
    setPerfil('recepcao')
    setSenha('')
    setConfirmacao('')
    setAberto(true)
  }

  const abrirEdicao = (u: UsuarioSistema) => {
    setEditando(u)
    setNome(u.name || '')
    setEmail(u.email)
    setPerfil((u.role as 'admin' | 'recepcao') || 'recepcao')
    setSenha('')
    setConfirmacao('')
    setAberto(true)
  }

  const salvar = async () => {
    if (!nome.trim()) {
      toast({ title: 'Informe o nome', variant: 'destructive' })
      return
    }
    if (!editando && !email.trim()) {
      toast({ title: 'Informe o e-mail', variant: 'destructive' })
      return
    }

    if (!editando) {
      if (senha.length < 8) {
        toast({ title: 'A senha precisa de pelo menos 8 caracteres', variant: 'destructive' })
        return
      }
      if (senha !== confirmacao) {
        toast({ title: 'As duas senhas não são iguais', variant: 'destructive' })
        return
      }
    }

    setSalvando(true)
    try {
      if (editando) {
        await usuariosService.update(editando.id, { name: nome.trim(), role: perfil })
        toast({ title: 'Usuário atualizado!' })
      } else {
        await usuariosService.create({
          email: email.trim(),
          name: nome.trim(),
          role: perfil,
          password: senha,
          passwordConfirm: confirmacao,
        })
        toast({
          title: 'Usuário criado!',
          description: 'Já pode entrar com o e-mail e a senha definidos.',
        })
      }
      setAberto(false)
      carregar()
    } catch (err: any) {
      const msg = String(err?.message || '')
      const descricao =
        msg.includes('already') || msg.includes('unique')
          ? 'Já existe um usuário com esse e-mail.'
          : msg
      toast({ title: 'Não foi possível salvar', description: descricao, variant: 'destructive' })
    } finally {
      setSalvando(false)
    }
  }

  const salvarSenha = async () => {
    if (!senhaAberto) return
    if (novaSenha.length < 8) {
      toast({ title: 'A senha precisa de pelo menos 8 caracteres', variant: 'destructive' })
      return
    }
    if (novaSenha !== novaConfirmacao) {
      toast({ title: 'As duas senhas não são iguais', variant: 'destructive' })
      return
    }
    setSalvandoSenha(true)
    try {
      await usuariosService.definirSenha(senhaAberto.id, novaSenha, novaConfirmacao)
      toast({
        title: 'Senha alterada',
        description: `${senhaAberto.name || senhaAberto.email} já pode entrar com a senha nova.`,
      })
      setSenhaAberto(null)
      setNovaSenha('')
      setNovaConfirmacao('')
    } catch (err: any) {
      toast({
        title: 'Não foi possível alterar a senha',
        description: err?.message,
        variant: 'destructive',
      })
    } finally {
      setSalvandoSenha(false)
    }
  }

  const excluir = async (u: UsuarioSistema) => {
    if (u.id === user?.id) {
      toast({
        title: 'Não pode excluir o próprio usuário',
        description: 'Entre com outro administrador para remover esta conta.',
        variant: 'destructive',
      })
      return
    }
    const admins = usuarios.filter((x) => x.role === 'admin')
    if (u.role === 'admin' && admins.length <= 1) {
      toast({
        title: 'Precisa haver pelo menos um administrador',
        description: 'Crie outro administrador antes de excluir este.',
        variant: 'destructive',
      })
      return
    }
    if (!confirm(`Excluir o usuário ${u.name || u.email}? Ele perderá o acesso ao sistema.`)) return
    try {
      await usuariosService.delete(u.id, u.email)
      toast({ title: 'Usuário removido.' })
      carregar()
    } catch (err: any) {
      toast({ title: 'Erro ao excluir', description: err?.message, variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          Quem pode entrar no sistema e com qual perfil. O administrador vê e edita tudo; a recepção
          cuida da agenda e dos pacientes.
        </p>
        <Button
          size="sm"
          className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white text-xs h-8 shrink-0"
          onClick={abrirNovo}
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Novo usuário
        </Button>
      </div>

      <Alert className="bg-blue-50 border-blue-200 text-blue-900 py-2.5">
        <Mail className="h-4 w-4 text-blue-700" />
        <AlertDescription className="text-xs">
          Para trocar o <strong>e-mail</strong> de um usuário, é preciso falar com o suporte — o
          sistema envia um link de confirmação para o endereço novo, e essa etapa ainda não está
          disponível por aqui. Nome, perfil e senha você muda abaixo.
        </AlertDescription>
      </Alert>

      {carregando ? (
        <div className="p-8 text-center">
          <p className="text-xs text-slate-500">Carregando usuários...</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {usuarios.map((u) => {
            const ehAdmin = u.role === 'admin'
            const ehEu = u.id === user?.id
            return (
              <Card key={u.id} className="border-slate-200 bg-white shadow-sm">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                          ehAdmin
                            ? 'bg-marca-vermelho-claro text-marca-vermelho'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {ehAdmin ? (
                          <ShieldCheck className="w-5 h-5" />
                        ) : (
                          <UserCheck className="w-5 h-5" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-semibold text-slate-900">
                            {u.name || 'Sem nome'}
                          </h3>
                          <Badge
                            variant="outline"
                            className={`text-[10px] ${
                              ehAdmin
                                ? 'border-marca-vermelho/40 text-marca-vermelho bg-marca-vermelho-claro'
                                : 'border-slate-300 text-slate-600'
                            }`}
                          >
                            {ROTULO_PERFIL[u.role || 'recepcao']}
                          </Badge>
                          {ehEu && (
                            <Badge
                              variant="outline"
                              className="text-[10px] text-emerald-700 border-emerald-300"
                            >
                              você
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5 break-all">{u.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-700"
                        title="Redefinir senha"
                        onClick={() => {
                          setSenhaAberto(u)
                          setNovaSenha('')
                          setNovaConfirmacao('')
                        }}
                      >
                        <KeyRound className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-slate-700"
                        title="Editar nome e perfil"
                        onClick={() => abrirEdicao(u)}
                      >
                        <Edit2 className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-600"
                        title="Excluir"
                        onClick={() => excluir(u)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ---------- criar / editar ---------- */}
      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-marca-vermelho" />
              {editando ? 'Editar usuário' : 'Novo usuário'}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {editando
                ? 'Nome e perfil podem ser alterados. O e-mail só muda com o suporte.'
                : 'A pessoa entra no sistema com este e-mail e esta senha.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Nome *</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Marinalva Cordeiro"
                className="mt-1 text-xs sm:text-sm"
              />
            </div>

            <div>
              <Label className="text-xs">E-mail *</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nome@odontomari.com.br"
                disabled={Boolean(editando)}
                className="mt-1 text-xs sm:text-sm disabled:bg-slate-50 disabled:text-slate-500"
              />
              {editando && (
                <p className="text-[10px] text-slate-500 mt-1">
                  Para trocar o e-mail, fale com o suporte.
                </p>
              )}
            </div>

            <div>
              <Label className="text-xs">Perfil *</Label>
              <Select value={perfil} onValueChange={(v) => setPerfil(v as 'admin' | 'recepcao')}>
                <SelectTrigger className="mt-1 text-xs sm:text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin" className="text-xs">
                    Dentista / Administrador — acesso total
                  </SelectItem>
                  <SelectItem value="recepcao" className="text-xs">
                    Recepção — agenda e pacientes
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {!editando && (
              <>
                <div>
                  <Label className="text-xs">Senha *</Label>
                  <CampoSenha
                    value={senha}
                    onChange={(e) => setSenha(e.target.value)}
                    placeholder="Mínimo de 8 caracteres"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Repita a senha *</Label>
                  <CampoSenha
                    value={confirmacao}
                    onChange={(e) => setConfirmacao(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAberto(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white"
              onClick={salvar}
              disabled={salvando}
            >
              {salvando ? 'Salvando...' : editando ? 'Salvar' : 'Criar usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ---------- redefinir senha ---------- */}
      <Dialog open={Boolean(senhaAberto)} onOpenChange={(o) => !o && setSenhaAberto(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-marca-vermelho" />
              Redefinir senha
            </DialogTitle>
            <DialogDescription className="text-xs">
              {senhaAberto?.name || senhaAberto?.email} passará a entrar com a senha definida aqui.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Alert className="bg-amber-50 border-amber-200 py-2">
              <AlertCircle className="h-4 w-4 text-amber-700" />
              <AlertDescription className="text-[11px] text-amber-900">
                A senha atual não é exibida — nem o administrador consegue vê-la. Anote a nova senha
                e entregue à pessoa por um canal seguro.
              </AlertDescription>
            </Alert>

            <div>
              <Label className="text-xs">Nova senha *</Label>
              <CampoSenha
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo de 8 caracteres"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Repita a nova senha *</Label>
              <CampoSenha
                value={novaConfirmacao}
                onChange={(e) => setNovaConfirmacao(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSenhaAberto(null)}
              disabled={salvandoSenha}
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              className="bg-marca-vermelho hover:bg-marca-vermelho-escuro text-white"
              onClick={salvarSenha}
              disabled={salvandoSenha}
            >
              {salvandoSenha ? 'Salvando...' : 'Definir senha'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
