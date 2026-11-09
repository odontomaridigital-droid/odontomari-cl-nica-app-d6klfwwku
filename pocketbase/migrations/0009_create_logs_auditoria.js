migrate(
  (app) => {
    // Idempotente: pular se a coleção já existir
    try {
      app.findCollectionByNameOrId('logs_auditoria')
      return
    } catch (_) {}

    const collection = new Collection({
      name: 'logs_auditoria',
      type: 'base',
      // Leitura restrita ao administrador (a recepção não vê os logs)
      listRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      viewRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      // Criação: qualquer usuário autenticado (os serviços gravam com o token do usuário logado)
      createRule: "@request.auth.id != ''",
      // Log é imutável para clientes: sem update/delete via API
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'usuario_id', type: 'text', required: true },
        { name: 'usuario_nome', type: 'text', required: true },
        {
          name: 'papel',
          type: 'select',
          required: true,
          values: ['admin', 'recepcao'],
          maxSelect: 1,
        },
        {
          name: 'acao',
          type: 'select',
          required: true,
          values: ['criou', 'editou', 'excluiu', 'login'],
          maxSelect: 1,
        },
        {
          name: 'entidade',
          type: 'select',
          required: true,
          values: [
            'paciente',
            'consulta',
            'planejamento',
            'receita',
            'anamnese',
            'medicamento',
            'tipo_atendimento',
            'configuracoes',
            'bloqueio',
          ],
          maxSelect: 1,
        },
        { name: 'registro_id', type: 'text' },
        { name: 'descricao', type: 'text', required: true, maxSize: 2000 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_logs_auditoria_created ON logs_auditoria (created DESC)'],
    })
    app.save(collection)
  },
  (app) => {
    try {
      const collection = app.findCollectionByNameOrId('logs_auditoria')
      app.delete(collection)
    } catch (_) {}
  },
)
