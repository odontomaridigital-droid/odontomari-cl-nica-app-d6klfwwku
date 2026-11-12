migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // ============ CAMPANHAS DE MARKETING ============
    // Registra cada ação de captação (Instagram, Google, indicação, panfleto...)
    // para cruzar investimento com pacientes que realmente chegaram.
    const campanhas = new Collection({
      name: 'campanhas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'nome', type: 'text', required: true },
        {
          name: 'canal',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: [
            'instagram',
            'facebook',
            'google',
            'whatsapp',
            'indicacao',
            'panfleto',
            'radio',
            'evento',
            'outro',
          ],
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['planejada', 'ativa', 'pausada', 'encerrada'],
        },
        { name: 'inicio', type: 'date' },
        { name: 'fim', type: 'date' },
        { name: 'investimento', type: 'number', min: 0 },
        { name: 'objetivo', type: 'text' },
        { name: 'publico', type: 'text' },
        { name: 'observacoes', type: 'text' },
        // UTM usado nos links, para casar com o que chega no formulário
        { name: 'utm', type: 'text' },
        { name: 'responsavel', type: 'relation', collectionId: users.id, maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_campanhas_status ON campanhas (status)',
        'CREATE INDEX idx_campanhas_canal ON campanhas (canal)',
      ],
    })
    app.save(campanhas)

    // ============ CONTEÚDOS (pauta compartilhada) ============
    // Lista de trabalho combinada com o produtor de conteúdo: o que foi pedido,
    // em que etapa está e o que já foi publicado.
    const conteudos = new Collection({
      name: 'conteudos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'titulo', type: 'text', required: true },
        {
          name: 'formato',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['reels', 'carrossel', 'post', 'story', 'video', 'blog', 'email', 'outro'],
        },
        {
          name: 'canal',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: [
            'instagram',
            'facebook',
            'tiktok',
            'youtube',
            'google',
            'whatsapp',
            'site',
            'outro',
          ],
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['ideia', 'roteiro', 'gravacao', 'edicao', 'aprovacao', 'agendado', 'publicado'],
        },
        { name: 'tema', type: 'text' },
        { name: 'publico_alvo', type: 'text' },
        { name: 'data_publicacao', type: 'date' },
        { name: 'link', type: 'text' },
        { name: 'observacoes', type: 'text' },
        { name: 'campanha', type: 'relation', collectionId: campanhas.id, maxSelect: 1 },
        { name: 'responsavel', type: 'relation', collectionId: users.id, maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_conteudos_status ON conteudos (status)',
        'CREATE INDEX idx_conteudos_data ON conteudos (data_publicacao)',
      ],
    })
    app.save(conteudos)

    // ============ ORIGEM: novas opções alinhadas aos canais de campanha ============
    // O campo origem dos pacientes já existe como texto livre; nada a migrar.
    // O cruzamento campanha x paciente é feito por nome de canal no app.
  },
  (app) => {
    for (const nome of ['conteudos', 'campanhas']) {
      try {
        app.delete(app.findCollectionByNameOrId(nome))
      } catch (_) {}
    }
  },
)
