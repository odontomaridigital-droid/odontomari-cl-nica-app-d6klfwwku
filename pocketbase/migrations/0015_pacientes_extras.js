/* Campo "extras" (JSON) na coleção pacientes: guarda colunas de planilhas
   importadas que não têm campo próprio no banco — nada é descartado. Idempotente. */
migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('pacientes')
    if (!col.fields.getByName('extras')) {
      col.fields.add(new JSONField({ name: 'extras', required: false, maxSize: 2000000 }))
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('pacientes')
    if (col.fields.getByName('extras')) col.fields.removeByName('extras')
    app.save(col)
  },
)
