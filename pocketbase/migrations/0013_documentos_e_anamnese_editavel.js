migrate(
  (app) => {
    // ============ 1. MODELOS DE ANAMNESE EDITÁVEIS ============
    // O modelo embutido no código (anamneseModelo.ts) passa a ser apenas o
    // default: a dentista pode criar/editar modelos pela tela de Configurações.
    const anamnese_modelos = new Collection({
      name: 'anamnese_modelos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'descricao', type: 'text' },
        { name: 'ativo', type: 'bool' },
        { name: 'padrao', type: 'bool' },
        // Array JSON com as seções e questões (mesma forma de ANAMNESE_SECOES)
        { name: 'secoes', type: 'json', maxSize: 200000 },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_anamnese_modelos_ativo ON anamnese_modelos (ativo)'],
    })
    app.save(anamnese_modelos)

    // ============ 2. MODELOS DE DOCUMENTO ============
    const documentos_modelos = new Collection({
      name: 'documentos_modelos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'titulo', type: 'text', required: true },
        {
          name: 'categoria',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: [
            'pos_cirurgico',
            'pos_operatorio',
            'orientacao',
            'atestado',
            'declaracao',
            'termo',
            'outro',
          ],
        },
        // Texto com placeholders: {paciente} {primeiro_nome} {data} {clinica}
        // {dentista} {cro} {procedimento} {telefone}
        { name: 'corpo', type: 'text', required: true },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_documentos_modelos_cat ON documentos_modelos (categoria)'],
    })
    app.save(documentos_modelos)

    // ============ 3. DOCUMENTOS EMITIDOS ============
    // Guarda o texto final (já com os placeholders substituídos) para que o
    // documento continue fiel mesmo se o modelo for alterado depois.
    const pacientes = app.findCollectionByNameOrId('pacientes')
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    const documentos_emitidos = new Collection({
      name: 'documentos_emitidos',
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
        { name: 'modelo', type: 'relation', collectionId: documentos_modelos.id, maxSelect: 1 },
        { name: 'titulo', type: 'text', required: true },
        { name: 'categoria', type: 'text' },
        { name: 'corpo', type: 'text', required: true },
        { name: 'autor', type: 'relation', collectionId: users.id, maxSelect: 1 },
        { name: 'data', type: 'date', required: true },
        { name: 'enviado_em', type: 'date' },
        { name: 'enviado_canal', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_documentos_emitidos_paciente ON documentos_emitidos (paciente)',
        'CREATE INDEX idx_documentos_emitidos_data ON documentos_emitidos (data)',
      ],
    })
    app.save(documentos_emitidos)

    // ============ 4. SEED: modelos de documento essenciais ============
    const seedModelos = [
      {
        titulo: 'Cuidados pós-extração dentária',
        categoria: 'pos_cirurgico',
        corpo:
          'Olá, {primeiro_nome}!\n\nVocê realizou uma extração dentária em {data} na {clinica}. Siga estas orientações para uma boa recuperação:\n\n1. Mantenha a gaze mordida por 30 a 40 minutos após o procedimento.\n2. Não faça bochechos nem cuspa nas primeiras 24 horas.\n3. Não fume e não use canudo por 7 dias.\n4. Aplique gelo na face do lado operado, 15 minutos a cada 1 hora, nas primeiras 24 horas.\n5. Alimente-se de comidas frias e pastosas no primeiro dia. Evite alimentos quentes, duros e condimentados.\n6. Não faça esforço físico por 48 horas.\n7. Tome os medicamentos conforme a receita.\n8. Escove os dentes normalmente, evitando a área operada.\n\nÉ normal haver leve sangramento e inchaço nos primeiros dias.\n\nProcure a clínica imediatamente se tiver: dor intensa que não passa com o medicamento, febre, sangramento que não para, ou pus.\n\nQualquer dúvida, fale com a gente: {telefone}.\n\n{clinica}\n{dentista} — {cro}',
      },
      {
        titulo: 'Cuidados pós-cirurgia de implante',
        categoria: 'pos_cirurgico',
        corpo:
          'Olá, {primeiro_nome}!\n\nSua cirurgia de implante foi realizada em {data}. Os cuidados são parecidos com os de uma extração:\n\n1. Mantenha a gaze por 40 minutos.\n2. Nada de bochecho, cuspir ou canudo por 24 horas.\n3. Gelo na face nas primeiras 24 horas, 15 minutos a cada hora.\n4. Alimentação fria e pastosa no primeiro dia; depois, macia por uma semana.\n5. Não fume por, no mínimo, 7 dias — o cigarro prejudica a cicatrização e a fixação do implante.\n6. Não faça esforço físico por 72 horas.\n7. Tome a medicação conforme a receita, sem interromper antes do fim.\n8. Compareça ao retorno em 7 dias para avaliação e remoção de pontos.\n\nSinais de alerta: dor que piora a cada dia, febre, sangramento persistente ou secreção.\n\nQualquer dúvida: {telefone}.\n\n{clinica}\n{dentista} — {cro}',
      },
      {
        titulo: 'Orientações pós-tratamento de canal (endodontia)',
        categoria: 'pos_operatorio',
        corpo:
          'Olá, {primeiro_nome}!\n\nVocê realizou um tratamento de canal em {data}.\n\n1. É normal sentir sensibilidade ou leve desconforto por alguns dias, principalmente ao mastigar.\n2. Evite mastigar com o dente tratado até a restauração definitiva.\n3. Tome o analgésico conforme orientado, se houver dor.\n4. Não é esperado inchaço. Se aparecer, entre em contato.\n5. Mantenha a higiene normal no dente, com escova macia.\n6. Compareça ao retorno para a restauração definitiva.\n\nSinais de alerta: dor forte e crescente, inchaço na gengiva ou no rosto, febre.\n\nQualquer dúvida: {telefone}.\n\n{clinica}\n{dentista} — {cro}',
      },
      {
        titulo: 'Orientações pós-clareamento dental',
        categoria: 'pos_operatorio',
        corpo:
          'Olá, {primeiro_nome}!\n\nSeu clareamento foi realizado em {data}.\n\n1. Sensibilidade nos dentes é normal e passa em 24 a 48 horas.\n2. Nas primeiras 48 horas, evite alimentos e bebidas com cor: café, chá, refrigerante escuro, vinho, molho de tomate, açaí e beterraba.\n3. Não fume.\n4. Mantenha a escovação normal com pasta branca (sem cor).\n5. Use o dessensibilizante conforme orientado.\n\nA cor continua clareando por até 2 semanas após a sessão.\n\nQualquer dúvida: {telefone}.\n\n{clinica}\n{dentista} — {cro}',
      },
      {
        titulo: 'Atestado de comparecimento',
        categoria: 'atestado',
        corpo:
          'ATESTADO ODONTOLÓGICO\n\nAtesto, para os devidos fins, que o(a) paciente {paciente} compareceu a esta clínica em {data}, para atendimento odontológico, no período das ______ às ______ horas.\n\nProcedimento realizado: {procedimento}\n\n{clinica}\n{dentista} — {cro}',
      },
      {
        titulo: 'Declaração de comparecimento (acompanhante)',
        categoria: 'declaracao',
        corpo:
          'DECLARAÇÃO DE COMPARECIMENTO\n\nDeclaro que ______________________________ acompanhou o(a) paciente {paciente} nesta clínica em {data}, para atendimento odontológico, no período das ______ às ______ horas.\n\n{clinica}\n{dentista} — {cro}',
      },
      {
        titulo: 'Orientações gerais de higiene bucal',
        categoria: 'orientacao',
        corpo:
          'Olá, {primeiro_nome}!\n\nAlgumas orientações para manter sua saúde bucal em dia:\n\n1. Escove os dentes pelo menos 3 vezes ao dia, após as refeições principais.\n2. Use fio dental diariamente, antes de dormir.\n3. Troque a escova a cada 3 meses ou quando as cerdas estiverem gastas.\n4. Use pasta com flúor.\n5. Evite açúcar entre as refeições.\n6. Beba água ao longo do dia.\n7. Faça uma avaliação na clínica a cada 6 meses.\n\nEstamos à disposição: {telefone}.\n\n{clinica}\n{dentista} — {cro}',
      },
    ]

    for (const m of seedModelos) {
      try {
        app.findFirstRecordByData('documentos_modelos', 'titulo', m.titulo)
      } catch (_) {
        const rec = new Record(documentos_modelos)
        rec.set('titulo', m.titulo)
        rec.set('categoria', m.categoria)
        rec.set('corpo', m.corpo)
        rec.set('ativo', true)
        app.save(rec)
      }
    }
  },
  (app) => {
    // down
    for (const nome of ['documentos_emitidos', 'documentos_modelos', 'anamnese_modelos']) {
      try {
        app.delete(app.findCollectionByNameOrId(nome))
      } catch (_) {}
    }
  },
)
