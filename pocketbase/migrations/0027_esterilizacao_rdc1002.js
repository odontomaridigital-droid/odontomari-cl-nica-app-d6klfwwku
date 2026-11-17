migrate(
  (app) => {
    // ============================================================
    // MÓDULO DE CONFORMIDADE — RDC Anvisa 1002/2025 (núcleo)
    //
    // O que a norma exige e aqui vira estrutura:
    //  - art. 91: cada carga de esterilização registra data, lote (único),
    //    equipamento, resultado do pacote teste, relação de pacotes,
    //    operador e parâmetros físicos (tempo, temperatura, pressão).
    //  - art. 92: guarda por 5 anos.
    //  - art. 81: etiqueta com data, responsável, lote e conteúdo.
    //  - Monitoramento semanal (indicador biológico + integrador 5/6).
    // ============================================================

    // ---------- CARGAS DE ESTERILIZAÇÃO ----------
    const cargas = new Collection({
      name: 'esterilizacoes',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.role = 'admin'",
      fields: [
        { name: 'data', type: 'date', required: true },
        // Lote único (art. 91 §2º) — gerado pelo sistema no formato AAAAMMDD-NN
        { name: 'lote', type: 'text', required: true, max: 40 },
        { name: 'equipamento', type: 'text', max: 120 },
        { name: 'operador', type: 'text', max: 120, required: true },
        // Parâmetros físicos do ciclo a vapor
        { name: 'tempo_minutos', type: 'number', min: 0, max: 600 },
        { name: 'temperatura', type: 'number', min: 0, max: 200 },
        { name: 'pressao', type: 'number', min: 0, max: 10 },
        // Pacote teste (art. 91, IV)
        {
          name: 'pacote_teste_resultado',
          type: 'select',
          values: ['aprovado', 'reprovado', 'nao_realizado'],
        },
        {
          name: 'pacote_teste_tipo',
          type: 'select',
          values: ['biologico', 'integrador_5', 'integrador_6', 'bowie_dick', 'nenhum'],
        },
        { name: 'pacote_teste_obs', type: 'text', max: 500 },
        { name: 'observacoes', type: 'text', max: 1000 },
        { name: 'validade_dias', type: 'number', min: 0, max: 3650 },
        { name: 'criado_por', type: 'text', max: 120 },
      ],
      indexes: [
        'CREATE UNIQUE INDEX `idx_esterilizacoes_lote` ON `esterilizacoes` (`lote`)',
        'CREATE INDEX `idx_esterilizacoes_data` ON `esterilizacoes` (`data`)',
      ],
    })
    app.save(cargas)

    // id da collection de pacientes, para a relação do pacote
    const pacientesId = app.findCollectionByNameOrId('pacientes').id

    // ---------- PACOTES (um por envelope/caixa esterilizado) ----------
    const pacotes = new Collection({
      name: 'pacotes_esterilizados',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.role = 'admin'",
      fields: [
        {
          name: 'esterilizacao',
          type: 'relation',
          required: true,
          maxSelect: 1,
          collectionId: cargas.id,
          cascadeDelete: true,
        },
        // Conteúdo do pacote (art. 81, IV)
        { name: 'identificacao', type: 'text', required: true, max: 200 },
        // Datas calculadas na criação: data da esterilização + validade_dias
        { name: 'data_esterilizacao', type: 'date', required: true },
        { name: 'validade', type: 'date' },
        {
          name: 'status',
          type: 'select',
          values: ['disponivel', 'usado', 'descartado', 'vencido'],
          maxSelect: 1,
        },
        // Vínculo com o paciente (é isto que a fiscalização cobra)
        { name: 'paciente', type: 'relation', maxSelect: 1, collectionId: pacientesId },
        { name: 'usado_em', type: 'date' },
        { name: 'observacoes', type: 'text', max: 500 },
      ],
      indexes: [
        'CREATE INDEX `idx_pacotes_esterilizacao` ON `pacotes_esterilizados` (`esterilizacao`)',
        'CREATE INDEX `idx_pacotes_status` ON `pacotes_esterilizados` (`status`)',
        'CREATE INDEX `idx_pacotes_paciente` ON `pacotes_esterilizados` (`paciente`)',
      ],
    })
    app.save(pacotes)

    // ---------- MONITORAMENTO PERIÓDICO ----------
    // Semanal em autoclave até 60 L sem bomba de vácuo: biológico + integrador
    // tipo 5/6 no 1º ciclo, integrador 5/6 nas cargas seguintes.
    const monitoramentos = new Collection({
      name: 'monitoramentos_esterilizacao',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.role = 'admin'",
      fields: [
        { name: 'data', type: 'date', required: true },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          values: ['biologico', 'integrador_5', 'integrador_6', 'bowie_dick'],
          maxSelect: 1,
        },
        {
          name: 'resultado',
          type: 'select',
          required: true,
          values: ['aprovado', 'reprovado'],
          maxSelect: 1,
        },
        { name: 'equipamento', type: 'text', max: 120 },
        { name: 'lote_carga', type: 'text', max: 40 },
        { name: 'operador', type: 'text', max: 120 },
        { name: 'observacoes', type: 'text', max: 500 },
      ],
      indexes: [
        'CREATE INDEX `idx_monitoramentos_data` ON `monitoramentos_esterilizacao` (`data`)',
      ],
    })
    app.save(monitoramentos)
  },
  (app) => {
    // down: apaga na ordem inversa por causa da relação
    try {
      app.delete(app.findCollectionByNameOrId('monitoramentos_esterilizacao'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('pacotes_esterilizados'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('esterilizacoes'))
    } catch (_) {}
  },
)
