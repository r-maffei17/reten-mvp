// Lista de pendências compartilhada pelos painéis da contratante e da contratada.
// Cada item mostra, sempre: o que falta, o motivo, quem é o responsável e o prazo.

import { navegar } from '../app/rotas'
import { diferencaDias, formatarData } from '../domain/datas'
import type { Pendencia } from '../domain/selecoes'

function classeUrgencia(p: Pendencia, dataReferencia: string): string {
  if (!p.prazo) return p.prioridade <= 2 ? 'aguardando' : ''
  const dias = diferencaDias(dataReferencia, p.prazo)
  if (dias < 0) return 'urgente'
  if (dias <= 5) return 'aguardando'
  return ''
}

function textoPrazo(prazo: string | undefined, dataReferencia: string): string {
  if (!prazo) return 'Sem prazo definido'
  const dias = diferencaDias(dataReferencia, prazo)
  if (dias < 0) return `${formatarData(prazo)} (vencido há ${Math.abs(dias)} dia(s))`
  if (dias === 0) return `${formatarData(prazo)} (vence hoje)`
  return `${formatarData(prazo)} (em ${dias} dia(s))`
}

export function ListaPendencias({
  pendencias,
  rotaBase,
  dataReferencia,
}: {
  pendencias: Pendencia[]
  rotaBase: string
  dataReferencia: string
}) {
  return (
    <ul className="lista-pendencias">
      {pendencias.map((p, indice) => (
        <li key={`${p.contratoId}-${indice}`} className={classeUrgencia(p, dataReferencia)}>
          <div className="titulo-pendencia">{p.titulo}</div>
          <div className="motivo">{p.motivo}</div>
          <div className="meta-pendencia">
            <span>
              <strong>Responsável:</strong> {p.responsavel}
            </span>
            <span>
              <strong>Prazo:</strong> {textoPrazo(p.prazo, dataReferencia)}
            </span>
            <span>
              <strong>Contrato:</strong> {p.codigo} — {p.nomeContrato}
            </span>
            <span>
              <strong>Contraparte:</strong> {p.empresa}
            </span>
          </div>
          <div className="acoes-pendencia">
            <button
              className="botao secundario pequeno"
              onClick={() => navegar(`${rotaBase}/${p.contratoId}`)}
            >
              Abrir contrato
            </button>
          </div>
        </li>
      ))}
    </ul>
  )
}
