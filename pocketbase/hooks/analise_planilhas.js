// TEMPORÁRIO — hook de análise das planilhas do "Dentista Organizado".
// Lê os .xlsx em src/assets (fornecidos no deploy), extrai as abas com um
// leitor ZIP+xml mínimo (sem dependências), gera relatório MASCARADO e:
//   - imprime via console.log (aparece em list_logs source=hooks)
//   - grava em tmp/analise-out.md no diretório de trabalho do backend
// NÃO grava nada no banco. Removido após a análise (antes do commit).
//
// Notas de runtime do JSVM (goja):
//   - NÃO existe inflateRaw no JSVM: usamos `$os.exec("python3", ...).output()`
//     para descomprimir os streams DEFLATE de cada arquivo do zip; o próprio
//     script Python (heredoc, passado por -c) faz o trabalho pesado de leitura
//     do xlsx e devolve o relatório MASCARADO pronto no stdout.
//   - String.matchAll(regex) do goja lança "not a function": usar loops com
//     exec() (helper allMatches) em todo o arquivo.
//
// Custo: roda uma vez por chamada da rota; rota exige superusuário.
const ARQ_BACKUP = 'backup-18540-9cjvqthh-23ebe.xlsx'
const ARQ_PACIENTES = 'pacientes276111794536305395-d2894.xlsx'
const DIR = 'src/assets/'

