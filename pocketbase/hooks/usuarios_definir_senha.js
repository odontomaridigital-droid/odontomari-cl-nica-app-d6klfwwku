// Redefinição de senha feita pelo ADMINISTRADOR.
//
// Por que este hook existe: pela API REST, trocar a senha de outro usuário
// exige `oldPassword` — e o PocketBase trata esse campo como a senha DO ALVO,
// não de quem está editando. Ou seja, o admin só conseguiria trocar a senha de
// alguém sabendo a senha atual dessa pessoa, o que não resolve o caso real
// (a pessoa esqueceu a senha).
//
// Este hook dá um caminho próprio e seguro: um admin autenticado pede a troca,
// o servidor confere que ele é admin e grava a senha nova, sem pedir a antiga.
// A senha do admin NÃO é necessária e NÃO é registrada em lugar nenhum.
//
// Rota: POST /backend/v1/usuarios/definir-senha
// Corpo: { usuarioId, senha, confirmacao }

routerAdd(
  'POST',
  '/backend/v1/usuarios/definir-senha',
  (e) => {
    const auth = e.auth
    if (!auth) {
      throw new UnauthorizedError('Faça login para continuar.')
    }
    if (auth.get('role') !== 'admin') {
      throw new ForbiddenError('Apenas o administrador pode redefinir senhas.')
    }

    const body = e.requestInfo().body || {}
    const usuarioId = String(body.usuarioId || '').trim()
    const senha = String(body.senha || '')
    const confirmacao = String(body.confirmacao || '')

    if (!usuarioId) {
      throw new BadRequestError('Informe o usuário.')
    }
    if (senha.length < 8) {
      throw new BadRequestError('A senha precisa ter pelo menos 8 caracteres.')
    }
    if (senha !== confirmacao) {
      throw new BadRequestError('As duas senhas não são iguais.')
    }

    let alvo
    try {
      alvo = $app.findRecordById('users', usuarioId)
    } catch (_) {
      throw new NotFoundError('Usuário não encontrado.')
    }

    // Trava de segurança: não deixa o admin se trancar fora da própria conta
    // por engano, exigindo que ele use o próprio fluxo de recuperação.
    if (alvo.id === auth.id) {
      throw new BadRequestError(
        'Para trocar a sua própria senha, use o "Esqueceu a senha" na tela de entrada.',
      )
    }

    alvo.setPassword(senha)
    $app.save(alvo)

    $app.logger().info('senha redefinida por admin', 'alvo', alvo.email, 'por', auth.email)

    return e.json(200, { ok: true, email: alvo.email })
  },
  $apis.requireAuth(),
)
