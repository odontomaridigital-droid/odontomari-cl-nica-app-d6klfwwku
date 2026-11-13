migrate(
  (app) => {
    // Ajusta o e-mail do usuário da recepção para odontomari@odontomari.com.br
    // (antes era recepcao@odontomari.com.br) e deixa o e-mail visível.
    //
    // Pela API REST a troca de e-mail de um registro de autenticação exige o
    // fluxo de confirmação em duas etapas; na migração basta gravar o registro.
    try {
      const rec = app.findAuthRecordByEmail('_pb_users_auth_', 'recepcao@odontomari.com.br')
      rec.setEmail('odontomari@odontomari.com.br')
      rec.set('emailVisibility', true)
      rec.setVerified(true)
      app.save(rec)
    } catch (_) {
      // Já migrado ou usuário não existe: tenta pelo e-mail novo para garantir
      // que o estado final fique correto.
      try {
        const rec = app.findAuthRecordByEmail('_pb_users_auth_', 'odontomari@odontomari.com.br')
        rec.set('emailVisibility', true)
        rec.setVerified(true)
        app.save(rec)
      } catch (_) {}
    }
  },
  (app) => {
    // down: volta ao e-mail anterior
    try {
      const rec = app.findAuthRecordByEmail('_pb_users_auth_', 'odontomari@odontomari.com.br')
      if (rec.get('role') === 'recepcao') {
        rec.setEmail('recepcao@odontomari.com.br')
        rec.set('emailVisibility', false)
        app.save(rec)
      }
    } catch (_) {}
  },
)
