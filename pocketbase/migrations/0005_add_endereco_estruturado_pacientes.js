migrate(
  (app) => {
    const col = app.findCollectionByNameOrId('pacientes')
    const campos = ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf']
    for (const nome of campos) {
      if (!col.fields.getByName(nome)) {
        col.fields.add(new TextField({ name: nome, required: false }))
      }
    }
    app.save(col)
  },
  (app) => {
    const col = app.findCollectionByNameOrId('pacientes')
    const campos = ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'uf']
    for (const nome of campos) {
      const field = col.fields.getByName(nome)
      if (field) {
        col.fields.removeByName(nome)
      }
    }
    app.save(col)
  },
)
