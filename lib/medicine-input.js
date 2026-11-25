// Campos que o app pode gravar num medicamento, com tipo e tamanho máximo.
// Tudo o que vier fora desta lista é ignorado (dono, família, datas internas,
// resumo da bula, campos inventados), e cada valor é convertido para o tipo
// certo. Assim um pedido forjado não guarda objetos, textos enormes ou campos
// que quebrariam a lista da família inteira.
import { normalizeDoseTimes } from '@/lib/doses';

const TEXT = {
  nome_comercial: 200,
  nome_generico: 200,
  principio_ativo: 300,
  laboratorio: 200,
  concentracao: 100,
  forma_farmaceutica: 60,
  categoria: 60,
  classe_terapeutica: 150,
  para_que_serve: 1000,
  modo_armazenamento: 500,
  lote: 60,
  data_fabricacao: 20,
  data_validade: 20,
  local: 100,
  observacoes: 2000,
  codigo_barras: 64,
};
const LISTS = ['indicacoes', 'contraindicacoes', 'efeitos_colaterais'];
const FLAGS = ['precisa_receita', 'uso_continuo'];
const NUMBERS = ['quantidade', 'quantidade_minima'];
const MAX_LIST_ITEMS = 30;
const MAX_LIST_ITEM = 300;
const MAX_QTY = 100000;

const text = (v, max) => (typeof v === 'string' || typeof v === 'number' ? String(v).slice(0, max) : '');

const list = (v) => (Array.isArray(v) ? v : [])
  .filter((x) => typeof x === 'string' || typeof x === 'number')
  .map((x) => String(x).slice(0, MAX_LIST_ITEM))
  .slice(0, MAX_LIST_ITEMS);

// Número inteiro entre 0 e MAX_QTY; null/vazio vira o padrão.
const qty = (v, fallback) => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(MAX_QTY, Math.max(0, Math.round(n)));
};

/** Só os campos editáveis presentes em `body`, já com tipo e tamanho certos (para o PATCH). */
export function pickMedicineUpdates(body) {
  const src = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const out = {};
  for (const [k, max] of Object.entries(TEXT)) if (k in src) out[k] = text(src[k], max);
  for (const k of LISTS) if (k in src) out[k] = list(src[k]);
  for (const k of FLAGS) if (k in src) out[k] = !!src[k];
  for (const k of NUMBERS) if (k in src) out[k] = qty(src[k], 0);
  if ('dose_times' in src) out.dose_times = normalizeDoseTimes(src.dose_times);
  return out;
}

/** Documento completo de um medicamento novo, com os padrões do app (para o POST). */
export function buildMedicineFields(body) {
  const src = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const t = (k, ...alts) => text([src[k], ...alts.map((a) => src[a])].find((v) => v), TEXT[k]);
  return {
    nome_comercial: t('nome_comercial', 'nome'),
    nome_generico: t('nome_generico'),
    principio_ativo: t('principio_ativo'),
    laboratorio: t('laboratorio', 'laboratorio_comum'),
    concentracao: t('concentracao'),
    forma_farmaceutica: t('forma_farmaceutica') || 'Comprimido',
    categoria: t('categoria') || 'Outros',
    classe_terapeutica: t('classe_terapeutica'),
    para_que_serve: t('para_que_serve'),
    indicacoes: list(src.indicacoes),
    contraindicacoes: list(src.contraindicacoes),
    efeitos_colaterais: list(src.efeitos_colaterais),
    precisa_receita: !!src.precisa_receita,
    uso_continuo: !!src.uso_continuo,
    modo_armazenamento: t('modo_armazenamento'),
    lote: t('lote'),
    data_fabricacao: t('data_fabricacao'),
    data_validade: t('data_validade'),
    quantidade: qty(src.quantidade, 1),
    quantidade_minima: qty(src.quantidade_minima, 1),
    local: t('local'),
    observacoes: t('observacoes'),
    codigo_barras: t('codigo_barras'),
    dose_times: normalizeDoseTimes(src.dose_times),
  };
}
