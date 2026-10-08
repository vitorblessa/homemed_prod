const EMERGENT_BASE = 'https://integrations.emergentagent.com/llm/v1';
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta';
const EMERGENT_MODEL = 'gemini/gemini-3.1-flash-lite';
const GEMINI_MODEL = 'gemini-3.1-flash-lite';
// Não enviar temperature/top_p/top_k/thinking_budget: os próximos modelos Gemini recusam esses parâmetros.

// Converts OpenAI-style chat messages (with optional image_url content parts)
// into Gemini's `contents` format.
function toGeminiContents(messages) {
  const contents = [];
  let systemText = '';
  for (const m of messages) {
    if (m.role === 'system') {
      systemText += (typeof m.content === 'string' ? m.content : '') + '\n';
      continue;
    }
    const parts = [];
    const c = m.content;
    if (typeof c === 'string') {
      parts.push({ text: c });
    } else if (Array.isArray(c)) {
      for (const part of c) {
        if (part.type === 'text') {
          parts.push({ text: part.text });
        } else if (part.type === 'image_url') {
          const url = part.image_url?.url || '';
          const match = url.match(/^data:(.+);base64,(.+)$/);
          if (match) {
            parts.push({ inline_data: { mime_type: match[1], data: match[2] } });
          }
        }
      }
    }
    contents.push({ role: m.role === 'assistant' ? 'model' : 'user', parts });
  }
  return { contents, systemText: systemText.trim() };
}

async function chatViaGemini(messages, { json = false } = {}) {
  const key = process.env.GEMINI_API_KEY;
  const { contents, systemText } = toGeminiContents(messages);

  const body = {
    contents,
    generationConfig: {},
  };
  if (systemText) {
    body.systemInstruction = { parts: [{ text: systemText }] };
  }
  if (json) {
    body.generationConfig.response_mime_type = 'application/json';
  }

  const res = await fetch(`${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${key}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gemini error ${res.status}: ${err}`);
  }
  const data = await res.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  return parts.map((p) => p.text || '').join('');
}

