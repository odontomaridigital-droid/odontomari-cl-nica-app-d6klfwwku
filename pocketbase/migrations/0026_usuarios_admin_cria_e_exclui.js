migrate(
  (app) => {
    // A tela de Usuários (Configurações) precisa que o administrador consiga
    // criar e excluir usuários. A coleção nasceu com createRule vazia (ninguém
    // cria pela API) e deleteRule permitindo apenas a si mesmo.
    //
    // Nova regra:
    //  - criar: somente admin
    //  - excluir: o próprio usuário OU admin
    //  - atualizar: o próprio usuário OU admin (já era assim desde a 0018)
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.createRule = "@request.auth.id != '' && @request.auth.role = 'admin'"
    users.deleteRule = "id = @request.auth.id || @request.auth.role = 'admin'"
    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.createRule = ''
    users.deleteRule = 'id = @request.auth.id'
    app.save(users)
  },
)
