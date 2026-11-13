# Importação do "Dentista Organizado" — preparativo de análise

> **Status: aguardando os arquivos.** Os dois arquivos `.xlsx` enviados pela usuária
> (`backup-18540-9CJvQTHH-e064c.xlsx` e `pacientes_27611_1794536305395-811f9.xlsx`)
> **não chegaram** à rodada de análise (nenhum anexo recebido pelo agente).
> Nada foi lido das planilhas, nenhum dado foi importado, nenhum schema foi alterado.
> Quando os arquivos forem reenviados, preencher a seção "Mapa das planilhas" abaixo.

## Combinado com a usuária

1. Só análise primeiro: ler as planilhas, identificar abas e colunas, mostrar o mapa
   do que seria importado **antes** de importar de fato.
2. Ela aprova o mapa; só depois a importação é construída.

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

## Checklist da análise (quando os arquivos chegarem)

- [ ] Listar todas as abas de cada planilha com nº de linhas
- [ ] Listar TODAS as colunas (headers exatos) com 2–3 exemplos mascarados
- [ ] Mapear coluna → campo nosso existente / campo novo proposto / descartar
- [ ] Conferir duplicados (por nome e por telefone), formatos de data, telefone e valores
- [ ] Levantar dúvidas para a usuária decidir antes de importar

## Mapa das planilhas (a preencher com os arquivos em mãos)

_Pendente — os arquivos não chegaram. Não inventar colunas._
