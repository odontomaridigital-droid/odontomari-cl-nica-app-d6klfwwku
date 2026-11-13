migrate(
  (app) => {
    // Telefone passa a ser opcional.
    // Motivo: no backup real do Dentista Organizado, 37 dos 570 pacientes não têm
    // telefone nenhum. Com o campo obrigatório, esses pacientes simplesmente não
    // poderiam ser cadastrados — e perder cadastro é pior do que ter um contato
    // incompleto para a recepção completar depois.
    const col = app.findCollectionByNameOrId('pacientes')
    const telefone = col.fields.getByName('telefone')
    if (telefone) {
      telefone.required = false
      app.save(col)
    }
  },
  (app) => {
    // Volta a exigir telefone (só roda se não houver registro sem telefone)
    const col = app.findCollectionByNameOrId('pacientes')
    const telefone = col.fields.getByName('telefone')
    if (telefone) {
      telefone.required = true
      app.save(col)
    }
  },
)
