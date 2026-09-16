// Persistência da demonstração no localStorage do navegador.
// Cada navegador tem a sua própria cópia: nada é compartilhado entre pessoas.

import { criarDadosIniciais, VERSAO_DADOS } from '../domain/dadosIniciais'
import type { EstadoDemo, Perfil } from '../domain/types'

const CHAVE_ESTADO = 'reten.demo.estado.v1'
const CHAVE_PERFIL = 'reten.demo.perfil.v1'
const CHAVE_CONTRATADA = 'reten.demo.contratada.v1'

function armazenamentoDisponivel(): boolean {
  try {
    const teste = '__reten_teste__'
    window.localStorage.setItem(teste, '1')
    window.localStorage.removeItem(teste)
    return true
  } catch {
    return false
  }
}

export const PERSISTENCIA_ATIVA = typeof window !== 'undefined' && armazenamentoDisponivel()

export function carregarEstado(): EstadoDemo {
  if (!PERSISTENCIA_ATIVA) return criarDadosIniciais()
  try {
    const bruto = window.localStorage.getItem(CHAVE_ESTADO)
    if (!bruto) return criarDadosIniciais()
    const dados = JSON.parse(bruto) as EstadoDemo
    // Mudou a estrutura dos dados de exemplo? Recomeça da demonstração atual.
    if (!dados || dados.versao !== VERSAO_DADOS || !Array.isArray(dados.contratos)) {
      return criarDadosIniciais()
    }
    return dados
  } catch {
    return criarDadosIniciais()
  }
}

export function salvarEstado(estado: EstadoDemo): void {
  if (!PERSISTENCIA_ATIVA) return
  try {
    window.localStorage.setItem(CHAVE_ESTADO, JSON.stringify(estado))
  } catch {
    // Sem espaço ou sem permissão: a demonstração segue apenas em memória.
  }
}

export function limparEstado(): void {
  if (!PERSISTENCIA_ATIVA) return
  try {
    window.localStorage.removeItem(CHAVE_ESTADO)
  } catch {
    /* ignora */
  }
}

export function carregarPerfil(): Perfil {
  if (!PERSISTENCIA_ATIVA) return 'contratante'
  const valor = window.localStorage.getItem(CHAVE_PERFIL)
  return valor === 'contratada' || valor === 'plataforma' ? valor : 'contratante'
}

export function salvarPerfil(perfil: Perfil): void {
  if (!PERSISTENCIA_ATIVA) return
  try {
    window.localStorage.setItem(CHAVE_PERFIL, perfil)
  } catch {
    /* ignora */
  }
}

export function carregarContratadaSelecionada(): string | null {
  if (!PERSISTENCIA_ATIVA) return null
  return window.localStorage.getItem(CHAVE_CONTRATADA)
}

export function salvarContratadaSelecionada(id: string): void {
  if (!PERSISTENCIA_ATIVA) return
  try {
    window.localStorage.setItem(CHAVE_CONTRATADA, id)
  } catch {
    /* ignora */
  }
}
