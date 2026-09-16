// Estrutura da aplicação: menu lateral (computador), menu recolhível (celular),
// barra superior com o seletor de perfis e a faixa que identifica o ambiente.

import { useEffect, useState, type ReactNode } from 'react'
import { useDemo } from '../app/DemoContexto'
import { navegar } from '../app/rotas'
import type { Perfil } from '../domain/types'
import { Confirmacao } from './Interface'

interface ItemMenu {
  rota: string
  rotulo: string
  icone: string
  /** Marca como ativo também as sub-rotas. */
  prefixo?: boolean
}

const MENUS: Record<Perfil, ItemMenu[]> = {
  contratante: [
    { rota: '/contratante', rotulo: 'Painel', icone: '▣' },
    { rota: '/contratante/contratos', rotulo: 'Contratos', icone: '▤', prefixo: true },
    { rota: '/contratante/contratos/novo', rotulo: 'Cadastrar contrato', icone: '＋' },
  ],
  contratada: [
    { rota: '/contratada', rotulo: 'Painel', icone: '▣' },
    { rota: '/contratada/contratos', rotulo: 'Meus contratos', icone: '▤', prefixo: true },
  ],
  plataforma: [
    { rota: '/plataforma', rotulo: 'Painel', icone: '▣' },
    { rota: '/plataforma/contratos', rotulo: 'Contratos administrados', icone: '▤' },
    { rota: '/plataforma/configuracoes', rotulo: 'Parâmetros da simulação', icone: '⚙' },
  ],
}

const ROTULO_PERFIL: Record<Perfil, string> = {
  contratante: 'Contratante',
  contratada: 'Contratada',
  plataforma: 'Plataforma',
}

const RAIZ_PERFIL: Record<Perfil, string> = {
  contratante: '/contratante',
  contratada: '/contratada',
  plataforma: '/plataforma',
}

export function Layout({
  rota,
  titulo,
  children,
}: {
  rota: string
  titulo: string
  children: ReactNode
}) {
  const { perfil, definirPerfil, restaurarDemonstracao, persistenciaAtiva } = useDemo()
  const [menuAberto, setMenuAberto] = useState(false)
  const [confirmandoRestauracao, setConfirmandoRestauracao] = useState(false)

  // Ao trocar de tela no celular, o menu se fecha sozinho.
  useEffect(() => {
    setMenuAberto(false)
  }, [rota])

  const itens = MENUS[perfil]

  const estaAtivo = (item: ItemMenu) => {
    if (item.prefixo) {
      // "Cadastrar contrato" tem rota própria e não deve acender "Contratos".
      if (rota === '/contratante/contratos/novo') return false
      return rota === item.rota || rota.startsWith(`${item.rota}/`)
    }
    return rota === item.rota
  }

  const trocarPerfil = (novo: Perfil) => {
    definirPerfil(novo)
    navegar(RAIZ_PERFIL[novo])
  }

  return (
    <div className="layout">
      <aside className={`menu-lateral${menuAberto ? ' aberto' : ''}`} aria-label="Menu principal">
        <div className="menu-marca">
          <span className="logo" aria-hidden="true">
            R
          </span>
          <span>
            <span className="nome">Reten</span>
            <span className="sub">Gestão de retenções contratuais</span>
          </span>
        </div>

        <div className="menu-secao">Perfil: {ROTULO_PERFIL[perfil]}</div>
        <nav>
          <ul className="menu-lista">
            {itens.map((item) => (
              <li key={item.rota}>
                <a
                  href={`#${item.rota}`}
                  aria-current={estaAtivo(item) ? 'page' : undefined}
                  onClick={() => setMenuAberto(false)}
                >
                  <span className="icone" aria-hidden="true">
                    {item.icone}
                  </span>
                  {item.rotulo}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="menu-secao">Demonstração</div>
        <nav>
          <ul className="menu-lista">
            <li>
              <a href="#/sobre" aria-current={rota === '/sobre' ? 'page' : undefined}>
                <span className="icone" aria-hidden="true">
                  ⓘ
                </span>
                Sobre esta demonstração
              </a>
            </li>
          </ul>
        </nav>

        <div className="menu-rodape">
          <button className="botao claro pequeno" onClick={() => setConfirmandoRestauracao(true)}>
            ↺ Restaurar demonstração
          </button>
          <p style={{ marginTop: 10, marginBottom: 0 }}>
            {persistenciaAtiva
              ? 'As alterações ficam salvas neste navegador.'
              : 'Este navegador bloqueou o armazenamento: as alterações duram só até recarregar a página.'}
          </p>
        </div>
      </aside>

      <div
        className={`sombra-menu${menuAberto ? ' visivel' : ''}`}
        onClick={() => setMenuAberto(false)}
        aria-hidden="true"
      />

      <div className="conteudo">
        <header className="barra-topo">
          <button
            className="botao-menu"
            onClick={() => setMenuAberto((v) => !v)}
            aria-label="Abrir menu"
            aria-expanded={menuAberto}
          >
            ☰
          </button>
          <span className="titulo-pagina">{titulo}</span>
          <span className="espaco" />
          <div className="seletor-perfil" role="group" aria-label="Selecionar perfil de demonstração">
            {(Object.keys(ROTULO_PERFIL) as Perfil[]).map((p) => (
              <button key={p} aria-pressed={perfil === p} onClick={() => trocarPerfil(p)}>
                {ROTULO_PERFIL[p]}
              </button>
            ))}
          </div>
        </header>

        <div className="faixa-demo">
          <strong>Demonstração — dados e movimentações fictícios.</strong>
          <span>
            Depósitos, aplicações, rendimentos e liberações são simulados. Não há integração com
            bancos, meios de pagamento ou investimentos.
          </span>
        </div>

        <main className="pagina">{children}</main>
      </div>

      {confirmandoRestauracao ? (
        <Confirmacao
          titulo="Restaurar a demonstração?"
          textoConfirmar="Sim, restaurar"
          tomConfirmar="perigo"
          mensagem={
            <>
              <p>
                Todas as alterações feitas neste navegador serão apagadas e os dados de exemplo
                voltarão ao estado inicial.
              </p>
              <p className="texto-pequeno texto-mudo" style={{ marginBottom: 0 }}>
                Esta ação não pode ser desfeita.
              </p>
            </>
          }
          aoConfirmar={() => {
            restaurarDemonstracao()
            setConfirmandoRestauracao(false)
            navegar(RAIZ_PERFIL[perfil])
          }}
          aoCancelar={() => setConfirmandoRestauracao(false)}
        />
      ) : null}
    </div>
  )
}
