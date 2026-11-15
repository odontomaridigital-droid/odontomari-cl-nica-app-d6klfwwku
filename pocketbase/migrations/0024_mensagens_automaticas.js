migrate(
  (app) => {
    // ============ 1. MENSAGENS AUTOMÁTICAS ============
    // Decisão do dono (2026-11-15): a mensagem de aniversário NÃO é uma por ano.
    // É um cadastro de mensagens que ele edita quando quiser; uma fica ativa e
    // as outras ficam guardadas para trocar depois.
    const pacientes = app.findCollectionByNameOrId('pacientes')
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    const mensagens = new Collection({
      name: 'mensagens_automaticas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'nome', type: 'text', required: true },
        {
          name: 'finalidade',
          type: 'select',
          required: true,
          maxSelect: 1,
          // Aniversário hoje; as outras ficam prontas para quando ele quiser.
          values: ['aniversario', 'retorno', 'pos_operatorio', 'outro'],
        },
        { name: 'texto', type: 'text', required: true },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_mensagens_nome ON mensagens_automaticas (nome)'],
    })
    app.save(mensagens)

    // ============ 2. REGISTRO DE ENVIOS ============
    // Guarda quem já recebeu e quem ainda não. Um envio por paciente + mensagem
    // + ano: no ano seguinte a pessoa volta a aparecer como pendente.
    const envios = new Collection({
      name: 'envios_mensagem',
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
          collectionId: pacientes.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'mensagem',
          type: 'relation',
          collectionId: mensagens.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'finalidade',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['aniversario', 'retorno', 'pos_operatorio', 'outro'],
        },
        /** Ano de referência: impede contar duas vezes no mesmo ano */
        { name: 'ano_referencia', type: 'number', required: true, onlyInt: true },
        /**
         * whatsapp_manual → a recepção clicou e enviou pelo WhatsApp comum
         * whatsapp_api    → enviado pela API oficial
         */
        {
          name: 'canal',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['whatsapp_manual', 'whatsapp_api'],
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['enviado', 'falhou'],
        },
        { name: 'enviado_em', type: 'date' },
        {
          name: 'enviado_por',
          type: 'relation',
          collectionId: users.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_envios_pessoa_mensagem_ano ON envios_mensagem (paciente, mensagem, ano_referencia)',
        'CREATE INDEX idx_envios_finalidade_ano ON envios_mensagem (finalidade, ano_referencia)',
        'CREATE INDEX idx_envios_paciente ON envios_mensagem (paciente)',
      ],
    })
    app.save(envios)

    // ============ 3. Semente ============
    // Uma mensagem de aniversário ativa, editável. O dono troca o texto quando
    // quiser, sem cadastrar uma nova por ano.
    try {
      app.findFirstRecordByData('mensagens_automaticas', 'nome', 'Parabéns padrão')
    } catch (_) {
      const rec = new Record(mensagens)
      rec.set('nome', 'Parabéns padrão')
      rec.set('finalidade', 'aniversario')
      rec.set(
        'texto',
        'Olá {primeiro_nome}! A equipe da {clinica} deseja um feliz aniversário, com muita saúde e motivos para sorrir. Parabéns! 🎉',
      )
      rec.set('ativo', true)
      app.save(rec)
    }
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('envios_mensagem'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('mensagens_automaticas'))
    } catch (_) {}
  },
)
