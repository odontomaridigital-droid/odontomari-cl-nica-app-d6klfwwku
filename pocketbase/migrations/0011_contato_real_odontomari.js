migrate(
  (app) => {
    // Atualiza os dados de contato da clínica para os números reais da Odontomari.
    // WhatsApp/celular: (19) 97171-4344  |  Fixo: (19) 3406-4344
    const configsCol = app.findCollectionByNameOrId('configuracoes')

    const atualizacoes = [
      { chave: 'telefone_clinica', valor: JSON.stringify('(19) 97171-4344') },
      { chave: 'whatsapp_clinica', valor: JSON.stringify('5519971714344') },
      { chave: 'telefone_fixo_clinica', valor: JSON.stringify('(19) 3406-4344') },
    ]

    for (const cfg of atualizacoes) {
      try {
        const rec = app.findFirstRecordByData('configuracoes', 'chave', cfg.chave)
        rec.set('valor', cfg.valor)
        app.save(rec)
      } catch (_) {
        const rec = new Record(configsCol)
        rec.set('chave', cfg.chave)
        rec.set('valor', cfg.valor)
        app.save(rec)
      }
    }
  },
  (app) => {
    // down: restaura o telefone de demonstração anterior
    try {
      const rec = app.findFirstRecordByData('configuracoes', 'chave', 'telefone_clinica')
      rec.set('valor', JSON.stringify('(11) 98765-4321'))
      app.save(rec)
    } catch (_) {}
  },
)