async function chatViaEmergent(messages, { json = false } = {}) {
  const key = process.env.EMERGENT_LLM_KEY;

  const body = {
    model: EMERGENT_MODEL,
    messages,
  };
  if (json) {
    body.response_format = { type: 'json_object' };
  }

  const res = await fetch(`${EMERGENT_BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`LLM error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// Uses a direct Google Gemini API key when available (GEMINI_API_KEY),
// falling back to the Emergent integrations proxy (EMERGENT_LLM_KEY) for
// backward compatibility with the original Emergent-hosted environment.
async function chat(messages, opts = {}) {
  if (process.env.GEMINI_API_KEY) {
    return chatViaGemini(messages, opts);
  }
  if (process.env.EMERGENT_LLM_KEY) {
    return chatViaEmergent(messages, opts);
  }
  throw new Error('Missing GEMINI_API_KEY (or EMERGENT_LLM_KEY) environment variable');
}

function extractJson(text) {
  if (!text) return null;
  // Try direct parse
  try { return JSON.parse(text); } catch {}
  // Try to find JSON block
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  return null;
}

export async function enrichFromBarcodeAndImage({ barcode, image_base64 }) {
  const system = `Você é um farmacêutico brasileiro especialista em identificação de medicamentos por imagem e código de barras. Analise a imagem da embalagem do medicamento fornecida e o código de barras (EAN-13/UPC brasileiro). Retorne informações estruturadas em JSON.

Regras CRÍTICAS:
- Retorne SEMPRE JSON válido, sem markdown, sem \`\`\`.
- Se conseguir identificar o produto pela imagem ou pelo código, preencha os campos de PRODUTO (nome_comercial, nome_generico, principio_ativo, laboratorio, concentracao, forma_farmaceutica, categoria, classe_terapeutica, para_que_serve, indicacoes, contraindicacoes, efeitos_colaterais, precisa_receita, modo_armazenamento).
- Os campos ESPECÍFICOS DA CAIXA — data_validade, lote, data_fabricacao — SÓ devem ser preenchidos se você ESTIVER LENDO CLARAMENTE esses valores impressos na IMAGEM fornecida. Se não houver imagem, ou se o texto estiver borrado, escondido, cortado ou não visível na imagem, retorne null para esses três campos. NUNCA CHUTE, NUNCA INVENTE, NUNCA ESTIME data de validade, lote ou fabricação.
- Datas devem ser retornadas no formato ISO YYYY-MM-DD. Se a VALIDADE estiver como MM/AAAA (ou MM/AA) na caixa, ela vale até o ÚLTIMO dia do mês: converta para o último dia (05/2027 -> 2027-05-31); para fabricação use o dia 01; se DD/MM/AAAA, converta para AAAA-MM-DD.
- O laboratório deve ser o EXATO fabricante que aparece na embalagem (ex: EMS, Sanofi, Aché, Medley, Neo Química, Eurofarma, Hypera). Se apenas código de barras for informado (sem imagem), retorne o fabricante mais provável associado ao GTIN.
- Se você não reconhecer nada, retorne { "reconhecido": false, "motivo": "..." }.`;

  const userText = `Código de barras lido: ${barcode || '(não fornecido)'}\n\nAnalise a imagem da embalagem e retorne um JSON com esta estrutura EXATA (use null se não souber):\n{\n  "reconhecido": true,\n  "nome_comercial": "Novalgina",\n  "nome_generico": "Dipirona Monoidratada",\n  "principio_ativo": "Dipirona Monoidratada",\n  "laboratorio": "Sanofi",\n  "concentracao": "500mg",\n  "forma_farmaceutica": "Comprimido",\n  "categoria": "Analgésico",\n  "classe_terapeutica": "Analgésico não opioide",\n  "para_que_serve": "Utilizada para aliviar dores leves a moderadas e reduzir febre.",\n  "indicacoes": ["Dor de cabeça","Cólica","Febre"],\n  "contraindicacoes": ["Alergia à dipirona","Porfiria hepática"],\n  "efeitos_colaterais": ["Reações alérgicas","Queda de pressão"],\n  "precisa_receita": false,\n  "uso_continuo_comum": false,\n  "modo_armazenamento": "Manter em temperatura ambiente...",\n  "lote": "ABC1234",\n  "data_fabricacao": "2024-05-01",\n  "data_validade": "2026-05-01",\n  "codigo_barras": "${barcode || ''}"\n}\n\nCategorias válidas: Antialérgico, Analgésico, Antibiótico, Anti-inflamatório, Antifúngico, Antiviral, Antigripal, Gastrointestinal, Vitaminas, Pomadas, Colírios, Controlados, Pressão arterial, Diabetes, Uso contínuo, Primeiros socorros, Outros.`;

  const content = [{ type: 'text', text: userText }];
  if (image_base64) {
    const dataUrl = image_base64.startsWith('data:') ? image_base64 : `data:image/jpeg;base64,${image_base64}`;
    content.push({ type: 'image_url', image_url: { url: dataUrl } });
  }

  const raw = await chat([
    { role: 'system', content: system },
    { role: 'user', content },
  ], { json: true });

  const parsed = extractJson(raw);
  if (!parsed) throw new Error('AI não retornou JSON válido');
  return parsed;
}

// Lê SÓ validade, fabricação e lote de uma foto (geralmente um close do carimbo
// na lateral/aba da caixa, onde o remédio nem aparece inteiro).
export async function readBoxDates({ image_base64 }) {
  const system = `Você lê o carimbo/impressão de datas e lote em embalagens de medicamentos brasileiras. Em geral o texto fica na lateral, na aba ou na base da caixa, impresso em tinta (jato de tinta/laser), pequeno e às vezes em baixo relevo. Termos comuns: FAB, FABR, FABRICAÇÃO, VAL, VALID, VALIDADE, VENC, LOTE, LOT, L:, BATCH.

Regras CRÍTICAS:
- Retorne SEMPRE JSON válido, sem markdown.
- Preencha apenas o que você LÊ claramente na imagem. Se estiver borrado, cortado ou ausente, use null. NUNCA invente nem estime.
- Datas em ISO AAAA-MM-DD. Se a caixa trouxer só MM/AAAA (ou MM/AA), a validade vale até o ÚLTIMO dia do mês: converta para o último dia (ex.: 05/2027 -> 2027-05-31; 02/2028 -> 2028-02-29). Para fabricação use o dia 01. Anos com 2 dígitos são 20AA.
- "lote" é o código exatamente como impresso (letras e números), sem o rótulo "LOTE".
- Se a imagem tiver mais de um conjunto de datas (por exemplo, de embalagens diferentes), use o da caixa em foco.`;
  const userText = `Leia a imagem e retorne EXATAMENTE este JSON (null onde não conseguir ler):
{ "lote": "ABC1234", "data_fabricacao": "2025-05-01", "data_validade": "2027-05-31", "texto_lido": "transcrição curta do que está impresso (ex.: FAB 05/25 VAL 05/27 LOTE ABC1234)" }`;
  const dataUrl = image_base64.startsWith('data:') ? image_base64 : `data:image/jpeg;base64,${image_base64}`;
  const raw = await chat([
    { role: 'system', content: system },
    { role: 'user', content: [{ type: 'text', text: userText }, { type: 'image_url', image_url: { url: dataUrl } }] },
  ], { json: true });
  const parsed = extractJson(raw);
  if (!parsed) throw new Error('AI não retornou JSON válido');
  return parsed;
}

export async function enrichMedicine(input) {
  const system = `Você é um farmacêutico brasileiro especialista. Dado o nome de um medicamento (pode ser nome comercial como "Novalgina", "Tylenol", "Allegra", ou nome genérico como "Dipirona", "Paracetamol"), retorne informações estruturadas em português brasileiro.

Regras:
- Retorne SEMPRE um JSON válido, sem markdown, sem \`\`\`.
- Se não reconhecer o medicamento, retorne { "reconhecido": false, "motivo": "..." }.
- Se reconhecer, retorne todos os campos abaixo preenchidos com precisão.
- Escreva descrições em linguagem simples que qualquer pessoa entenda.
- Se o usuário informar dosagem/concentração (ex: "500mg"), extraia no campo concentracao.`;

  const userPrompt = `Medicamento informado pelo usuário: "${input}"

Retorne um JSON com esta estrutura EXATA (use null se não souber):
{
  "reconhecido": true,
  "nome_comercial": "Novalgina",
  "nome_generico": "Dipirona Monoidratada",
  "principio_ativo": "Dipirona Monoidratada",
  "laboratorio_comum": "Sanofi",
  "concentracao": "500mg",
  "forma_farmaceutica": "Comprimido",
  "categoria": "Analgésico",
  "classe_terapeutica": "Analgésico não opioide",
  "para_que_serve": "Utilizada para aliviar dores leves a moderadas e reduzir febre.",
  "indicacoes": ["Dor de cabeça", "Cólica menstrual", "Febre", "Dor muscular"],
  "contraindicacoes": ["Alergia à dipirona", "Porfiria hepática", "Deficiência de G6PD"],
  "efeitos_colaterais": ["Reações alérgicas na pele", "Queda de pressão", "Náuseas raras"],
  "precisa_receita": false,
  "uso_continuo_comum": false,
  "modo_armazenamento": "Manter em temperatura ambiente, entre 15°C e 30°C, longe da umidade.",
  "tipo_nome_informado": "comercial"
}

O campo "tipo_nome_informado" deve ser "comercial" ou "generico" ou "principio_ativo" indicando o que o usuário digitou.
As categorias válidas são: Antialérgico, Analgésico, Antibiótico, Anti-inflamatório, Antifúngico, Antiviral, Antigripal, Gastrointestinal, Vitaminas, Pomadas, Colírios, Controlados, Pressão arterial, Diabetes, Uso contínuo, Primeiros socorros, Outros.`;

  const raw = await chat([
    { role: 'system', content: system },
    { role: 'user', content: userPrompt },
  ], { json: true });

  const parsed = extractJson(raw);
  if (!parsed) throw new Error('AI não retornou JSON válido');
  return parsed;
}

// Hoje no fuso do Brasil, como 'YYYY-MM-DD' (o modelo não sabe a data e errava "vencido").
function todayBR() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

function dayNumber(iso) {
  const [y, m, d] = String(iso).split('-').map(Number);
  return Math.round(Date.UTC(y, (m || 1) - 1, d || 1) / 86400000);
}

function describeExpiry(iso, today) {
  if (!/^\d{4}-\d{2}-\d{2}/.test(iso || '')) return 'validade não informada';
  const [y, m, d] = iso.slice(0, 10).split('-');
  const diff = dayNumber(iso.slice(0, 10)) - dayNumber(today);
  const br = `${d}/${m}/${y}`;
  if (diff < 0) return `validade ${br} (VENCIDO há ${-diff} dia${-diff === 1 ? '' : 's'})`;
  if (diff === 0) return `validade ${br} (vence HOJE)`;
  return `validade ${br} (válido, vence em ${diff} dia${diff === 1 ? '' : 's'})`;
}

export async function answerInventoryQuestion(question, medicines) {
  const today = todayBR();
  const [ty, tm, td] = today.split('-');
  const system = `Você é o assistente inteligente do HomeMed AI, um app de farmácia doméstica. Você ajuda o usuário a saber o que tem em casa. Responda em português brasileiro, de forma curta, clara e amigável.

Hoje é ${td}/${tm}/${ty}.

Regras:
- Use APENAS o inventário fornecido para responder.
- Se o inventário está vazio ou não tem algo do que foi perguntado, diga isso claramente.
- Ao listar medicamentos, mencione nome, quantidade e local de armazenamento se disponível.
- Cada medicamento traz a situação da validade já calculada ("válido", "VENCIDO" ou "vence HOJE"). Use exatamente essa situação; nunca recalcule datas.
- Alerte sobre medicamentos vencidos se relevante à pergunta.
- Datas sempre no formato dia/mês/ano.
- Formato: uma frase curta de introdução e, se houver mais de um medicamento, uma lista com um item por linha começando com "- " (nome em **negrito**). Não use numeração nem tabelas.
- Seja breve: no máximo 6 linhas no total.`;

  const inventoryText = medicines.length === 0
    ? '(inventário vazio)'
    : medicines.map((m, i) => {
        const parts = [
          `${i + 1}. ${m.nome_comercial || m.nome}`,
          m.principio_ativo ? `princípio ativo: ${m.principio_ativo}` : null,
          m.categoria ? `categoria: ${m.categoria}` : null,
          m.para_que_serve ? `serve para: ${m.para_que_serve}` : null,
          m.quantidade != null ? `quantidade: ${m.quantidade}` : null,
          m.local ? `local: ${m.local}` : null,
          describeExpiry(m.data_validade, today),
          m.precisa_receita ? 'exige receita' : null,
        ].filter(Boolean);
        return parts.join(' | ');
      }).join('\n');

  const userPrompt = `Inventário atual da farmácia doméstica:\n${inventoryText}\n\nPergunta do usuário: ${question}`;

  const answer = await chat([
    { role: 'system', content: system },
    { role: 'user', content: userPrompt },
  ], {});

  return answer.trim();
}
