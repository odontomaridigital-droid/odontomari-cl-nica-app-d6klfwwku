migrate(
  (app) => {
    // Troca o e-mail do usuário administrador de ja3dimpressoes3d@gmail.com
    // para mari@odontomari.com.br (pedido do dono em 2026-11-15).
    // Pela API REST a troca de e-mail de registro de autenticação exige o fluxo
    // de confirmação em duas etapas; na migração basta gravar o registro.
    try {
      const rec = app.findAuthRecordByEmail('_pb_users_auth_', 'ja3dimpressoes3d@gmail.com')
      rec.setEmail('mari@odontomari.com.br')
      rec.set('emailVisibility', true)
      rec.setVerified(true)
      app.save(rec)
    } catch (_) {
      // Já migrado: garante o estado final correto.
      try {
        const rec = app.findAuthRecordByEmail('_pb_users_auth_', 'mari@odontomari.com.br')
        rec.set('emailVisibility', true)
        rec.setVerified(true)
        app.save(rec)
      } catch (_) {}
    }
  },
  (app) => {
    // down: volta ao e-mail anterior
    try {
      const rec = app.findAuthRecordByEmail('_pb_users_auth_', 'mari@odontomari.com.br')
      if (rec.get('role') === 'admin') {
        rec.setEmail('ja3dimpressoes3d@gmail.com')
        rec.set('emailVisibility', false)
        app.save(rec)
      }
    } catch (_) {}
  },
)
