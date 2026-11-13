# Análise pendente de execução — ver seção "Estado real desta rodada" no topo.

## Combinado com a usuária

1. Só análise primeiro: ler as planilhas, identificar abas e colunas, mostrar o mapa
   do que seria importado **antes** de importar de fato.
2. Ela aprova o mapa; só depois a importação é construída.

## Estado real desta rodada (13/11/2026)

- Arquivos chegaram em modo Agente e foram salvos em disco via `save_uploaded_assets`
  (`src/assets/backup-18540-…23ebe.xlsx` e `src/assets/pacientes27611-…d2894.xlsx`,
  nomes normalizados sem underscores). Confirmei que existem no ambiente de build.
- O `backup-…23ebe.xlsx` abriu no embed do chat (TOC lido com as abas: Procedimentos 5,
  Evolucoes 2, Orcamentos 544, Consultas 3648, Itens do Orcamento 2229, Pagamentos 1).
  O `pacientes_…811f9.xlsx` deu **"Not a zip archive (no end of central directory)"** no
  embed — provavelmente corrompido ou renomeado; precisa de reexportação.
- **Não foi possível rodar o parser nesta rodada**: esta plataforma não executa
  `npm test`/scripts ad-hoc no ambiente do agente (comprovado em 2 ciclos de QA:
  "Tests were NOT run: this platform does not execute the project test suite"). Sem
  shell, sem execução de script e sem upload ao backend, as linhas das abas não puderam
  ser lidas aqui.
- Os `.xlsx` foram removidos de `src/assets/` (dado de paciente não vai para o repo) e
  o parser ficou pronto em `tmp/analise.mjs` (fora de src/, ignora dados, só análise).
- **Nenhum dado das planilhas foi gravado no banco, embutido em código ou em fixture.**

### O que precisa acontecer para a análise sair

1. Reexportar o `pacientes_…xlsx` do Dentista Organizado (o atual não abre como ZIP).
2. Rodar `node tmp/analise.mjs` num ambiente com shell (máquina local ou terminal do
   builder) com os 2 `.xlsx` em `src/assets/`; ele gera `tmp/analise-out.md` com abas,
   colunas, tipos, categóricos, datas, duplicados e inconsistências — tudo mascarado.
3. Recolher o `tmp/analise-out.md` nesta conversa para que o agente preencha o mapa
   coluna→campo abaixo (ou rodar em modo não-Agente, em que a leitura dos anexos
   funciona).

## Nosso lado: onde cada coisa mora hoje (verificado no banco, 12/11/2026)

Coleções de destino e seus campos reais (Skip Cloud / PocketBase):

| Coleção                                           | Campos                                                                                                                                                                                                            |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **pacientes**                                     | nome, telefone, email, data_nascimento, cpf, endereco (texto livre), cep, logradouro, numero, complemento, bairro, cidade, uf, observacoes, preferencia_horario_tipo/de/ate/obs, origem, origem_complemento, foto |
| **consultas**                                     | paciente, tipo_atendimento, data, hora_inicio, duracao_minutos, hora_fim, status (agendada/confirmada/realizada/cancelada/faltou), observacoes, lembrete_enviado, lembrete_data_envio, lembrete_enviado_por       |
| **orcamentos** (UI: "Planejamento de Tratamento") | paciente, data, status (aberto/aceito/recusado), itens (JSON), valor_total, observacoes, validade_dias                                                                                                            |
| **tipos_atendimento**                             | nome, duracao_minutos, valor_padrao, descricao, ativo, retorno_dias_padrao                                                                                                                                        |
| **medicamentos**                                  | nome, apresentacao, posologia_padrao, ativo                                                                                                                                                                       |
| **prontuarios**                                   | paciente, consulta, data, procedimentos, anotacoes, dente_regiao, retorno_dias, retorno_data, retorno_cumprido                                                                                                    |
| **odontograma**                                   | paciente, dente, condicao, faces, observacao (1 registro por dente)                                                                                                                                               |
| **anamneses**                                     | paciente, modelo, respostas (JSON), data                                                                                                                                                                          |
| **receitas**                                      | paciente, itens (JSON), orientacoes, origem (manual/birdid), data                                                                                                                                                 |
| **bloqueios_agenda**                              | data, dia_inteiro, hora_inicio, hora_fim, motivo, tipo (bloqueio/desbloqueio_fds)                                                                                                                                 |
| **configuracoes**                                 | chave/valor (horários, telefones da clínica, dentista, mensagem de lembrete)                                                                                                                                      |

Situação atual do banco (a importação convivará com estes dados — não é banco vazio):

- pacientes: **5** (2 reais da clínica + 3 de demonstração)
- consultas: **5**, receitas: **1**, tipos_atendimento: **6**, medicamentos: **12**, configuracoes: **11**
- orcamentos/planejamentos: **0** · prontuários: **0** · anamneses: **0** · odontograma: **0** · bloqueios: **0**

## Checklist da análise (quando os arquivos forem líveis)

- [x] Confirmar os arquivos em disco após `save_uploaded_assets`
- [x] Verificar qual dos 2 abre como ZIP/xlsx válido (backup abre; pacientes falha)
- [ ] Listar todas as abas de cada planilha com nº de linhas — **bloqueado, ver acima**
- [ ] Listar TODAS as colunas (headers exatos) com 2–3 exemplos mascarados
- [ ] Mapear coluna → campo nosso existente / campo novo proposto / descartar
- [ ] Conferir duplicados (por nome e por telefone), formatos de data, telefone e valores
- [ ] Levantar dúvidas para a usuária decidir antes de importar

## Mapa das planilhas (a preencher quando as linhas forem legíveis)

_Pendente — a leitura das linhas não pôde ser executada nesta plataforma (sem execução
de script/shell para o agente; QA confirma "Tests were NOT run"). O parser está pronto
em `tmp/analise.mjs`; quando o `tmp/analise-out.md` for produzido, preencher aqui
aba por aba, com exemplos sempre mascarados._

## Proposta de importação (a preencher após o mapa)

_Pendente._
