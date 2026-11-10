/* Campos de preferência de horário, origem e foto na coleção pacientes (idempotente). */
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('pacientes')

    const textFields = [
      'preferencia_horario_tipo',
      'preferencia_horario_de',
      'preferencia_horario_ate',
      'preferencia_horario_obs',
      'origem',
      'origem_complemento',
    ]
    for (const nome of textFields) {
      if (!col.fields.getByName(nome)) {
        col.fields.add(new TextField({ name: nome, required: false }))
      }
    }
    if (!col.fields.getByName('foto')) {
      col.fields.add(new FileField({ name: 'foto', maxSelect: 1, maxSize: 2097152 }))
    }

    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('pacientes')
    const campos = [
      'preferencia_horario_tipo',
      'preferencia_horario_de',
      'preferencia_horario_ate',
      'preferencia_horario_obs',
      'origem',
      'origem_complemento',
      'foto',
    ]
    for (const nome of campos) {
      if (col.fields.getByName(nome)) col.fields.removeByName(nome)
    }
    app.save(col)
  },
)
