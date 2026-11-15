migrate(
  (app) => {
    // Odontograma passa a pertencer ao PLANEJAMENTO, não ao paciente.
    // Decisão do dono (2026-11-15): cada planejamento tem o seu odontograma,
    // e ele NÃO é obrigatório. Um paciente que volta depois de um ano recebe
    // um planejamento novo, com odontograma novo.
    const odontograma = app.findCollectionByNameOrId('odontograma')
    const orcamentos = app.findCollectionByNameOrId('orcamentos')

    // Adiciona a ligação com o planejamento. Fica OPCIONAL para não quebrar
    // registros antigos (hoje a coleção está vazia, mas a regra vale).
    if (!odontograma.fields.getByName('orcamento')) {
      odontograma.fields.add(
        new RelationField({
          name: 'orcamento',
          collectionId: orcamentos.id,
          maxSelect: 1,
          cascadeDelete: true,
        }),
      )
    }

    // A trava passa a ser planejamento + dente. O mesmo dente pode ter estado
    // diferente em planejamentos diferentes — é justamente o que o dono pediu.
    odontograma.indexes = odontograma.indexes.filter(
      (i) => !String(i).includes('idx_odontograma_paciente_dente'),
    )
    odontograma.indexes = [
      ...odontograma.indexes,
      'CREATE UNIQUE INDEX idx_odontograma_orcamento_dente ON odontograma (orcamento, dente)',
      'CREATE INDEX idx_odontograma_paciente ON odontograma (paciente)',
    ]
    app.save(odontograma)

    // `paciente` deixa de ser obrigatório: o dono do registro passa a ser o
    // planejamento. Mantido como campo para consulta rápida e histórico.
    const campoPaciente = odontograma.fields.getByName('paciente')
    if (campoPaciente) {
      campoPaciente.required = false
      app.save(odontograma)
    }
  },
  (app) => {
    try {
      const odontograma = app.findCollectionByNameOrId('odontograma')
      odontograma.indexes = odontograma.indexes.filter(
        (i) => !String(i).includes('idx_odontograma_orcamento_dente'),
      )
      odontograma.indexes = [
        ...odontograma.indexes,
        'CREATE UNIQUE INDEX idx_odontograma_paciente_dente ON odontograma (paciente, dente)',
      ]
      odontograma.fields.removeByName('orcamento')
      app.save(odontograma)
    } catch (_) {}
  },
)
