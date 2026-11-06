migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')

    // 1. Seed admin user (ja3dimpressoes3d@gmail.com)
    try {
      const adminUser = app.findAuthRecordByEmail('_pb_users_auth_', 'ja3dimpressoes3d@gmail.com')
      adminUser.set('role', 'admin')
      adminUser.set('name', 'Dr. Odontomari (Admin)')
      app.save(adminUser)
    } catch (_) {
      const adminRecord = new Record(users)
      adminRecord.setEmail('ja3dimpressoes3d@gmail.com')
      adminRecord.setPassword('Skip@Pass')
      adminRecord.setVerified(true)
      adminRecord.set('name', 'Dr. Odontomari (Admin)')
      adminRecord.set('role', 'admin')
      app.save(adminRecord)
    }

    // 2. Seed recepcao user (recepcao@odontomari.com.br)
    try {
      app.findAuthRecordByEmail('_pb_users_auth_', 'recepcao@odontomari.com.br')
    } catch (_) {
      const recRecord = new Record(users)
      recRecord.setEmail('recepcao@odontomari.com.br')
      recRecord.setPassword('Skip@Pass')
      recRecord.setVerified(true)
      recRecord.set('name', 'Recepção Odontomari')
      recRecord.set('role', 'recepcao')
      app.save(recRecord)
    }

    // 3. Seed configuracoes (horario_inicio, horario_fim, etc.)
    const configsCol = app.findCollectionByNameOrId('configuracoes')
    const initialConfigs = [
      { chave: 'horario_inicio', valor: JSON.stringify('08:00') },
      { chave: 'horario_fim', valor: JSON.stringify('18:00') },
      { chave: 'intervalo_minutos', valor: JSON.stringify(30) },
      { chave: 'bloquear_fins_de_semana', valor: JSON.stringify(true) },
      { chave: 'nome_clinica', valor: JSON.stringify('Clínica Odontomari') },
      { chave: 'telefone_clinica', valor: JSON.stringify('(11) 98765-4321') },
      {
        chave: 'mensagem_lembrete_padrao',
        valor: JSON.stringify(
          'Olá {paciente}, confirmamos sua consulta odontológica na Clínica Odontomari no dia {data} às {hora}. Para confirmar ou remarcar, por favor responda esta mensagem.',
        ),
      },
    ]

    for (const cfg of initialConfigs) {
      try {
        app.findFirstRecordByData('configuracoes', 'chave', cfg.chave)
      } catch (_) {
        const rec = new Record(configsCol)
        rec.set('chave', cfg.chave)
        rec.set('valor', cfg.valor)
        app.save(rec)
      }
    }

    // 4. Seed tipos de atendimento essenciais
    const tiposCol = app.findCollectionByNameOrId('tipos_atendimento')
    const tiposPadrao = [
      {
        nome: 'Avaliação / Consulta Inicial',
        duracao_minutos: 30,
        valor_padrao: 150,
        descricao: 'Exame clínico geral e planejamento',
        ativo: true,
      },
      {
        nome: 'Limpeza e Profilaxia',
        duracao_minutos: 45,
        valor_padrao: 220,
        descricao: 'Profilaxia, remoção de tártaro e jato de bicarbonato',
        ativo: true,
      },
      {
        nome: 'Restauração em Resina',
        duracao_minutos: 60,
        valor_padrao: 280,
        descricao: 'Restauração estética direta',
        ativo: true,
      },
      {
        nome: 'Tratamento a Laser / Laserterapia',
        duracao_minutos: 30,
        valor_padrao: 180,
        descricao: 'Aplicação de laser terapêutico para cicatrização e dor',
        ativo: true,
      },
      {
        nome: 'Clareamento Dental',
        duracao_minutos: 60,
        valor_padrao: 650,
        descricao: 'Sessão de clareamento no consultório',
        ativo: true,
      },
      {
        nome: 'Urgência / Alívio de Dor',
        duracao_minutos: 45,
        valor_padrao: 250,
        descricao: 'Atendimento prioritário de emergência',
        ativo: true,
      },
    ]

    const createdTipos = []
    for (const t of tiposPadrao) {
      try {
        const existing = app.findFirstRecordByData('tipos_atendimento', 'nome', t.nome)
        createdTipos.push(existing)
      } catch (_) {
        const rec = new Record(tiposCol)
        rec.set('nome', t.nome)
        rec.set('duracao_minutos', t.duracao_minutos)
        rec.set('valor_padrao', t.valor_padrao)
        rec.set('descricao', t.descricao)
        rec.set('ativo', t.ativo)
        app.save(rec)
        createdTipos.push(rec)
      }
    }

    // 5. Seed pacientes de demonstração para a clínica
    const pacientesCol = app.findCollectionByNameOrId('pacientes')
    const pacientesPadrao = [
      {
        nome: 'Mariana Silva Souza',
        telefone: '11988881234',
        email: 'mariana.silva@exemplo.com',
        data_nascimento: '1992-05-14 00:00:00.000Z',
        cpf: '123.456.789-01',
        observacoes: 'Sensibilidade pós-clareamento em dentes anteriores',
      },
      {
        nome: 'Carlos Eduardo Oliveira',
        telefone: '11977775678',
        email: 'carlos.oliveira@exemplo.com',
        data_nascimento: '1985-11-23 00:00:00.000Z',
        cpf: '234.567.890-12',
        observacoes: 'Paciente relata bruxismo noturno',
      },
      {
        nome: 'Beatriz Almeida Costa',
        telefone: '11966669876',
        email: 'beatriz.costa@exemplo.com',
        data_nascimento: '1998-08-30 00:00:00.000Z',
        cpf: '345.678.901-23',
        observacoes: 'Encaminhada para laserterapia',
      },
    ]

    const createdPacientes = []
    for (const p of pacientesPadrao) {
      try {
        const existing = app.findFirstRecordByData('pacientes', 'nome', p.nome)
        createdPacientes.push(existing)
      } catch (_) {
        const rec = new Record(pacientesCol)
        rec.set('nome', p.nome)
        rec.set('telefone', p.telefone)
        rec.set('email', p.email)
        rec.set('data_nascimento', p.data_nascimento)
        rec.set('cpf', p.cpf)
        rec.set('observacoes', p.observacoes)
        app.save(rec)
        createdPacientes.push(rec)
      }
    }

    // 6. Seed consultas de exemplo para a data de hoje / próximos dias
    const consultasCol = app.findCollectionByNameOrId('consultas')
    const hoje = new Date().toISOString().split('T')[0] + ' 00:00:00.000Z'

    if (createdPacientes.length >= 2 && createdTipos.length >= 2) {
      try {
        const existingConsultas = app.findRecordsByFilter(
          'consultas',
          `data >= '${hoje}'`,
          '',
          1,
          0,
        )
        if (existingConsultas.length === 0) {
          // Consulta 1
          const c1 = new Record(consultasCol)
          c1.set('paciente', createdPacientes[0].id)
          c1.set('tipo_atendimento', createdTipos[1].id) // Limpeza
          c1.set('data', hoje)
          c1.set('hora_inicio', '09:00')
          c1.set('duracao_minutos', 45)
          c1.set('hora_fim', '09:45')
          c1.set('status', 'confirmada')
          c1.set('observacoes', 'Retorno semestral')
          c1.set('lembrete_enviado', true)
          c1.set('lembrete_data_envio', hoje)
          c1.set('lembrete_enviado_por', 'Recepção Odontomari')
          app.save(c1)

          // Consulta 2
          const c2 = new Record(consultasCol)
          c2.set('paciente', createdPacientes[1].id)
          c2.set('tipo_atendimento', createdTipos[3].id) // Laserterapia
          c2.set('data', hoje)
          c2.set('hora_inicio', '10:30')
          c2.set('duracao_minutos', 30)
          c2.set('hora_fim', '11:00')
          c2.set('status', 'agendada')
          c2.set('observacoes', 'Segunda sessão de laser')
          c2.set('lembrete_enviado', false)
          app.save(c2)
        }
      } catch (_) {}
    }
  },
  (app) => {
    // down
  },
)
