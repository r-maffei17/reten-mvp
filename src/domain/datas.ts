// Utilitários de data. Datas de calendário circulam como 'YYYY-MM-DD' (sem fuso horário).

/** Data de hoje como 'YYYY-MM-DD' no horário local. */
export function hojeISO(): string {
  return dataParaISO(new Date())
}

export function dataParaISO(d: Date): string {
  const ano = d.getFullYear()
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${ano}-${mes}-${dia}`
}

/** Soma dias a uma data ISO, devolvendo outra data ISO. */
export function somarDias(iso: string, dias: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const data = new Date(a, m - 1, d)
  data.setDate(data.getDate() + dias)
  return dataParaISO(data)
}

/** Soma meses a uma data ISO. */
export function somarMeses(iso: string, meses: number): string {
  const [a, m, d] = iso.split('-').map(Number)
  const data = new Date(a, m - 1 + meses, 1)
  const ultimoDia = new Date(data.getFullYear(), data.getMonth() + 1, 0).getDate()
  data.setDate(Math.min(d, ultimoDia))
  return dataParaISO(data)
}

/** Formata 'YYYY-MM-DD' como 'DD/MM/AAAA'. */
export function formatarData(iso: string | undefined): string {
  if (!iso) return '—'
  const soData = iso.slice(0, 10)
  const [a, m, d] = soData.split('-')
  if (!a || !m || !d) return '—'
  return `${d}/${m}/${a}`
}

/** Formata um datetime ISO como 'DD/MM/AAAA às HH:MM'. */
export function formatarDataHora(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return formatarData(iso)
  return `${formatarData(dataParaISO(d))} às ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Período 'YYYY-MM' do mês atual. */
export function periodoAtual(): string {
  return hojeISO().slice(0, 7)
}

/** Próximo período após 'YYYY-MM'. */
export function proximoPeriodo(periodo: string): string {
  const [a, m] = periodo.split('-').map(Number)
  const data = new Date(a, m, 1) // m (1-based) vira o mês seguinte em base 0
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`
}

const MESES = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
]

/** Formata 'YYYY-MM' como 'março de 2026'. */
export function formatarPeriodo(periodo: string): string {
  const [a, m] = periodo.split('-')
  const indice = Number(m) - 1
  if (indice < 0 || indice > 11) return periodo
  return `${MESES[indice]} de ${a}`
}

/** Formata 'YYYY-MM' como 'MM/AAAA'. */
export function formatarPeriodoCurto(periodo: string): string {
  const [a, m] = periodo.split('-')
  return `${m}/${a}`
}

/** Compara datas ISO: devolve true se `iso` já passou ou é hoje. */
export function dataAtingida(iso: string, referencia = hojeISO()): boolean {
  return iso <= referencia
}

/** Diferença em dias entre duas datas ISO (b - a). */
export function diferencaDias(a: string, b: string): number {
  const [aa, am, ad] = a.split('-').map(Number)
  const [ba, bm, bd] = b.split('-').map(Number)
  const da = Date.UTC(aa, am - 1, ad)
  const db = Date.UTC(ba, bm - 1, bd)
  return Math.round((db - da) / 86400000)
}
