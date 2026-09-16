// Contexto único da demonstração: estado, ações, perfil selecionado e avisos na tela.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { ResultadoAcao } from '../domain/acoes'
import { criarDadosIniciais } from '../domain/dadosIniciais'
import type { EstadoDemo, Perfil } from '../domain/types'
import {
  carregarContratadaSelecionada,
  carregarEstado,
  carregarPerfil,
  limparEstado,
  PERSISTENCIA_ATIVA,
  salvarContratadaSelecionada,
  salvarEstado,
  salvarPerfil,
} from './armazenamento'

export interface Aviso {
  id: number
  tipo: 'sucesso' | 'erro' | 'info'
  mensagem: string
}

interface ValorContexto {
  estado: EstadoDemo
  perfil: Perfil
  definirPerfil: (p: Perfil) => void
  contratadaSelecionadaId: string
  definirContratadaSelecionada: (id: string) => void
  /** Executa uma ação pura e aplica o resultado, exibindo o aviso correspondente. */
  executar: (acao: (estado: EstadoDemo) => ResultadoAcao) => boolean
  restaurarDemonstracao: () => void
  avisos: Aviso[]
  descartarAviso: (id: number) => void
  notificar: (tipo: Aviso['tipo'], mensagem: string) => void
  persistenciaAtiva: boolean
}

const Contexto = createContext<ValorContexto | null>(null)

export function ProvedorDemo({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoDemo>(() => carregarEstado())
  const [perfil, setPerfilInterno] = useState<Perfil>(() => carregarPerfil())
  const [avisos, setAvisos] = useState<Aviso[]>([])
  const proximoAvisoId = useRef(1)

  const [contratadaSelecionadaId, setContratadaInterna] = useState<string>(() => {
    const salvo = carregarContratadaSelecionada()
    const inicial = carregarEstado()
    if (salvo && inicial.contratadas.some((c) => c.id === salvo)) return salvo
    return inicial.contratadas[0]?.id ?? ''
  })

  useEffect(() => {
    salvarEstado(estado)
  }, [estado])

  const notificar = useCallback((tipo: Aviso['tipo'], mensagem: string) => {
    const id = proximoAvisoId.current++
    setAvisos((atuais) => [...atuais, { id, tipo, mensagem }])
    window.setTimeout(() => {
      setAvisos((atuais) => atuais.filter((a) => a.id !== id))
    }, 7000)
  }, [])

  const descartarAviso = useCallback((id: number) => {
    setAvisos((atuais) => atuais.filter((a) => a.id !== id))
  }, [])

  const executar = useCallback(
    (acao: (estado: EstadoDemo) => ResultadoAcao) => {
      let sucesso = false
      setEstado((atual) => {
        const resultado = acao(atual)
        if (resultado.ok) {
          sucesso = true
          notificar('sucesso', resultado.mensagem)
          return resultado.estado
        }
        notificar('erro', resultado.mensagem)
        return atual
      })
      return sucesso
    },
    [notificar],
  )

  const definirPerfil = useCallback((p: Perfil) => {
    setPerfilInterno(p)
    salvarPerfil(p)
  }, [])

  const definirContratadaSelecionada = useCallback((id: string) => {
    setContratadaInterna(id)
    salvarContratadaSelecionada(id)
  }, [])

  const restaurarDemonstracao = useCallback(() => {
    limparEstado()
    const novos = criarDadosIniciais()
    setEstado(novos)
    setContratadaInterna(novos.contratadas[0]?.id ?? '')
    notificar('sucesso', 'Demonstração restaurada com os dados iniciais.')
  }, [notificar])

  const valor = useMemo<ValorContexto>(
    () => ({
      estado,
      perfil,
      definirPerfil,
      contratadaSelecionadaId,
      definirContratadaSelecionada,
      executar,
      restaurarDemonstracao,
      avisos,
      descartarAviso,
      notificar,
      persistenciaAtiva: PERSISTENCIA_ATIVA,
    }),
    [
      estado,
      perfil,
      definirPerfil,
      contratadaSelecionadaId,
      definirContratadaSelecionada,
      executar,
      restaurarDemonstracao,
      avisos,
      descartarAviso,
      notificar,
    ],
  )

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

export function useDemo(): ValorContexto {
  const valor = useContext(Contexto)
  if (!valor) throw new Error('useDemo precisa estar dentro de <ProvedorDemo>.')
  return valor
}