// ---------- ZIP mínimo (EOCD + central directory) — só para listar/posicionar ----------
function readZip(buf) {
  const u8 = buf
  let eocd = -1
  for (let i = u8.length - 22; i >= 0 && i > u8.length - 70000; i--) {
    if (u8[i] === 0x50 && u8[i + 1] === 0x4b && u8[i + 2] === 0x05 && u8[i + 3] === 0x06) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('Não é um arquivo ZIP válido (sem EOCD)')
  const count = u8[eocd + 10] | (u8[eocd + 11] << 8)
  let off =
    (u8[eocd + 16] | (u8[eocd + 17] << 8) | (u8[eocd + 18] << 16) | (u8[eocd + 19] << 24)) >>> 0
  const files = new Map()
  for (let i = 0; i < count; i++) {
    if (!(u8[off] === 0x50 && u8[off + 1] === 0x4b && u8[off + 2] === 0x01 && u8[off + 3] === 0x02))
      throw new Error('Assinatura do diretório central inválida em ' + off)
    const fnLen = u8[off + 28] | (u8[off + 29] << 8)
    const exLen = u8[off + 30] | (u8[off + 31] << 8)
    const cmLen = u8[off + 32] | (u8[off + 33] << 8)
    let name = ''
    for (let j = 0; j < fnLen; j++) name += String.fromCharCode(u8[off + 46 + j])
    if (!name.endsWith('/')) files.set(name, true)
    off += 46 + fnLen + exLen + cmLen
  }
  return { names: Array.from(files.keys()) }
}

function bytesToStr(b) {
  if (typeof b === 'string') return b
  if (b === null || b === undefined || b.length === undefined) return String(b)
  let s = ''
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
  // converte UTF-8 bytes para string JS
  try {
    return decodeURIComponent(escape(s))
  } catch (_) {
    return s
  }
}

function bytesOf(b) {
  if (!b) return null
  if (b.length === undefined) return null
  const arr = new Array(b.length)
  for (let i = 0; i < b.length; i++) arr[i] = typeof b[i] === 'number' ? b[i] : b[i].charCodeAt(0)
  return arr
}

function bytesEqual(b, str) {
  if (b.length < str.length) return false
  for (let i = 0; i < str.length; i++) if (b[i] !== str.charCodeAt(i)) return false
  return true
}

// ---------- python (heredoc) que faz a leitura xlsx + análise + máscara ----------
const PY_SCRIPT = `
import json, sys, re, struct, zlib

ARQ_BACKUP = ${JSON.stringify(ARQ_BACKUP)}
ARQ_PACIENTES = ${JSON.stringify(ARQ_PACIENTES)}
DIR = ${JSON.stringify(DIR)}

RE_DATA_BR = re.compile(r"^\\d{1,2}/\\d{1,2}/\\d{2,4}$")
RE_ISO = re.compile(r"^\\d{4}-\\d{2}-\\d{2}([T ]\\d{2}:\\d{2}(:\\d{2})?)?$")
RE_MOEDA = re.compile(r"^R?\\$\\s?[\\d.]{1,12},\\d{2}$")
RE_NUM = re.compile(r"^[+-]?\\d+([.,]\\d+)?$")
RE_SIMNAO = re.compile(r"^(s|n|sim|n[aã]o|true|false|1|0)$", re.I)

def serial_to_iso(n):
    from datetime import date, timedelta
    return (date(1899, 12, 30) + timedelta(days=int(round(n)))).isoformat()

def parse_data_br(s):
    m = RE_DATA_BR.match(s)
    if not m:
        return None
    d_, mth, y = int(m.group(1)), int(m.group(2)), int(m.group(3))
    if y < 100:
        y += 2000
    try:
        from datetime import date
        date(y, mth, d_)
        return f"{y:04d}-{mth:02d}-{d_:02d}"
    except ValueError:
        return None

def classificar(v, hl):
    if v is None or str(v).strip() == "":
        return "vazio"
    s = str(v).strip()
    if RE_ISO.match(s):
        return "datahora-texto" if len(s) > 10 else "data-texto-iso"
    if RE_DATA_BR.match(s):
        return "data-br" if parse_data_br(s) else "data-br-invalida"
    if RE_MOEDA.match(s):
        return "moeda-texto"
    if RE_NUM.match(s):
        n = float(s.replace(",", "."))
        if re.search(r"data|nasc|cadastro|nascimento|criad|atualiz", hl) and 20000 < n < 60000:
            return "numero-serial-data"
        return "numero"
    if re.search(r"tel|cel|fone|whats", hl):
        d = re.sub(r"\\D", "", s)
        return "telefone-ok" if 10 <= len(d) <= 13 else "telefone-invalido"
    if "@" in s:
        return "email"
    if RE_SIMNAO.match(s):
        return "sim-nao"
    return "texto"

def mask_nome(s):
    p = [x for x in str(s).strip().split() if x]
    if not p:
        return "(vazio)"
    if len(p) == 1:
        return p[0][:2] + "***"
    return p[0][:12] + " " + p[-1][0] + "."

def mask_fone(s):
    d = re.sub(r"\\D", "", str(s))
    if len(d) < 8:
        return "(curto)"
    return "(**) " + ("9" if len(d) > 10 else "") + "****-**" + d[-2:]

def mask_cpf(s):
    return "***.***.***-**" if len(re.sub(r"\\D", "", str(s))) == 11 else "***"

def mask_email(s):
    m = re.match(r"^([^@])[^@]*@(.)(.*)$", str(s))
    return m.group(1) + "***@" + m.group(2) + "***" if m else "***"

def mask_generico(s):
    return re.sub(r"\\d{4,}", "****", str(s)[:60])

def maskar_valor(hl, v):
    if v is None:
        return ""
    if re.search(r"nome|paciente|pac\\.", hl):
        return mask_nome(v)
    if re.search(r"tel|cel|fone|whats", hl):
        return mask_fone(v)
    if re.search(r"cpf|cnpj", hl):
        return mask_cpf(v)
    if re.search(r"mail", hl):
        return mask_email(v)
    if re.search(r"nasc|nascimento|dtnasc", hl):
        return mask_generico(v)
    if re.search(r"evolu|anotac|observ|historia|descr|obs\\b|queixa|condut", hl, re.I):
        return "(texto clínico — não exibido, " + str(len(str(v))) + " caracteres)"
    return mask_generico(v)

def read_zip(buf):
    eocd = -1
    for i in range(len(buf) - 22, max(len(buf) - 70000, -1), -1):
        if buf[i:i+4] == b"PK\\x05\\x06":
            eocd = i
            break
    if eocd < 0:
        raise ValueError("Não é um arquivo ZIP válido (sem EOCD)")
    count = struct.unpack_from("<H", buf, eocd + 10)[0]
    off = struct.unpack_from("<I", buf, eocd + 16)[0]
    files = {}
    for _ in range(count):
        if buf[off:off+4] != b"PK\\x01\\x02":
            raise ValueError("Assinatura de central directory inválida em " + str(off))
        method = struct.unpack_from("<H", buf, off + 10)[0]
        comp_size = struct.unpack_from("<I", buf, off + 20)[0]
        fn_len = struct.unpack_from("<H", buf, off + 28)[0]
        ex_len = struct.unpack_from("<H", buf, off + 30)[0]
        cm_len = struct.unpack_from("<H", buf, off + 32)[0]
        local_off = struct.unpack_from("<I", buf, off + 42)[0]
        name = buf[off + 46:off + 46 + fn_len].decode("utf-8", "replace")
        if not name.endswith("/"):
            files[name] = {"method": method, "comp_size": comp_size, "local_off": local_off}
        off += 46 + fn_len + ex_len + cm_len
    def get(name):
        f = files.get(name)
        if not f:
            return None
        ln_len = struct.unpack_from("<H", buf, f["local_off"] + 26)[0]
        le_len = struct.unpack_from("<H", buf, f["local_off"] + 28)[0]
        start = f["local_off"] + 30 + ln_len + le_len
        raw = buf[start:start + f["comp_size"]]
        return raw if f["method"] == 0 else zlib.decompress(raw, -15)
    return get, list(files.keys())

def col_index_from_ref(ref):
    m = re.match(r"^([A-Z]+)", ref)
    if not m:
        return None
    i = 0
    for ch in m.group(1):
        i = i * 26 + (ord(ch) - 64)
    return i - 1

import xml.etree.ElementTree as ET
NS = "{http://schemas.openxmlformats.org/spreadsheetml/2006/main}"

def read_xlsx(buf):
    get, names = read_zip(buf)
    wb = get("xl/workbook.xml")
    if wb is None:
        raise ValueError("workbook.xml ausente — não parece xlsx")
    rels_map = {}
    rels = get("xl/_rels/workbook.xml.rels")
    if rels:
        root = ET.fromstring(rels.decode("utf-8", "replace"))
        for rel in root:
            rels_map[rel.attrib["Id"]] = rel.attrib["Target"]
    shared = []
    ss = get("xl/sharedStrings.xml")
    if ss:
        root = ET.fromstring(ss.decode("utf-8", "replace"))
        for si in root:
            parts = [t.text or "" for t in si.iter(NS + "t")]
            shared.append("".join(parts))
    root = ET.fromstring(wb.decode("utf-8", "replace"))
    ns_rel = "{http://schemas.openxmlformats.org/officeDocument/2006/relationships}"
    abas = []
    for sh in root.iter(NS + "sheet"):
        nome = sh.attrib.get("name", "(sem nome)")
        rid = sh.attrib.get(ns_rel + "id")
        target = rels_map.get(rid, "")
        if target.startswith("/"):
            target = target[1:]
        elif not target.startswith("xl/"):
            target = "xl/" + target
        xml = get(target)
        if xml is None:
            abas.append({"nome": nome, "header": [], "rows": [], "erro": "aba não encontrada no zip (" + target + ")"})
            continue
        xroot = ET.fromstring(xml.decode("utf-8", "replace"))
        rows = []
        for row in xroot.iter(NS + "row"):
            cells = []
            seq = 0
            for c in row.iter(NS + "c"):
                ref = c.attrib.get("r", "")
                t = c.attrib.get("t", "")
                val = None
                if t == "inlineStr":
                    val = "".join(x.text or "" for x in c.iter(NS + "t"))
                else:
                    v = c.find(NS + "v")
                    if v is not None and v.text is not None:
                        val = v.text
                        if t == "s":
                            val = shared[int(val)]
                idx = col_index_from_ref(ref) if ref else None
                if idx is None:
                    idx = seq
                cells.append(None)
                while len(cells) < idx:
                    cells.append(None)
                cells[idx] = val
                seq = idx + 1
            rows.append(cells)
        header_row = rows[0] if rows else []
        rows = rows[1:]
        header = []
        for i, h in enumerate(header_row):
            header.append("col" + str(i + 1) if h in (None, "") else str(h).strip())
        abas.append({"nome": nome, "header": header, "rows": rows})
    return {"abas": abas}

def analisar_aba(aba, rotulo):
    header = aba["header"]
    rows = aba["rows"]
    out = []
    say = out.append
    say("")
    say("### Aba \\"" + aba["nome"] + "\\" — " + rotulo)
    say("Linhas de dados: " + str(len(rows)) + " · Colunas: " + str(len(header)))
    if aba.get("erro"):
        say("ERRO: " + aba["erro"])
        return out
    if not rows:
        say("Aba sem linhas de dados (só cabeçalho ou vazia).")
        return out
    stats = []
    for ci, h in enumerate(header):
        hl = h.lower()
        contagem = {}
        valores = {}
        vazios = 0
        num_vals = []
        for row in rows:
            v = row[ci] if ci < len(row) else None
            c = classificar(v, hl)
            contagem[c] = contagem.get(c, 0) + 1
            if c == "vazio":
                vazios += 1
            else:
                s = str(v).strip()
                valores[s] = valores.get(s, 0) + 1
                if c in ("numero", "numero-serial-data", "moeda-texto"):
                    try:
                        num_vals.append(float(re.sub(r"[^\\d,.-]", "", s).replace(".", "").replace(",", ".")))
                    except ValueError:
                        pass
        tipos = sorted([k for k in contagem if k != "vazio"], key=lambda k: -contagem[k])
        stats.append({"h": h, "hl": hl, "vazios": vazios, "contagem": contagem,
                      "tipo": tipos[0] if tipos else "vazio", "valores": valores,
                      "num": num_vals})
    say("")
    say("| Coluna | Tipo inferido | Vazios | Observação |")
    say("|---|---|---|---|")
    for s in stats:
        dist = ", ".join(k + ":" + str(s["contagem"][k]) for k in s["contagem"] if k != "vazio")
        obs = dist
        if s["tipo"] == "numero" and s["num"]:
            obs = "soma=" + str(round(sum(s["num"]), 2)) + ", min=" + str(min(s["num"])) + ", max=" + str(max(s["num"])) + " · " + obs
        if s["tipo"] == "moeda-texto" and s["num"]:
            obs = "soma≈R$ " + str(round(sum(s["num"]), 2)) + " · " + obs
        if s["tipo"] in ("data-br", "data-texto-iso", "datahora-texto", "numero-serial-data"):
            isos = []
            for v in s["valores"]:
                if s["tipo"] == "numero-serial-data":
                    try:
                        isos.append(serial_to_iso(float(v)))
                    except Exception:
                        pass
                elif s["tipo"] == "data-br":
                    iso = parse_data_br(v)
                    if iso:
                        isos.append(iso)
                else:
                    isos.append(v[:10])
            isos.sort()
            range_ = "faixa " + isos[0][:7] + "…" + isos[-1][:7] + " (mes/ano)" if isos else ""
            obs = " · ".join(x for x in (range_, dist) if x)
        say("| " + s["h"] + " | " + s["tipo"] + " | " + str(s["vazios"]) + " | " + obs + " |")
    say("")
    say("Valores distintos (categóricos, quando ≤40 distintos):")
    tem_cat = False
    for s in stats:
        distintos = len(s["valores"])
        if distintos == 0 or distintos > 40:
            continue
        if s["tipo"].startswith("data") or s["tipo"] == "numero-serial-data":
            continue
        if re.search(r"id|codigo|c[óo]digo", s["hl"]) and distintos > 20:
            continue
        tem_cat = True
        pares = sorted(s["valores"].items(), key=lambda x: -x[1])[:40]
        say("- " + s["h"] + " (" + str(distintos) + " distintos): " +
            " · ".join(maskar_valor(s["hl"], v) + " ×" + str(c) for v, c in pares))
    if not tem_cat:
        say("(nenhuma coluna categórica)")
    say("")
    say("Amostras mascaradas (3 primeiras linhas):")
    for i in range(min(3, len(rows))):
        row = rows[i]
        pares = []
        for ci, h in enumerate(header):
            v = row[ci] if ci < len(row) else None
            masc = maskar_valor(h.lower(), v)
            if masc != "":
                pares.append(h + "=" + masc)
        say("- " + " · ".join(pares)[:700])
    return out

def norm_nome(s):
    import unicodedata
    s = unicodedata.normalize("NFD", str(s or "").lower())
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    s = re.sub(r"[^a-z ]", " ", s)
    return re.sub(r"\\s+", " ", s).strip()

def norm_fone(s):
    d = re.sub(r"\\D", "", str(s or ""))
    if len(d) in (12, 13):
        d = d[2:]
    if len(d) == 11 and d[0] != "9":
        d = "9" + d[2:]
    return d[-11:] if len(d) >= 10 else d

def coluna_de(header, padroes):
    for p in padroes:
        for i, h in enumerate(header):
            if re.search(p, h.lower()):
                return i
    return -1

def analisar_qualidade(tudo):
    out = []
    say = out.append
    say("")
    say("## Qualidade dos dados")
    say("")
    master_nomes = set()
    for chave, plan in tudo.items():
        aba_pac = None
        for a in plan["abas"]:
            if a["nome"] and re.search(r"paciente", a["nome"], re.I):
                aba_pac = a
                break
        if aba_pac is None:
            for a in plan["abas"]:
                if coluna_de(a["header"], [r"^nome"]) >= 0 and len(a["header"]) > 5:
                    aba_pac = a
                    break
        if aba_pac is None:
            continue
        ci_nome = coluna_de(aba_pac["header"], [r"^nome\\b", r"nome.*paciente", r"^paciente"])
        if ci_nome < 0:
            continue
        ci_fone = coluna_de(aba_pac["header"], [r"cel", r"tel", r"fone"])
        dup_nome = {}
        dup_fone = {}
        sem_nome = fone_vazio = fone_mal = 0
        total = len(aba_pac["rows"])
        for row in aba_pac["rows"]:
            nome = row[ci_nome] if ci_nome < len(row) else None
            if not nome or not str(nome).strip():
                sem_nome += 1
                continue
            nn = norm_nome(nome)
            if len(nn) > 3:
                dup_nome.setdefault(nn, []).append(nome)
            if ci_fone >= 0:
                f = row[ci_fone] if ci_fone < len(row) else None
                nf = norm_fone(f)
                if not f or not str(f).strip():
                    fone_vazio += 1
                elif len(re.sub(r"\\D", "", str(f))) < 10:
                    fone_mal += 1
                if nf:
                    dup_fone.setdefault(nf, []).append(nome)
            master_nomes.add(nn)
        nomes_dup = [v for v in dup_nome.values() if len(v) > 1]
        fones_dup = [v for v in dup_fone.values() if len(v) > 1]
        say("### Pacientes — " + chave)
        say("- Linhas: " + str(total) + " · sem nome: " + str(sem_nome) +
            " · telefone vazio: " + str(fone_vazio) + " · telefone malformado (<10 dígitos): " + str(fone_mal))
        extras = sum(len(v) - 1 for v in nomes_dup)
        say("- Nomes duplicados: " + str(len(nomes_dup)) + " grupos (" + str(extras) + " linhas extras) — exemplos: " +
            ("; ".join(", ".join(mask_nome(x) for x in v) for v in nomes_dup[:8]) or "—"))
        say("- Telefones duplicados (mesmo número em >1 linha): " + str(len(fones_dup)) + " — exemplos: " +
            ("; ".join(mask_fone(v[0]) + " (" + ", ".join(mask_nome(x) for x in v) + ")" for v in fones_dup[:8]) or "—"))
        say("")
    say("### Referências entre abas")
    for chave, plan in tudo.items():
        for aba in plan["abas"]:
            if re.search(r"paciente", aba["nome"], re.I):
                continue
            ci = coluna_de(aba["header"], [r"^paciente\\b", r"nome.*paciente", r"^paciente\\."])
            if ci < 0:
                continue
            total = fora = vazio = 0
            exemplos = {}
            for row in aba["rows"]:
                v = row[ci] if ci < len(row) else None
                if not v or not str(v).strip():
                    vazio += 1
                    continue
                total += 1
                nn = norm_nome(v)
                if nn and nn not in master_nomes:
                    fora += 1
                    exemplos.setdefault(nn, v)
            say("- " + aba["nome"] + " (" + chave + "): " + str(total) + " linhas com paciente · " + str(fora) +
                " citam paciente que NÃO está na aba de pacientes · vazios: " + str(vazio) +
                ". Exemplos fora: " + ("; ".join(mask_nome(x) for x in list(exemplos.values())[:8]) or "—"))
    say("")
    say("### Datas e formatos suspeitos (todas as abas)")
    for chave, plan in tudo.items():
        for aba in plan["abas"]:
            for ci, h in enumerate(aba["header"]):
                hl = h.lower()
                if not re.search(r"data|nasc|cadastro|retorno|criad|atualiz|validade", hl):
                    continue
                br_invalida = texto_livre = ok = vazios = 0
                exemplos = []
                for row in aba["rows"]:
                    v = row[ci] if ci < len(row) else None
                    s = "" if v is None else str(v).strip()
                    if not s:
                        vazios += 1
                        continue
                    if RE_DATA_BR.match(s):
                        ok += 1 if parse_data_br(s) else 0
                        br_invalida += 0 if parse_data_br(s) else 1
                    elif RE_ISO.match(s):
                        ok += 1
                    elif re.match(r"^\\d{5}(\\.\\d+)?$", s):
                        ok += 1
                    else:
                        texto_livre += 1
                        if len(exemplos) < 5:
                            exemplos.append(mask_generico(s))
                if br_invalida or texto_livre:
                    say("- " + aba["nome"] + " (" + chave + ") · coluna \\"" + h + "\\": ok/serial=" + str(ok) +
                        ", datas BR inválidas=" + str(br_invalida) + ", outros formatos=" + str(texto_livre) +
                        ", vazios=" + str(vazios) + (" · ex.: " + " | ".join(exemplos) if exemplos else ""))
    return out

tudo = {}
erros = []
out = []
say = out.append
say("# Análise automática — Dentista Organizado (hook temporário)")
say("Relatório gerado por hook temporário a partir dos .xlsx anexados. Exemplos SEMPRE mascarados.")
for chave, arquivo in [("backup completo", ARQ_BACKUP), ("export pacientes", ARQ_PACIENTES)]:
    p = DIR + arquivo
    say("")
    say("## Arquivo: " + arquivo)
    try:
        with open(p, "rb") as f:
            buf = f.read()
    except OSError as exc:
        say("ARQUIVO NÃO ENCONTRADO EM " + p + " (" + str(exc) + ")")
        erros.append(arquivo + ": não encontrado")
        continue
    say("Bytes em disco: " + str(len(buf)))
    magic = buf[:4].decode("ascii", "replace")
    if magic == "PK\\x03\\x04":
        say("Assinatura: PK.. (zip/xlsx ok)")
        try:
            plan = read_xlsx(buf)
            tudo[chave] = plan
            say("Abas: " + ", ".join("\\"" + a["nome"] + "\\" (" + str(len(a["rows"])) + " linhas)" for a in plan["abas"]))
            for aba in plan["abas"]:
                for l in analisar_aba(aba, chave):
                    say(l)
        except Exception as exc:
            say("FALHA ao abrir: " + str(exc))
            erros.append(arquivo + ": " + str(exc))
    elif magic == "\\xd0\\xcf\\x11\\xe0":
        say("É OLE2/BIFF — não suportado; precisa de reexportação do Dentista Organizado.")
        erros.push_fake = None
        erros.append(arquivo + ": OLE2/BIFF não suportado")
    else:
        head = buf[:2000].decode("utf-8", "replace")
        if re.search(r"<html|<table", head, re.I):
            say("Detectado HTML disfarçado de .xlsx — parse de tabela não implementado; reexportar.")
            erros.append(arquivo + ": HTML disfarçado")
        else:
            say("Formato desconhecido (" + magic.encode("unicode_escape").decode() + ") — precisa de reexportação.")
            erros.append(arquivo + ": formato desconhecido")
if erros:
    say("")
    say("## Erros de leitura")
    for er in erros:
        say("- " + er)
try:
    for l in analisar_qualidade(tudo):
        say(l)
except Exception as exc:
    say("")
    say("ERRO na análise de qualidade: " + str(exc))
relatorio = "\\n".join(out)
try:
    with open("tmp/analise-out.md", "w", encoding="utf-8") as f:
        f.write(relatorio)
except OSError as exc:
    print("ANALISE: falha ao gravar tmp/analise-out.md: " + str(exc))
print("ANALISE PLANILHAS: " + str(len(relatorio)) + " chars; erros: " + ("; ".join(erros) or "nenhum"))
print("ANALISE PLANILHAS INICIO:\\n" + relatorio[:3000])
`

function rodarPython() {
  const cmd = $os.exec('python3', ['-c', PY_SCRIPT])
  let saida
  try {
    saida = cmd.output()
  } catch (err) {
    throw new Error('python3 falhou: ' + String(err && err.message ? err.message : err))
  }
  return typeof saida === 'string' ? saida : bytesToStr(saida)
}

routerAdd(
  'POST',
  '/backend/v1/analise-planilhas',
  (e) => {
    let saida
    try {
      saida = rodarPython()
    } catch (err) {
      console.log('ANALISE PLANILHAS FALHOU: ' + String(err && err.message ? err.message : err))
      return e.json(500, { ok: false, erro: String(err && err.message ? err.message : err) })
    }
    console.log(saida)
    return e.json(200, { ok: true, chars: saida.length, preview: saida.slice(0, 3000) })
  },
  $apis.requireSuperuserAuth(),
)
