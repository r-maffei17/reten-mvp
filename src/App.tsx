// Roteamento das telas e sincronização entre a rota e o perfil selecionado.

import { useEffect, type ReactNode } from 'react'
import { useDemo } from './app/DemoContexto'
import { interpretarRota, navegar, useRota } from './app/rotas'
import { Avisos } from './components/Interface'
import { Layout } from './components/Layout'
import { ContratosContratada, PainelContratada } from './views/Contratada'
import { DetalheContrato } from './views/DetalheContrato'
import { ListaContratos } from './views/ListaContratos'
import { NovoContrato } from './views/NovoContrato'
import { PainelContratante } from './views/PainelContratante'
import { ConfiguracoesPlataforma, ContratosPlataforma, PainelPlataforma } from './views/Plataforma'
import { Sobre } from './views/Sobre'
import type { Perfil } from './domain/types'

interface TelaResolvida {
  titulo: string
  conteudo: ReactNode
  /** Perfil ao qual a rota pertence, para manter o seletor coerente. */
  perfilDaRota?: Perfil
}

function resolverTela(rota: string, contratadaSelecionadaId: string): TelaResolvida {
  const { segmentos } = interpretarRota(rota)
  const [raiz, secao, terceiro] = segmentos

  if (raiz === 'sobre') {
    return { titulo: 'Sobre esta demonstração', conteudo: <Sobre /> }
  }

  if (raiz === 'contratante') {
    if (secao === 'contratos') {
      if (terceiro === 'novo') {
        return {
          titulo: 'Cadastrar contrato',
          conteudo: <NovoContrato />,
          perfilDaRota: 'contratante',
        }
      }
      if (terceiro) {
        return {
          titulo: 'Detalhe do contrato',
          conteudo: <DetalheContrato contratoId={terceiro} voltarPara="/contratante/contratos" />,
          perfilDaRota: 'contratante',
        }
      }
      return { titulo: 'Contratos', conteudo: <ListaContratos />, perfilDaRota: 'contratante' }
    }
    return { titulo: 'Painel da contratante', conteudo: <PainelContratante />, perfilDaRota: 'contratante' }
  }

  if (raiz === 'contratada') {
    if (secao === 'contratos') {
      if (terceiro) {
        return {
          titulo: 'Detalhe do contrato',
          conteudo: <DetalheContrato contratoId={terceiro} voltarPara="/contratada/contratos" />,
          perfilDaRota: 'contratada',
        }
      }
      return { titulo: 'Meus contratos', conteudo: <ContratosContratada />, perfilDaRota: 'contratada' }
    }
    return {
      titulo: 'Painel da contratada',
      conteudo: <PainelContratada key={contratadaSelecionadaId} />,
      perfilDaRota: 'contratada',
    }
  }

  if (raiz === 'plataforma') {
    if (secao === 'configuracoes') {
      return {
        titulo: 'Parâmetros da simulação',
        conteudo: <ConfiguracoesPlataforma />,
        perfilDaRota: 'plataforma',
      }
    }
    if (secao === 'contratos') {
      if (terceiro) {
        return {
          titulo: 'Detalhe do contrato',
          conteudo: <DetalheContrato contratoId={terceiro} voltarPara="/plataforma/contratos" />,
          perfilDaRota: 'plataforma',
        }
      }
      return {
        titulo: 'Contratos administrados',
        conteudo: <ContratosPlataforma />,
        perfilDaRota: 'plataforma',
      }
    }
    return { titulo: 'Painel da plataforma', conteudo: <PainelPlataforma />, perfilDaRota: 'plataforma' }
  }

  return { titulo: 'Painel da contratante', conteudo: <PainelContratante />, perfilDaRota: 'contratante' }
}

export function App() {
  const rota = useRota()
  const { perfil, definirPerfil, contratadaSelecionadaId } = useDemo()
  const tela = resolverTela(rota, contratadaSelecionadaId)

  // Rota desconhecida volta para a raiz do perfil atual.
  useEffect(() => {
    const raiz = interpretarRota(rota).segmentos[0]
    if (!raiz || !['contratante', 'contratada', 'plataforma', 'sobre'].includes(raiz)) {
      navegar(`/${perfil}`)
    }
  }, [rota, perfil])

  // Abrir um link direto de outro perfil (ex.: compartilhado no grupo) ajusta o seletor.
  useEffect(() => {
    if (tela.perfilDaRota && tela.perfilDaRota !== perfil) {
      definirPerfil(tela.perfilDaRota)
    }
  }, [tela.perfilDaRota, perfil, definirPerfil])

  return (
    <Layout rota={rota} titulo={tela.titulo}>
      {tela.conteudo}
      <Avisos />
    </Layout>
  )
}
