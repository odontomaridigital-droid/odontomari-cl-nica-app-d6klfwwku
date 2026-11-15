import pb from '@/lib/pocketbase/client'
import { registrarLog } from '@/services/logsAuditoria'

/** Usuário do sistema (coleção auth `users`) */
export interface UsuarioSistema {
  id: string
  email: string
  name?: string
  role?: 'admin' | 'recepcao'
  verified?: boolean
  created?: string
  updated?: string
}

const COLECAO = 'users'

/**
 * Gestão de usuários da clínica.
 *
 * Só o administrador acessa esta tela. As regras de acesso da coleção
 * (`updateRule`) já permitem que o admin edite qualquer usuário — foi o que a
 * migration 0018 ajustou. Criar continua restrito, por segurança.
 */
export const usuariosService = {
  async getAll(): Promise<UsuarioSistema[]> {
    return await pb.collection(COLECAO).getFullList<UsuarioSistema>({
      sort: 'name,email',
    })
  },

  /**
   * Cria um usuário novo.
   * A senha precisa ser confirmada — o PocketBase exige `passwordConfirm`.
   */
  async create(dados: {
    email: string
    name: string
    role: 'admin' | 'recepcao'
    password: string
    passwordConfirm: string
  }): Promise<UsuarioSistema> {
    const criado = await pb.collection(COLECAO).create<UsuarioSistema>({
      email: dados.email.trim(),
      name: dados.name.trim(),
      role: dados.role,
      password: dados.password,
      passwordConfirm: dados.passwordConfirm,
      emailVisibility: true,
      // `verified` NÃO é enviado: o PocketBase recusa essa alteração pela API
      // (validation_values_mismatch). A conta nasce não verificada, mas entra
      // normalmente — a verificação só é exigida se a clínica ativá-la.
    })
    registrarLog('criou', 'configuracoes', `Criou usuário: ${criado.email}`, criado.id)
    return criado
  },

  /** Atualiza nome e perfil. E-mail tem caminho próprio por causa da confirmação. */
  async update(
    id: string,
    dados: { name?: string; role?: 'admin' | 'recepcao' },
  ): Promise<UsuarioSistema> {
    const atualizado = await pb.collection(COLECAO).update<UsuarioSistema>(id, dados)
    registrarLog('editou', 'configuracoes', `Editou usuário: ${atualizado.email}`, id)
    return atualizado
  },

  /**
   * Redefine a senha de outro usuário (administrador).
   *
   * O PocketBase exige `oldPassword` em qualquer troca de senha, mesmo quando
   * quem edita é o admin — e o valor exigido é a senha de QUEM ESTÁ LOGADO, não
   * a do usuário-alvo. Por isso a tela pede a senha atual do administrador.
   * Isso é o comportamento seguro: ninguém troca senha sem provar quem é.
   */
  async definirSenha(
    id: string,
    senha: string,
    confirmacao: string,
    senhaDoAdmin: string,
  ): Promise<void> {
    await pb.collection(COLECAO).update(id, {
      password: senha,
      passwordConfirm: confirmacao,
      oldPassword: senhaDoAdmin,
    })
    registrarLog('editou', 'configuracoes', `Redefiniu a senha de um usuário`, id)
  },

  async delete(id: string, email: string): Promise<boolean> {
    const ok = await pb.collection(COLECAO).delete(id)
    registrarLog('excluiu', 'configuracoes', `Excluiu usuário: ${email}`, id)
    return ok
  },
}
