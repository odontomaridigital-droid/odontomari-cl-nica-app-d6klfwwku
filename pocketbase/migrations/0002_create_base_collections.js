migrate(
  (app) => {
    // 1. Tipos de Atendimento (servicos)
    const tiposAtendimento = new Collection({
      name: 'tipos_atendimento',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'nome', type: 'text', required: true },
        {
          name: 'duracao_minutos',
          type: 'number',
          required: true,
          min: 5,
          max: 480,
          onlyInt: true,
        },
        { name: 'valor_padrao', type: 'number', min: 0 },
        { name: 'descricao', type: 'text' },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_tipos_atendimento_nome ON tipos_atendimento (nome)'],
    })
    app.save(tiposAtendimento)

    // 2. Pacientes
    const pacientes = new Collection({
      name: 'pacientes',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'telefone', type: 'text', required: true },
        { name: 'email', type: 'email' },
        { name: 'data_nascimento', type: 'date' },
        { name: 'cpf', type: 'text' },
        { name: 'endereco', type: 'text' },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_pacientes_nome ON pacientes (nome)',
        'CREATE INDEX idx_pacientes_telefone ON pacientes (telefone)',
      ],
    })
    app.save(pacientes)

    // 3. Configurações da clínica
    const configuracoes = new Collection({
      name: 'configuracoes',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'chave', type: 'text', required: true },
        { name: 'valor', type: 'json' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_configuracoes_chave ON configuracoes (chave)'],
    })
    app.save(configuracoes)

    // 4. Bloqueios de agenda
    const bloqueiosAgenda = new Collection({
      name: 'bloqueios_agenda',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != ''",
      fields: [
        { name: 'data', type: 'date', required: true },
        { name: 'dia_inteiro', type: 'bool' },
        { name: 'hora_inicio', type: 'text' }, // HH:MM
        { name: 'hora_fim', type: 'text' }, // HH:MM
        { name: 'motivo', type: 'text' },
        { name: 'tipo', type: 'select', values: ['bloqueio', 'desbloqueio_fds'], maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_bloqueios_data ON bloqueios_agenda (data)'],
    })
    app.save(bloqueiosAgenda)
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('bloqueios_agenda'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('configuracoes'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('pacientes'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('tipos_atendimento'))
    } catch (_) {}
  },
)
