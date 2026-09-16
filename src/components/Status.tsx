// Tradução de estados do domínio para etiquetas visuais.
// A cor nunca aparece sozinha: sempre acompanhada do texto do status.

import { ROTULO_STATUS_DOCUMENTO, ROTULO_STATUS_LIBERACAO } from '../domain/elegibilidade'
import type { StatusDocumento, StatusLiberacao } from '../domain/types'
import { Etiqueta, type TomEtiqueta } from './Interface'

const TOM_DOCUMENTO: Record<StatusDocumento, TomEtiqueta> = {
  pendente: 'neutra',
  enviado: 'info',
  aprovado: 'sucesso',
  rejeitado: 'perigo',
}

const TOM_LIBERACAO: Record<StatusLiberacao, TomEtiqueta> = {
  bloqueada: 'alerta',
  elegivel: 'info',
  solicitada: 'info',
  liberada: 'sucesso',
}

export function EtiquetaDocumento({ status }: { status: StatusDocumento }) {
  return <Etiqueta tom={TOM_DOCUMENTO[status]}>{ROTULO_STATUS_DOCUMENTO[status]}</Etiqueta>
}

export function EtiquetaLiberacao({ status }: { status: StatusLiberacao }) {
  return <Etiqueta tom={TOM_LIBERACAO[status]}>{ROTULO_STATUS_LIBERACAO[status]}</Etiqueta>
}

export function EtiquetaDeposito({ confirmado }: { confirmado: boolean }) {
  return confirmado ? (
    <Etiqueta tom="sucesso">Depósito confirmado</Etiqueta>
  ) : (
    <Etiqueta tom="alerta">Aguardando depósito</Etiqueta>
  )
}
