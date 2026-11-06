migrate(
  (app) => {
    const pacientesCol = app.findCollectionByNameOrId('pacientes')

    // Anamneses: escrita apenas pelo administrador (dentista), leitura para todos os autenticados
    const anamneses = new Collection({
      name: 'anamneses',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        {
          name: 'paciente',
          type: 'relation',
          required: true,
          collectionId: pacientesCol.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'autor',
          type: 'relation',
          collectionId: '_pb_users_auth_',
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'modelo', type: 'text' },
        { name: 'respostas', type: 'json', required: true }, // { [questaoId]: { resposta, detalhe } }
        { name: 'data', type: 'date', required: true }, // data de preenchimento
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_anamneses_paciente ON anamneses (paciente)',
        'CREATE INDEX idx_anamneses_data ON anamneses (data)',
      ],
    })
    app.save(anamneses)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('anamneses'))
    } catch (_) {}
  },
)
