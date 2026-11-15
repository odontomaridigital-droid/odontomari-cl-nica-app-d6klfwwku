migrate(
  (app) => {
    // Catálogo de PROCEDIMENTOS CLÍNICOS — o que se faz e se cobra (coroa,
    // implante, endodontia). É diferente de `tipos_atendimento`, que serve para
    // abrir horário na agenda (avaliação, retorno, urgência).
    //
    // Decisão do dono (2026-11-14): são dois catálogos, não um.
    const procedimentos = new Collection({
      name: 'procedimentos',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'nome', type: 'text', required: true },
        {
          name: 'categoria',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: [
            'diagnostico',
            'preventivo',
            'restaurador',
            'endodontia',
            'periodontia',
            'cirurgia',
            'implante',
            'protese',
            'estetica',
            'harmonizacao',
            'outro',
          ],
        },
        { name: 'valor', type: 'number', onlyInt: true },
        { name: 'codigo', type: 'text' },
        { name: 'observacoes', type: 'text' },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE UNIQUE INDEX idx_procedimentos_nome ON procedimentos (nome)',
        'CREATE INDEX idx_procedimentos_cat ON procedimentos (categoria)',
        'CREATE INDEX idx_procedimentos_ativo ON procedimentos (ativo)',
      ],
    })
    app.save(procedimentos)

    // Semente: os 100 procedimentos que já aparecem nos orçamentos importados
    // do Dentista Organizado. O valor é a MEDIANA praticada no histórico da
    // clínica, arredondada para múltiplo de 5 — não é preço inventado.
    const seed = [
      { nome: 'Planejamento digital', categoria: 'diagnostico', valor: 750 },
      { nome: 'Sedação Óxido Nitroso', categoria: 'diagnostico', valor: 1250 },
      { nome: 'Enceramento e Mockup 06 dentes', categoria: 'diagnostico', valor: 660 },
      { nome: 'Enceramento e Mockup 08 dentes', categoria: 'diagnostico', valor: 850 },
      { nome: 'Profilaxia - Limpeza RPCR', categoria: 'preventivo', valor: 250 },
      { nome: 'Restauração de resina Grande', categoria: 'restaurador', valor: 330 },
      { nome: 'Restauração de resina Média', categoria: 'restaurador', valor: 210 },
      { nome: 'Restauração de resina Pequena', categoria: 'restaurador', valor: 180 },
      { nome: 'Restauração com ionômero de vidro', categoria: 'restaurador', valor: 70 },
      { nome: 'Tratamento Endodôntico - Multirradicular', categoria: 'endodontia', valor: 950 },
      { nome: 'Tratamento Endodôntico - Birradicular', categoria: 'endodontia', valor: 850 },
      { nome: 'Retratamento endodôntico molares', categoria: 'endodontia', valor: 1150 },
      { nome: 'Tratamento Endodôntico - Unirradicular', categoria: 'endodontia', valor: 850 },
      { nome: 'Retratamento endodôntico incisivo e canino', categoria: 'endodontia', valor: 850 },
      { nome: 'Retratamento endodôntico pré-molar', categoria: 'endodontia', valor: 950 },
      { nome: 'Curativo', categoria: 'endodontia', valor: 70 },
      { nome: 'Urgência- abertura coronária', categoria: 'endodontia', valor: 280 },
      { nome: 'Endodontia monoradicular e biradicular', categoria: 'endodontia', valor: 820 },
      { nome: 'Placa Miorrelaxante em Resina Flex', categoria: 'periodontia', valor: 950 },
      { nome: 'Placa Miorrelaxante em Resina', categoria: 'periodontia', valor: 650 },
      { nome: 'Raspagem/Desinfecção Radicular', categoria: 'periodontia', valor: 625 },
      { nome: 'Contenção inferior', categoria: 'periodontia', valor: 35 },
      { nome: 'Gengivectomia Por Dente', categoria: 'periodontia', valor: 380 },
      { nome: 'Exodontia simples', categoria: 'cirurgia', valor: 250 },
      { nome: 'Exodontia Siso superior', categoria: 'cirurgia', valor: 450 },
      { nome: 'Exodontia Siso inferior', categoria: 'cirurgia', valor: 450 },
      { nome: 'Exodontia siso inferior incluso/impactado', categoria: 'cirurgia', valor: 650 },
      { nome: 'Frenectomia', categoria: 'cirurgia', valor: 1100 },
      { nome: 'Instalação de Implante Cone Morse', categoria: 'implante', valor: 1650 },
      { nome: 'Coroa Total Porcelana sobre Implante', categoria: 'implante', valor: 1750 },
      { nome: 'Membrana removível de PTFE', categoria: 'implante', valor: 280 },
      { nome: 'Enxerto Ósseo - Biomaterial Nacional', categoria: 'implante', valor: 850 },
      { nome: 'Coroa Total sobre Implante - Cerômero', categoria: 'implante', valor: 1350 },
      { nome: 'Coroa Provisória sobre Implante', categoria: 'implante', valor: 455 },
      { nome: 'Enxerto Ósseo - Biomaterial Importado', categoria: 'implante', valor: 1650 },
      { nome: 'Instalação Implante Importado - Straumann', categoria: 'implante', valor: 2600 },
      { nome: 'Remoção de Implante', categoria: 'implante', valor: 380 },
      {
        nome: 'Levantamento de Seio com Enxerto Ósseo Liofilizado',
        categoria: 'implante',
        valor: 2850,
      },
      { nome: 'Membrana PRF e L-PRF', categoria: 'implante', valor: 580 },
      { nome: 'Membrana Absorvível de Colágeno', categoria: 'implante', valor: 480 },
      { nome: 'Parafuso tenda de fixação', categoria: 'implante', valor: 520 },
      { nome: 'Prótese Provisória Sobre Implantes', categoria: 'implante', valor: 605 },
      { nome: 'Malha de Titânio - recobrimento enxerto ósseo', categoria: 'implante', valor: 790 },
      { nome: 'Troca de parafuso 1,2 - Prótese sobre Implante', categoria: 'implante', valor: 100 },
      { nome: 'Cirurgia - Enxertia/Reconstrução Óssea', categoria: 'implante', valor: 2500 },
      { nome: 'Planejamento - Cirurgia Guiada', categoria: 'implante', valor: 650 },
      {
        nome: 'Remoção de implante com enxerto ósseo importado',
        categoria: 'implante',
        valor: 1850,
      },
      { nome: 'Membrana PTFE com reforço de Titânio', categoria: 'implante', valor: 1780 },
      { nome: 'Enxerto Ósseo Liofilizado com Colágeno', categoria: 'implante', valor: 700 },
      { nome: 'Prótese Protocolo Inferior Straumann', categoria: 'implante', valor: 8500 },
      { nome: 'Pino de fibra', categoria: 'protese', valor: 280 },
      { nome: 'Coroa em Cerômero', categoria: 'protese', valor: 1250 },
      { nome: 'Coroa Total de Porcelana - Metal Free', categoria: 'protese', valor: 1650 },
      { nome: 'Provisório com aletas proximais', categoria: 'protese', valor: 280 },
      { nome: 'Coroa Provisória', categoria: 'protese', valor: 355 },
      { nome: 'Onlay de Cerômero', categoria: 'protese', valor: 850 },
      { nome: 'Prótese Parcial Removível com Grampos', categoria: 'protese', valor: 1850 },
      {
        nome: 'Prótese total caracterizada (dentes importados)',
        categoria: 'protese',
        valor: 1650,
      },
      { nome: 'PPR dentes importados', categoria: 'protese', valor: 1800 },
      {
        nome: 'Prótese Parcial Removível Flexível - Provisória',
        categoria: 'protese',
        valor: 1100,
      },
      { nome: 'Limpeza e Polimento - Prótese Protocolo', categoria: 'protese', valor: 250 },
      { nome: 'Remoção de pino intracanal', categoria: 'protese', valor: 300 },
      { nome: 'Remoção de prótese fixa', categoria: 'protese', valor: 320 },
      { nome: 'Prótese Overdenture', categoria: 'protese', valor: 2650 },
      { nome: 'Prótese Protocolo - Dentes Importados', categoria: 'protese', valor: 8000 },
      { nome: 'Conserto na prótese (protocolo)', categoria: 'protese', valor: 450 },
      { nome: 'Protocolo Imediato - Tardio Mandíbula', categoria: 'protese', valor: 14600 },
      { nome: 'Conserto Prótese Total', categoria: 'protese', valor: 240 },
      { nome: 'Manutenção e Polimento - Facetas em Resina', categoria: 'protese', valor: 250 },
      { nome: 'Cimentação provisório', categoria: 'protese', valor: 80 },
      {
        nome: 'Substituição Parafuso MP 1,2 - Prótese Protocolo',
        categoria: 'protese',
        valor: 150,
      },
      { nome: 'Núcleo de Metal Fundido', categoria: 'protese', valor: 250 },
      { nome: 'Protocolo Imediato - Tardio Maxila', categoria: 'protese', valor: 14600 },
      { nome: 'Reembasamento prótese', categoria: 'protese', valor: 160 },
      { nome: 'Protocolo Inferior - Imediato/Tardio', categoria: 'protese', valor: 14150 },
      {
        nome: 'Prótese parcial provisória com grampos dobráveis',
        categoria: 'protese',
        valor: 515,
      },
      { nome: 'Protocolo Superior - Imediato/Tardio', categoria: 'protese', valor: 14150 },
      { nome: 'Troca/Substituição Cápsula/Oring', categoria: 'protese', valor: 280 },
      { nome: 'Troca/Substituição Oring', categoria: 'protese', valor: 680 },
      { nome: 'Prótese total dentes importados', categoria: 'protese', valor: 1650 },
      { nome: 'Cimentação Coroa', categoria: 'protese', valor: 80 },
      {
        nome: 'Prótese removível estética (flexível mista com ppr)',
        categoria: 'protese',
        valor: 800,
      },
      { nome: 'Prótese Total Provisória', categoria: 'protese', valor: 850 },
      { nome: 'Prótese Protocolo Inferior Neodent', categoria: 'protese', valor: 8000 },
      { nome: 'Prótese Protocolo Superior Neodent', categoria: 'protese', valor: 11550 },
      { nome: 'Aumento de coroa', categoria: 'protese', valor: 1450 },
      { nome: 'PPR Provisória sem grampos', categoria: 'protese', valor: 450 },
      { nome: 'Faceta de resina', categoria: 'estetica', valor: 950 },
      { nome: 'Reabilitação Estética - Facetas em Resina', categoria: 'estetica', valor: 3500 },
      { nome: 'Faceta de porcelana', categoria: 'estetica', valor: 1650 },
      { nome: 'Clareamento de Consultório - Luz Ultravioleta', categoria: 'estetica', valor: 1350 },
      { nome: 'Clareamento Caseiro', categoria: 'estetica', valor: 700 },
      { nome: 'Reabilitação Estética - Facetas em Porcelana', categoria: 'estetica', valor: 35000 },
      {
        nome: 'Reabilitação Estética - Facetas em Resina Cerâmica',
        categoria: 'estetica',
        valor: 18900,
      },
      { nome: 'Fechamento de diastema (2 dentes)', categoria: 'estetica', valor: 700 },
      { nome: 'Toxina Botulínica - Terço Superior Face', categoria: 'estetica', valor: 1250 },
      { nome: 'Clareamento Caseiro 16 porcento', categoria: 'estetica', valor: 650 },
      { nome: 'Preenchimento Labial - Ácido Hialurônico', categoria: 'harmonizacao', valor: 1300 },
      { nome: 'Preenchimento - Sulco Nasogeniano', categoria: 'harmonizacao', valor: 1350 },
      { nome: 'Preenchedor - Adicional', categoria: 'harmonizacao', valor: 1500 },
    ]

    for (const s of seed) {
      try {
        app.findFirstRecordByData('procedimentos', 'nome', s.nome)
      } catch (_) {
        const rec = new Record(procedimentos)
        rec.set('nome', s.nome)
        rec.set('categoria', s.categoria)
        rec.set('valor', s.valor)
        rec.set('ativo', true)
        app.save(rec)
      }
    }

    // `tipos_atendimento` é agenda, não preço: tira o valor de referência.
    // O valor do atendimento vem do procedimento que foi feito.
    try {
      const tipos = app.findCollectionByNameOrId('tipos_atendimento')
      const campo = tipos.fields.getByName('valor_padrao')
      if (campo) tipos.fields.removeById(campo.id)
      app.save(tipos)
    } catch (_) {}
  },
  (app) => {
    try {
      app.delete(app.findCollectionByNameOrId('procedimentos'))
    } catch (_) {}
    try {
      const tipos = app.findCollectionByNameOrId('tipos_atendimento')
      if (!tipos.fields.getByName('valor_padrao')) {
        tipos.fields.add(new NumberField({ name: 'valor_padrao', onlyInt: true }))
        app.save(tipos)
      }
    } catch (_) {}
  },
)
