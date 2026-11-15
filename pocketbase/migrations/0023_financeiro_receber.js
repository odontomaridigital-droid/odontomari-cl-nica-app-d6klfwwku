migrate(
  (app) => {
    // ============ 1. MÁQUINAS (adquirentes) ============
    // Decisão do dono (2026-11-15): cadastrar a máquina e, por modalidade, o
    // prazo de repasse em dias. É a máquina que sabe quando o dinheiro cai,
    // então não se adivinha por venda.
    const maquinas = new Collection({
      name: 'maquinas',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'nome', type: 'text', required: true },
        { name: 'ativo', type: 'bool' },
        // Prazo de repasse em dias, por modalidade. 0 = mesmo dia.
        { name: 'dias_debito', type: 'number', onlyInt: true, min: 0, max: 365 },
        { name: 'dias_credito_vista', type: 'number', onlyInt: true, min: 0, max: 365 },
        { name: 'dias_credito_parcelado', type: 'number', onlyInt: true, min: 0, max: 365 },
        { name: 'dias_pix', type: 'number', onlyInt: true, min: 0, max: 365 },
        // Taxa em % descontada pela máquina, por modalidade.
        { name: 'taxa_debito', type: 'number', min: 0, max: 100 },
        { name: 'taxa_credito_vista', type: 'number', min: 0, max: 100 },
        { name: 'taxa_credito_parcelado', type: 'number', min: 0, max: 100 },
        { name: 'taxa_pix', type: 'number', min: 0, max: 100 },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_maquinas_nome ON maquinas (nome)'],
    })
    app.save(maquinas)

    // ============ 2. CONDIÇÕES DE PAGAMENTO ============
    // Condição = como o paciente paga (dinheiro, PIX, cartão, cheque).
    // Forma = o parcelamento dentro da condição.
    const condicoes = new Collection({
      name: 'condicoes_pagamento',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      updateRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      deleteRule: "@request.auth.id != '' && @request.auth.role = 'admin'",
      fields: [
        { name: 'nome', type: 'text', required: true },
        {
          name: 'tipo',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'cheque', 'boleto'],
        },
        // Só cartão usa máquina.
        {
          name: 'maquina',
          type: 'relation',
          collectionId: maquinas.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'permite_parcelamento', type: 'bool' },
        /** 0 = sem limite (a máquina limita) */
        { name: 'max_parcelas', type: 'number', onlyInt: true, min: 0, max: 48 },
        /**
         * Como o dinheiro entra no contas a receber:
         * um_lancamento  → cartão: cai tudo de uma vez na data do repasse
         * por_parcela    → uma conta por parcela, cada uma no seu vencimento
         * na_compensacao → cheque
         */
        {
          name: 'forma_lancamento',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['um_lancamento', 'por_parcela', 'na_compensacao'],
        },
        { name: 'ativo', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_condicoes_nome ON condicoes_pagamento (nome)'],
    })
    app.save(condicoes)

    // ============ 3. CONTAS A RECEBER ============
    // Um registro por parcela (fora cartão) ou um único no repasse (cartão).
    const contas = new Collection({
      name: 'contas_receber',
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
          collectionId: app.findCollectionByNameOrId('pacientes').id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'orcamento',
          type: 'relation',
          collectionId: app.findCollectionByNameOrId('orcamentos').id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'condicao',
          type: 'relation',
          collectionId: condicoes.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'maquina',
          type: 'relation',
          collectionId: maquinas.id,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'descricao', type: 'text' },
        /** Valor combinado (o que o paciente deve) */
        { name: 'valor', type: 'number', required: true },
        /** Valor que realmente cai (valor - taxa) */
        { name: 'valor_liquido', type: 'number' },
        { name: 'taxa_percentual', type: 'number' },
        { name: 'parcela', type: 'number', onlyInt: true, min: 1 },
        { name: 'total_parcelas', type: 'number', onlyInt: true, min: 1 },
        /** Data em que o dinheiro deve entrar (vencimento ou repasse) */
        { name: 'vencimento', type: 'date', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          maxSelect: 1,
          values: ['previsto', 'recebido', 'cancelado'],
        },
        { name: 'recebido_em', type: 'date' },
        { name: 'observacoes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_contas_vencimento ON contas_receber (vencimento)',
        'CREATE INDEX idx_contas_status ON contas_receber (status)',
        'CREATE INDEX idx_contas_paciente ON contas_receber (paciente)',
        'CREATE INDEX idx_contas_orcamento ON contas_receber (orcamento)',
      ],
    })
    app.save(contas)

    // ============ 4. Planejamento guarda como foi pago ============
    const orcamentos = app.findCollectionByNameOrId('orcamentos')
    if (!orcamentos.fields.getByName('condicao_pagamento')) {
      orcamentos.fields.add(
        new RelationField({
          name: 'condicao_pagamento',
          collectionId: condicoes.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }
    if (!orcamentos.fields.getByName('maquina')) {
      orcamentos.fields.add(
        new RelationField({
          name: 'maquina',
          collectionId: maquinas.id,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
    }
    if (!orcamentos.fields.getByName('num_parcelas')) {
      orcamentos.fields.add(
        new NumberField({ name: 'num_parcelas', onlyInt: true, min: 1, max: 48 }),
      )
    }
    app.save(orcamentos)

    // ============ 5. Semente ============
    // As duas máquinas que o dono informou (2026-11-15). Prazos e taxas são
    // valores de partida para ele ajustar na tela — não são dados de contrato.
    const maquinasSeed = [
      {
        nome: 'Mercado Pago',
        dias_debito: 1,
        dias_credito_vista: 30,
        dias_credito_parcelado: 30,
        dias_pix: 0,
      },
      {
        nome: 'Stone',
        dias_debito: 1,
        dias_credito_vista: 30,
        dias_credito_parcelado: 30,
        dias_pix: 0,
      },
    ]
    for (const m of maquinasSeed) {
      try {
        app.findFirstRecordByData('maquinas', 'nome', m.nome)
      } catch (_) {
        const rec = new Record(maquinas)
        rec.set('nome', m.nome)
        rec.set('ativo', true)
        rec.set('dias_debito', m.dias_debito)
        rec.set('dias_credito_vista', m.dias_credito_vista)
        rec.set('dias_credito_parcelado', m.dias_credito_parcelado)
        rec.set('dias_pix', m.dias_pix)
        app.save(rec)
      }
    }

    const condicoesSeed = [
      {
        nome: 'Dinheiro',
        tipo: 'dinheiro',
        forma_lancamento: 'um_lancamento',
        permite_parcelamento: false,
        max_parcelas: 1,
      },
      {
        nome: 'PIX',
        tipo: 'pix',
        forma_lancamento: 'um_lancamento',
        permite_parcelamento: false,
        max_parcelas: 1,
      },
      {
        nome: 'Cartão de crédito',
        tipo: 'cartao_credito',
        forma_lancamento: 'um_lancamento',
        permite_parcelamento: true,
        max_parcelas: 0,
      },
      {
        nome: 'Cartão de débito',
        tipo: 'cartao_debito',
        forma_lancamento: 'um_lancamento',
        permite_parcelamento: false,
        max_parcelas: 1,
      },
      {
        nome: 'Cheque',
        tipo: 'cheque',
        forma_lancamento: 'na_compensacao',
        permite_parcelamento: true,
        max_parcelas: 0,
      },
      {
        nome: 'Boleto',
        tipo: 'boleto',
        forma_lancamento: 'por_parcela',
        permite_parcelamento: true,
        max_parcelas: 0,
      },
    ]
    for (const c of condicoesSeed) {
      try {
        app.findFirstRecordByData('condicoes_pagamento', 'nome', c.nome)
      } catch (_) {
        const rec = new Record(condicoes)
        rec.set('nome', c.nome)
        rec.set('tipo', c.tipo)
        rec.set('forma_lancamento', c.forma_lancamento)
        rec.set('permite_parcelamento', c.permite_parcelamento)
        rec.set('max_parcelas', c.max_parcelas)
        rec.set('ativo', true)
        app.save(rec)
      }
    }
  },
  (app) => {
    try {
      const orcamentos = app.findCollectionByNameOrId('orcamentos')
      orcamentos.fields.removeByName('condicao_pagamento')
      orcamentos.fields.removeByName('maquina')
      orcamentos.fields.removeByName('num_parcelas')
      app.save(orcamentos)
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('contas_receber'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('condicoes_pagamento'))
    } catch (_) {}
    try {
      app.delete(app.findCollectionByNameOrId('maquinas'))
    } catch (_) {}
  },
)
