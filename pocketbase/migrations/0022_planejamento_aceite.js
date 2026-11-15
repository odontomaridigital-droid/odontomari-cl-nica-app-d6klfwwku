migrate(
  (app) => {
    // Aceite e execução do planejamento.
    // Decisão do dono (2026-11-15): as situações são ABERTO → ACEITO → CONCLUÍDO,
    // e a recepção também pode marcar o aceite.
    const orcamentos = app.findCollectionByNameOrId('orcamentos')

    // `concluido` entra na lista. `recusado` continua existindo porque o botão
    // já está na tela e há paciente que recusa o orçamento — tirar isso seria
    // perder uma informação clínica real. 0 registros usam hoje.
    const campoStatus = orcamentos.fields.getByName('status')
    campoStatus.values = ['aberto', 'aceito', 'recusado', 'concluido']
    app.save(orcamentos)

    // Quem aceitou e quando. Sem isso não dá para saber se o aceite foi da
    // recepção ou do dentista, nem a data real do aceite.
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!orcamentos.fields.getByName('aceito_em')) {
      orcamentos.fields.add(new DateField({ name: 'aceito_em' }))
    }
    if (!orcamentos.fields.getByName('aceito_por')) {
      orcamentos.fields.add(
        new RelationField({
          name: 'aceito_por',
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }
    if (!orcamentos.fields.getByName('concluido_em')) {
      orcamentos.fields.add(new DateField({ name: 'concluido_em' }))
    }

    orcamentos.indexes = orcamentos.indexes.filter(
      (i) => !String(i).includes('idx_orcamentos_status'),
    )
    orcamentos.indexes = [
      ...orcamentos.indexes,
      'CREATE INDEX idx_orcamentos_status ON orcamentos (status)',
    ]
    app.save(orcamentos)
  },
  (app) => {
    try {
      const orcamentos = app.findCollectionByNameOrId('orcamentos')
      const campoStatus = orcamentos.fields.getByName('status')
      campoStatus.values = ['aberto', 'aceito', 'recusado']
      orcamentos.fields.removeByName('aceito_em')
      orcamentos.fields.removeByName('aceito_por')
      orcamentos.fields.removeByName('concluido_em')
      app.save(orcamentos)
    } catch (_) {}
  },
)
