migrate(
  (app) => {
    const pacientesCol = app.findCollectionByNameOrId('pacientes')
    const tiposCol = app.findCollectionByNameOrId('tipos_atendimento')

    // 1. Consultas
    const consultas = new Collection({
      name: 'consultas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        {
          name: 'paciente',
          type: 'relation',
          required: true,
          collectionId: pacientesCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        {
          name: 'tipo_atendimento',
          type: 'relation',
          required: true,
          collectionId: tiposCol.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'data', type: 'date', required: true },
        { name: 'hora_inicio', type: 'text', required: true }, // HH:MM
        { name: 'duracao_minutos', type: 'number', required: true, min: 5, max: 480 },
        { name: 'hora_fim', type: 'text', required: true }, // HH:MM
        {
          name: 'status',
          type: 'select',
          values: ['agendada', 'confirmada', 'realizada', 'cancelada', 'faltou'],
          maxSelect: 1,
          required: true,
        },
        { name: 'observacoes', type: 'text' },
        { name: 'lembrete_enviado', type: 'bool' },
        { name: 'lembrete_data_envio', type: 'date' },
        { name: 'lembrete_enviado_por', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_consultas_data_hora ON consultas (data, hora_inicio)',
        'CREATE INDEX idx_consultas_paciente ON consultas (paciente)',
        'CREATE INDEX idx_consultas_status ON consultas (status)',
      ],
    })
    app.save(consultas)

    // 2. Prontuários (anotações e procedimentos - dentista / admin)
    const prontuarios = new Collection({
      name: 'prontuarios',
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
          name: 'consulta',
          type: 'relation',
          collectionId: consultas.id,
          cascadeDelete: false,
          maxSelect: 1,
        },
        { name: 'data', type: 'date', required: true },
        { name: 'procedimentos', type: 'text', required: true },
        { name: 'anotacoes', type: 'text' },
        { name: 'dente_regiao', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_prontuarios_paciente ON prontuarios (paciente)',
        'CREATE INDEX idx_prontuarios_data ON prontuarios (data)',
      ],
    })
    app.save(prontuarios)

    // 3. Orçamentos
    const orcamentos = new Collection({
      name: 'orcamentos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
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
        { name: 'data', type: 'date', required: true },
        {
          name: 'status',
          type: 'select',
          values: ['aberto', 'aceito', 'recusado'],
          maxSelect: 1,
          required: true,
        },
        { name: 'itens', type: 'json', required: true }, // [{ procedimento: string, valor: number, dente?: string }]
        { name: 'valor_total', type: 'number', min: 0 },
        { name: 'observacoes', type: 'text' },
        { name: 'validade_dias', type: 'number', min: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_orcamentos_paciente ON orcamentos (paciente)',
        'CREATE INDEX idx_orcamentos_status ON orcamentos (status)',
      ],
    })
    app.save(orcamentos)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('orcamentos'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('prontuarios'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('consultas'))
    } catch (_) {}
  },
)
