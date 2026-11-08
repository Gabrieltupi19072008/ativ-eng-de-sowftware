import { useState } from 'react'
import { emptyAddress, type Address } from '../types'
import { AddressFields } from '../components/AddressFields'
import { Image, Icon, Logo, Button, Field } from '../components/ui'
import { filters } from './Shop'
import { LegalModal, type LegalDoc } from '../components/Legal'

export type RegisterRole = 'buyer' | 'artist'

export function Register({ role, setRole, back, pending, submit }: { role: RegisterRole; setRole: (role: RegisterRole) => void; back: () => void; pending: boolean; submit: (data: FormData) => void }) {
  const [previews, setPreviews] = useState<string[]>([])
  const [location, setLocation] = useState<Address>(emptyAddress)
  const [legal, setLegal] = useState<LegalDoc | null>(null)
  return <main className="register-page"><header><Logo /><button className="back-link" type="button" onClick={back}>← Voltar ao início</button></header><div className="register-wrap">
    <section className="register-copy"><p className="eyebrow">Nova conta</p><h1>{role === 'artist' ? 'Apresente sua arte ao mundo.' : 'Comece sua coleção.'}</h1><p>{role === 'artist' ? 'Envie seus dados e algumas obras. Nossa curadoria analisa seu perfil em até 48 horas.' : 'Preencha seus dados para descobrir obras de artistas independentes.'}</p><div className="role-switch"><button type="button" className={role === 'buyer' ? 'active' : ''} onClick={() => setRole('buyer')}>Comprador</button><button type="button" className={role === 'artist' ? 'active' : ''} onClick={() => setRole('artist')}>Artista</button></div></section>
    <form onSubmit={(event) => { event.preventDefault(); submit(new FormData(event.currentTarget)) }} className="register-form"><input type="hidden" name="role" value={role} /><div className="form-section"><h2>Dados pessoais</h2><div className="form-grid"><Field label="Nome completo" name="name" placeholder="Como devemos chamar você?" required /><Field label="E-mail" name="email" type="email" placeholder="voce@email.com" required /><Field label="Celular" name="phone" placeholder="(11) 99999-9999" /><Field label="CPF" name="cpf" placeholder="000.000.000-00" required /><Field label="Data de nascimento" name="birthDate" type="date" /><Field label="Senha" name="password" type="password" placeholder="Mínimo 8 caracteres" required /></div></div>
      <div className="form-section"><h2>Localização</h2><AddressFields value={location} onChange={setLocation} strict={false} /></div>
      {role === 'artist' && <div className="form-section artist-section"><div><h2>Perfil artístico</h2><p>Essas informações serão exibidas para a curadoria.</p></div><label className="field"><span>Técnica ou estilo principal</span><select name="artStyle" required><option value="">Selecione</option>{filters.slice(1).map((item) => <option key={item}>{item}</option>)}</select></label><label className="field"><span>Sobre sua pesquisa artística</span><textarea name="artistBio" rows={5} required minLength={60} placeholder="Conte sobre sua trajetória, referências e processo criativo…" /></label><label className="portfolio-upload"><input type="file" name="portfolio" accept="image/*" multiple required onChange={(event) => setPreviews(Array.from(event.target.files ?? []).slice(0, 5).map(URL.createObjectURL))} /><Icon name="upload" /><strong>Anexe de 2 a 5 obras do seu portfólio</strong><span>JPG, PNG ou WEBP · até 10 MB por imagem</span></label>{previews.length > 0 && <div className="preview-strip">{previews.map((src, index) => <div key={src}><Image src={src} alt={`Prévia ${index + 1}`} fill sizes="120px" /></div>)}</div>}<div className="review-note"><span>48h</span><p><strong>Análise de curadoria</strong>Você poderá comprar normalmente enquanto seu perfil de vendedor é analisado.</p></div></div>}
      <label className="terms"><input type="checkbox" required /><span>Li e aceito os <button type="button" className="legal-link" onClick={() => setLegal('terms')}>Termos de Uso</button> e a <button type="button" className="legal-link" onClick={() => setLegal('privacy')}>Política de Privacidade</button>.</span></label><Button type="submit" kind="gold" disabled={pending} className="full">{pending ? 'Enviando…' : role === 'artist' ? 'Enviar para análise' : 'Criar minha conta'}</Button>
    </form>
  </div>{legal && <LegalModal doc={legal} close={() => setLegal(null)} />}</main>
}
