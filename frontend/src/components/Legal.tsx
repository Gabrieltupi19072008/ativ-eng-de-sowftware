import { useEffect } from 'react'

// Contato para pedidos sobre dados pessoais (LGPD). Troque aqui se o projeto passar a ter um e-mail próprio.
export const CONTACT_EMAIL = 'gabrieltupi19072008@gmail.com'

export type LegalDoc = 'terms' | 'privacy'

export function DemoBanner() {
  return <div className="demo-banner" role="note"><strong>Versão de demonstração.</strong> Nenhum pagamento é cobrado e nenhuma obra é enviada de verdade.</div>
}

export function LegalModal({ doc, close }: { doc: LegalDoc; close: () => void }) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [close])
  return <div className="modal-backdrop" onClick={close}>
    <section className="legal-modal" role="dialog" aria-modal="true" aria-label={doc === 'terms' ? 'Termos de Uso' : 'Política de Privacidade'} onClick={(event) => event.stopPropagation()}>
      <button type="button" className="legal-close" aria-label="Fechar" onClick={close}>×</button>
      {doc === 'terms' ? <Terms /> : <Privacy />}
      <button type="button" className="btn btn-gold legal-ok" onClick={close}>Entendi</button>
    </section>
  </div>
}

function Terms() {
  return <>
    <p className="eyebrow">Nambá Galerie</p>
    <h2>Termos de Uso</h2>
    <p className="legal-date">Última atualização: novembro de 2026</p>
    <h3>1. Projeto de demonstração</h3>
    <p>O Nambá Galerie é um projeto acadêmico e de portfólio. <strong>Nenhum pagamento é cobrado e nenhuma obra é enviada.</strong> Os pedidos, os pagamentos (Pix, boleto e cartão) e os envios são simulados para mostrar como a loja funcionaria. Não informe dados reais de cartão: qualquer número é aceito e nada é validado nem guardado.</p>
    <h3>2. Contas</h3>
    <p>Você é responsável pelas informações que cadastra e pela guarda da sua senha. Cadastros de artista passam por análise da curadoria e podem ser recusados. Contas podem ser removidas a qualquer momento, inclusive todas ao fim da demonstração.</p>
    <h3>3. Obras e conteúdo</h3>
    <p>Artistas declaram ser autores das obras e das imagens enviadas, ou ter autorização para usá-las. A curadoria pode despublicar qualquer obra. Não envie conteúdo ilegal, ofensivo ou que viole direitos de terceiros.</p>
    <h3>4. Pedidos</h3>
    <p>Cada obra é única: ao finalizar um pedido, a obra fica reservada. Pedidos não pagos em 24 horas expiram e a obra volta à vitrine.</p>
    <h3>5. Disponibilidade</h3>
    <p>O serviço roda em hospedagem gratuita e pode ficar lento ou fora do ar, e os dados podem ser apagados sem aviso.</p>
    <h3>6. Contato</h3>
    <p>Dúvidas: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
  </>
}

function Privacy() {
  return <>
    <p className="eyebrow">Nambá Galerie</p>
    <h2>Política de Privacidade</h2>
    <p className="legal-date">Última atualização: novembro de 2026</p>
    <h3>1. Quais dados coletamos</h3>
    <p>No cadastro: nome, e-mail, CPF, telefone, data de nascimento, endereço e senha. Artistas também enviam biografia, estilo e imagens de portfólio. Nos pedidos: as obras escolhidas e o endereço de entrega. Dados de cartão <strong>não</strong> são enviados nem guardados.</p>
    <h3>2. Para que usamos</h3>
    <p>Para criar e proteger sua conta, processar pedidos (de demonstração), aprovar artistas e enviar o e-mail de recuperação de senha. Não vendemos dados, não fazemos publicidade e não usamos ferramentas de rastreamento.</p>
    <h3>3. Onde ficam</h3>
    <p>Os dados ficam em um banco PostgreSQL e as imagens em um armazenamento de arquivos, ambos no Supabase. A API roda na Render e o site na Vercel. O e-mail de recuperação de senha é enviado pelo Brevo. Ao digitar o CEP, seu navegador consulta o serviço público ViaCEP.</p>
    <h3>4. Como protegemos</h3>
    <p>Senhas são guardadas só como hash (Argon2), a sessão usa cookie protegido (HttpOnly) e a conexão é por HTTPS. Mesmo assim, nenhum sistema é 100% seguro, e este é um projeto de demonstração.</p>
    <h3>5. Cookies</h3>
    <p>Usamos apenas um cookie de sessão, necessário para manter você conectado. Ele expira em 8 horas.</p>
    <h3>6. Seus direitos (LGPD)</h3>
    <p>Você pode pedir acesso, correção ou exclusão dos seus dados. Dados pessoais e endereços podem ser editados em Conta. Para excluir sua conta e seus dados, envie um e-mail para <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> com o e-mail cadastrado; respondemos em até 15 dias.</p>
    <h3>7. Responsável</h3>
    <p>Equipe do projeto Nambá Galerie, pelo contato acima.</p>
  </>
}
