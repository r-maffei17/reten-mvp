// Componentes visuais reutilizáveis. Sem regra de negócio.

import { useEffect, type ReactNode } from 'react'
import { useDemo } from '../app/DemoContexto'

export type TomEtiqueta = 'neutra' | 'info' | 'sucesso' | 'alerta' | 'perigo'

/** Etiqueta de status. A cor sempre vem acompanhada de texto. */
export function Etiqueta({ tom, children }: { tom: TomEtiqueta; children: ReactNode }) {
  return <span className={`etiqueta ${tom}`}>{children}</span>
}

export function CartaoIndicador({
  rotulo,
  valor,
  apoio,
  tom,
}: {
  rotulo: string
  valor: ReactNode
  apoio?: ReactNode
  tom?: 'verde' | 'ambar'
}) {
  return (
    <div className="cartao cartao-indicador">
      <span className="rotulo">{rotulo}</span>
      <span className={`valor ${tom ?? ''}`}>{valor}</span>
      {apoio ? <span className="apoio">{apoio}</span> : null}
    </div>
  )
}

export function Painel({
  titulo,
  descricao,
  acoes,
  children,
  semEspaco,
}: {
  titulo: string
  descricao?: ReactNode
  acoes?: ReactNode
  children: ReactNode
  semEspaco?: boolean
}) {
  return (
    <section className="painel">
      <header className="painel-cabecalho">
        <div>
          <h2>{titulo}</h2>
          {descricao ? <div className="texto-pequeno texto-mudo">{descricao}</div> : null}
        </div>
        {acoes ? <div className="acoes">{acoes}</div> : null}
      </header>
      <div className={`painel-corpo${semEspaco ? ' sem-espaco' : ''}`}>{children}</div>
    </section>
  )
}

export function Vazio({
  simbolo = '📄',
  titulo,
  descricao,
  acao,
}: {
  simbolo?: string
  titulo: string
  descricao: string
  acao?: ReactNode
}) {
  return (
    <div className="vazio">
      <span className="simbolo" aria-hidden="true">
        {simbolo}
      </span>
      <h3>{titulo}</h3>
      <p>{descricao}</p>
      {acao}
    </div>
  )
}

export function Campo({
  id,
  rotulo,
  erro,
  dica,
  children,
}: {
  id: string
  rotulo: string
  erro?: string
  dica?: ReactNode
  children: ReactNode
}) {
  return (
    <div className={`campo${erro ? ' invalido' : ''}`}>
      <label htmlFor={id}>{rotulo}</label>
      {children}
      {dica && !erro ? <span className="dica">{dica}</span> : null}
      {erro ? (
        <span className="erro-campo" role="alert">
          {erro}
        </span>
      ) : null}
    </div>
  )
}

export function Modal({
  titulo,
  aoFechar,
  children,
  rodape,
}: {
  titulo: string
  aoFechar: () => void
  children: ReactNode
  rodape?: ReactNode
}) {
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => {
      if (e.key === 'Escape') aoFechar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  }, [aoFechar])

  return (
    <div
      className="fundo-modal"
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) aoFechar()
      }}
    >
      <div className="modal">
        <header className="modal-cabecalho">
          <h2>{titulo}</h2>
          <button className="fechar" onClick={aoFechar} aria-label="Fechar">
            ×
          </button>
        </header>
        <div className="modal-corpo">{children}</div>
        {rodape ? <footer className="modal-rodape">{rodape}</footer> : null}
      </div>
    </div>
  )
}

export function Confirmacao({
  titulo,
  mensagem,
  textoConfirmar,
  tomConfirmar = 'primario',
  aoConfirmar,
  aoCancelar,
}: {
  titulo: string
  mensagem: ReactNode
  textoConfirmar: string
  tomConfirmar?: 'primario' | 'verde' | 'perigo'
  aoConfirmar: () => void
  aoCancelar: () => void
}) {
  return (
    <Modal
      titulo={titulo}
      aoFechar={aoCancelar}
      rodape={
        <>
          <button className="botao secundario" onClick={aoCancelar}>
            Cancelar
          </button>
          <button className={`botao ${tomConfirmar}`} onClick={aoConfirmar}>
            {textoConfirmar}
          </button>
        </>
      }
    >
      {mensagem}
    </Modal>
  )
}

export function Avisos() {
  const { avisos, descartarAviso } = useDemo()
  if (avisos.length === 0) return null
  const rotulos = { sucesso: 'Sucesso', erro: 'Não foi possível concluir', info: 'Informação' }
  return (
    <div className="avisos" aria-live="polite">
      {avisos.map((aviso) => (
        <div key={aviso.id} className={`aviso ${aviso.tipo}`} role="status">
          <div>
            <span className="rotulo">{rotulos[aviso.tipo]}</span>
            <span>{aviso.mensagem}</span>
          </div>
          <button className="fechar" onClick={() => descartarAviso(aviso.id)} aria-label="Fechar aviso">
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
