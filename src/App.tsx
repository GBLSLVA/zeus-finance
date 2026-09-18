import { useEffect, useState, type FormEvent } from 'react'
import { api } from './api'

type Kind = 'transactions' | 'debts' | 'goals'
type Entry = {id:number; name:string; category:string; value:number; target:number; saved:number; createdAt:string}
type User = {id:number; email:string}
const titles = {overview:'Visão geral',transactions:'Gastos',debts:'Dívidas',goals:'Metas'}
const money = (n:number) => n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const categories = ['Casa','Comida','Transporte','Lazer','Outros']

export function App() {
  const [user,setUser] = useState<User|null>(null)
  const [loading,setLoading] = useState(true)
  const [register,setRegister] = useState(false)
  const [busy,setBusy] = useState(false)
  const [error,setError] = useState('')
  const [view,setView] = useState<Kind|'overview'>('overview')
  const [menu,setMenu] = useState(false)
  const [data,setData] = useState<Record<Kind,Entry[]>>({transactions:[],debts:[],goals:[]})
  const load = async () => {
    const [transactions,debts,goals] = await Promise.all([api.request<Entry[]>('transactions'),api.request<Entry[]>('debts'),api.request<Entry[]>('goals')])
    setData({transactions,debts,goals})
  }
  useEffect(()=>{api.request<User>('me').then(async u=>{await load();setUser(u)}).catch(e=>{if(e.message !== 'Entre na sua conta.' && e.message !== 'Sessão expirada.') setError('Inicie o backend para acessar sua conta.')}).finally(()=>setLoading(false))},[])
  async function login(event:FormEvent<HTMLFormElement>) {
    event.preventDefault();setBusy(true);setError('')
    const form = new FormData(event.currentTarget)
    try {const u=await api.request<User>(register?'register':'login','POST',{email:form.get('email'),password:form.get('password')});await load();setUser(u)}
    catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function logout() {
    try {await api.request('logout','POST');setUser(null);setData({transactions:[],debts:[],goals:[]});setView('overview')}
    catch(e){setError((e as Error).message)}
  }
  async function add(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); if(view==='overview')return
    const element=event.currentTarget,form=new FormData(element)
    setBusy(true);setError('')
    try {
      const entry=await api.request<Entry>(view,'POST',{name:form.get('name'),category:form.get('category'),value:Number(form.get('value')),target:Number(form.get('value')),saved:Number(form.get('saved')??0)})
      setData(current=>({...current,[view]:[entry,...current[view]]}));element.reset()
    }catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  async function remove(kind:Kind,id:number) {
    if(!window.confirm('Excluir este registro?'))return
    setBusy(true);setError('')
    try{await api.request(`${kind}/${id}`,'DELETE');setData(current=>({...current,[kind]:current[kind].filter(entry=>entry.id!==id)}))}
    catch(e){setError((e as Error).message)}finally{setBusy(false)}
  }
  if(loading)return <main><p role="status">Conectando ao ZEUS Finance…</p></main>
  if(!user)return <main className="auth-layout"><section className="card form-card"><p className="eyebrow">ZEUS FINANCE</p><h1>{register?'Crie sua conta':'Seu dinheiro, com clareza.'}</h1><p>Gastos, dívidas e metas em um só lugar.</p><form onSubmit={login}><label>E-mail<input name="email" type="email" autoComplete="email" required maxLength={254}/></label><label>Senha<input name="password" type="password" autoComplete={register?'new-password':'current-password'} minLength={12} maxLength={128} required/></label><small>Use no mínimo 12 caracteres.</small><button className="primary" disabled={busy}>{busy?'Aguarde…':register?'Criar conta':'Entrar'}</button></form><button className="text-button" onClick={()=>{setRegister(!register);setError('')}}>{register?'Já tenho uma conta':'Criar minha conta'}</button>{error&&<p role="alert" className="negative">{error}</p>}</section></main>
  const now=new Date(), monthly=data.transactions.filter(e=>{const d=new Date(e.createdAt.replace(' ','T')+'Z');return d.getUTCFullYear()===now.getUTCFullYear()&&d.getUTCMonth()===now.getUTCMonth()})
  const spent=monthly.reduce((n,e)=>n+e.value,0), debt=data.debts.reduce((n,e)=>n+e.value,0)
  const navigate=(next:typeof view)=>{setView(next);setMenu(false);setError('')}
  return <div className="shell"><aside id="navigation" className={`sidebar ${menu?'open':''}`}><div className="brand"><span className="brand-mark">Z</span>ZEUS FINANCE</div><nav aria-label="Navegação principal">{(Object.keys(titles) as (keyof typeof titles)[]).map(key=><button key={key} className={`nav-item ${view===key?'active':''}`} aria-current={view===key?'page':undefined} onClick={()=>navigate(key)}>{titles[key]}</button>)}<button className="mobile-toggle" onClick={()=>setMenu(false)} aria-label="Fechar menu">×</button></nav><div className="sidebar-bottom"><div className="security">{user.email}<small>Dados salvos no servidor</small></div><button className="text-button" onClick={logout}>Sair da conta</button></div></aside><main><header className="topbar"><button className="mobile-toggle" aria-controls="navigation" aria-expanded={menu} onClick={()=>setMenu(!menu)} aria-label="Abrir menu">☰</button><div><p className="eyebrow">PAINEL FINANCEIRO</p><h1>{titles[view]}</h1></div></header>{error&&<p role="alert" className="negative">{error}</p>}
    {view==='overview'?<div className="content-grid"><section className="metrics">{[['Gastos neste mês (UTC)',money(spent)],['Dívidas registradas',money(debt)],['Valor reservado',money(data.goals.reduce((n,g)=>n+g.saved,0))],['Metas cadastradas',String(data.goals.length)]].map(([label,value])=><article className="card metric" key={label}><span className="metric-label">{label}</span><strong>{value}</strong></article>)}</section><section className="card"><h2>Gastos por categoria neste mês</h2>{spent===0?<p className="empty-state">Registre seu primeiro gasto para acompanhar a distribuição.</p>:categories.map(category=>{const total=monthly.filter(e=>e.category===category).reduce((n,e)=>n+e.value,0);return <div key={category} className="goal"><div className="goal-head"><span>{category}</span><b>{money(total)}</b></div><div className="progress"><b style={{width:`${total/spent*100}%`}}/></div></div>})}</section><section className="card"><p className="eyebrow">COMECE POR AQUI</p><h2>Construa seu acompanhamento</h2><p>Registre seus gastos, os saldos das dívidas e as metas que deseja alcançar.</p><button className="primary" onClick={()=>navigate('transactions')}>Registrar gasto</button></section></div>:<div className="content-grid single-view"><section className="card table-card"><h2>{titles[view]} registrados</h2><div className="table-wrap"><table><thead><tr><th>Descrição</th><th>{view==='goals'?'Reservado / alvo':'Valor'}</th><th>Ação</th></tr></thead><tbody>{data[view].map(entry=><tr key={entry.id}><td><strong>{entry.name}</strong><small>{view==='transactions'?entry.category:''}</small></td><td>{view==='goals'?`${money(entry.saved)} / ${money(entry.target)}`:money(entry.value)}</td><td><button className="text-button" disabled={busy} onClick={()=>remove(view,entry.id)} aria-label={`Excluir ${entry.name}`}>Excluir</button></td></tr>)}{!data[view].length&&<tr><td colSpan={3} className="empty-state">Nenhum registro. Comece pelo formulário.</td></tr>}</tbody></table></div></section><section className="card form-card"><h2>Adicionar {view==='goals'?'meta':view==='debts'?'dívida':'gasto'}</h2><form key={view} onSubmit={add}><label>Descrição<input name="name" required maxLength={120}/></label>{view==='transactions'&&<label>Categoria<select name="category">{categories.map(c=><option key={c}>{c}</option>)}</select></label>}<label>{view==='goals'?'Valor alvo':'Valor'}<input name="value" type="number" min="0.01" max="100000000" step="0.01" required/></label>{view==='goals'&&<label>Valor já reservado<input name="saved" type="number" min="0" max="100000000" step="0.01" defaultValue="0" required/></label>}<button className="primary" disabled={busy}>{busy?'Salvando…':'Salvar registro'}</button></form></section></div>}
  </main></div>
}
