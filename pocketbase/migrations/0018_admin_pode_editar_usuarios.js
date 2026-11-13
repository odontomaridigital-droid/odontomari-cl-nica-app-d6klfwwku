migrate(
  (app) => {
    // A coleção de usuários nasceu com updateRule "id = @request.auth.id":
    // cada um só edita o próprio registro. Isso impede o dentista (admin) de
    // corrigir o cadastro da recepção — que ficou sem e-mail e nunca conseguiria
    // recuperar a senha.
    //
    // Nova regra: o próprio usuário continua podendo se editar, e o admin também
    // pode editar qualquer usuário da clínica.
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.updateRule = "id = @request.auth.id || @request.auth.role = 'admin'"
    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.updateRule = 'id = @request.auth.id'
    app.save(users)
  },
)
