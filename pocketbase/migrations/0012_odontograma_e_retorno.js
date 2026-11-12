migrate(
  (app) => {
    // ============ 1. ODONTOGRAMA ============
    // Estado atual de cada dente do paciente. Um registro por dente (upsert),
    // mantendo o histórico de alterações no log de auditoria.
    const pacientes = app.findCollectionByNameOrId('pacientes')
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    const odontograma = new Collection({
      name: 'odontograma',
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
          collectionId: pacientes.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'dente', type: 'number', required: true, onlyInt: true, min: 11, max: 48 },
        {
          name: 'condicao',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: [
            'higido',
            'carie',
            'restaurado',
            'tratamento_endodontico',
            'coroa',
            'implante',
            'protese',
            'fratura',
            'ausente',
            'extrair',
            'selante',
            'em_tratamento',
          ],
        },
        {
          name: 'faces',
          type: 'select',
          maxSelect: 5,
          values: ['oclusal', 'mesial', 'distal', 'vestibular', 'lingual'],
        },
        { name: 'observacao', type: 'text' },
        { name: 'registrado_por', type: 'relation', collectionId: users.id, maxSelect: 1 },
        { name: 'data', type: 'date', required: true },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_odontograma_paciente_dente ON odontograma (paciente, dente)',
      ],
    })
    app.save(odontograma)

    // ============ 2. RETORNO POR PROCEDIMENTO ============
    // retorno_dias: prazo clínico definido no atendimento.
    // retorno_data: calculada (data + retorno_dias) para consulta rápida na lista.
    const prontuarios = app.findCollectionByNameOrId('prontuarios')
    prontuarios.fields.add(
      new NumberField({ name: 'retorno_dias', min: 0, max: 3650, onlyInt: true }),
    )
    prontuarios.fields.add(new DateField({ name: 'retorno_data' }))
    prontuarios.fields.add(new BoolField({ name: 'retorno_cumprido' }))
    prontuarios.indexes = [
      ...prontuarios.indexes,
      'CREATE INDEX idx_prontuarios_retorno ON prontuarios (retorno_data)',
    ]
    app.save(prontuarios)

    // ============ 3. TIPOS DE ATENDIMENTO — retorno padrão ============
    // Permite ao dentista definir, por procedimento, quantos dias de retorno sugerir.
    const tipos = app.findCollectionByNameOrId('tipos_atendimento')
    tipos.fields.add(
      new NumberField({ name: 'retorno_dias_padrao', min: 0, max: 3650, onlyInt: true }),
    )
    app.save(tipos)
  },
  (app) => {
    // down
    try {
      const odontograma = app.findCollectionByNameOrId('odontograma')
      app.delete(odontograma)
    } catch (_) {}
    try {
      const prontuarios = app.findCollectionByNameOrId('prontuarios')
      prontuarios.fields.removeByName('retorno_dias')
      prontuarios.fields.removeByName('retorno_data')
      prontuarios.fields.removeByName('retorno_cumprido')
      app.save(prontuarios)
    } catch (_) {}
    try {
      const tipos = app.findCollectionByNameOrId('tipos_atendimento')
      tipos.fields.removeByName('retorno_dias_padrao')
      app.save(tipos)
    } catch (_) {}
  },
)
