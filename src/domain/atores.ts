// Pessoas fictícias que assinam as ações na demonstração.
// Cada perfil age em nome de um responsável identificado no histórico e nas pendências.

import type { Perfil } from './types'

export const RESPONSAVEL_POR_PERFIL: Record<Perfil, string> = {
  contratante: 'Ana Ribeiro — Fiscalização de contratos',
  contratada: 'Marcos Lima — Administração de contratos',
  plataforma: 'TrustRetain — Operações',
}

export const ROTULO_PERFIL: Record<Perfil, string> = {
  contratante: 'Contratante',
  contratada: 'Contratada',
  plataforma: 'Plataforma',
}
