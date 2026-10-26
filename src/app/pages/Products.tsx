import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Package, Plus, Search, Pencil, RefreshCw, X, Save, Info } from 'lucide-react';
import Header from '../components/Header';
import { api } from '../../services/access.service';
import { AuthService } from '../../services/auth.service';
import { useLanguage } from '../../i18n/LanguageContext';
import '../styles/audit.scss';
import '../styles/products.scss';
type Product={id:string;code:string;name:string;description:string;category:string;kind:string;tracks_inventory:boolean;base_price:string;tax_treatment:string;vat_rate:string;active:boolean;version:number;vat_amount:string;final_price:string};
type Form=Omit<Product,'id'|'vat_amount'|'final_price'> & {reason:string};
const empty:Form={code:'',name:'',description:'',category:'',kind:'product',tracks_inventory:true,base_price:'',tax_treatment:'taxed',vat_rate:'',active:true,version:1,reason:''};
export default function Products(){
 const {t,language}=useLanguage();const admin=AuthService.getAuthData().user?.role==='admin';
 const [products,setProducts]=useState<Product[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [search,setSearch]=useState(''),[state,setState]=useState('all'),[kind,setKind]=useState('all');
 const [open,setOpen]=useState(false),[editing,setEditing]=useState<string|null>(null),[form,setForm]=useState<Form>(empty),[saving,setSaving]=useState(false);
 const editor=useRef<HTMLElement>(null);const codeInput=useRef<HTMLInputElement>(null);
 const money=(v:string)=>new Intl.NumberFormat(language==='es'?'es-CO':'en-US',{style:'currency',currency:'COP',minimumFractionDigits:2}).format(Number(v));
 async function load(){setError('');setLoading(true);try{setProducts(await api<Product[]>('/products'));}catch(e){setError(e instanceof Error?e.message:'Request failed');}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 useEffect(()=>{if(open){editor.current?.scrollIntoView({behavior:'smooth',block:'start'});codeInput.current?.focus();}},[open]);
 const shown=useMemo(()=>products.filter(p=>(state==='all'||(state==='active')===p.active)&&(kind==='all'||kind===p.kind)&&[p.name,p.code,p.category].some(v=>v.toLocaleLowerCase().includes(search.toLocaleLowerCase().trim()))),[products,search,state,kind]);
 function edit(p?:Product){setError('');setNotice('');setEditing(p?.id||null);setForm(p?{...p,reason:''}:{...empty});setOpen(true);}
 async function save(e:FormEvent){e.preventDefault();setSaving(true);setError('');try{
 await api(editing?`/products/${editing}`:'/products',{method:editing?'PUT':'POST',body:JSON.stringify(form)});setOpen(false);setNotice('Catalog saved successfully');await load();
 }catch(e){setError(e instanceof Error?e.message:'Request failed');}finally{setSaving(false);}}
 function field<K extends keyof Form>(key:K,value:Form[K]){setForm(prev=>({...prev,[key]:value}));}
 return <div className="orbit-audit-page"><Header/><main className="orbit-admin orbit-catalog">
 <div className="orbit-audit-heading"><div><div className="orbit-audit-eyebrow"><Package size={16}/>{t('Commercial management')}</div><h2>{t('Products and services')}</h2><p>{t('Keep your catalog, prices and tax settings organized.')}</p></div><div className="orbit-catalog-actions"><button className="orbit-admin-btn" onClick={()=>void load()} disabled={loading}><RefreshCw size={17}/>{t('Refresh')}</button>{admin&&<button className="orbit-admin-btn orbit-admin-btn--primary" onClick={()=>edit()}><Plus size={18}/>{t('Add product')}</button>}</div></div>
 <div className="orbit-audit-stats">{[{label:'Catalog items',value:products.length},{label:'Active items',value:products.filter(p=>p.active).length},{label:'Services',value:products.filter(p=>p.kind==='service').length}].map(s=><article className="orbit-audit-stat" key={s.label}><div><p>{t(s.label)}</p><strong>{s.value}</strong></div><span className="orbit-audit-stat-icon orbit-audit-stat-icon--blue"><Package size={24}/></span></article>)}</div>
 <div className="orbit-audit-notice"><Info size={18}/><p>{t('Prices are in COP before VAT. Tax treatment and rates must be verified for each item. Stock movements will be added in the next stage.')}</p></div>
 {error&&<p role="alert">{t(error)}</p>}{notice&&<p role="status" className="orbit-catalog-success">{t(notice)}</p>}
 {open&&admin&&<section ref={editor} className="orbit-audit-panel orbit-catalog-editor"><div className="orbit-audit-panel-heading"><span className="orbit-audit-section-icon"><Package size={21}/></span><div><h3>{t(editing?'Edit catalog item':'New catalog item')}</h3><p>{t('Changes are recorded in the audit history.')}</p></div><button className="orbit-admin-btn" aria-label={t('Close')} disabled={saving} onClick={()=>setOpen(false)}><X size={18}/></button></div>
 <form onSubmit={save} className="orbit-catalog-form"><div className="orbit-catalog-fields">
 <label>{t('Code')} *<input ref={codeInput} required maxLength={40} pattern="[A-Za-z0-9_-]+" value={form.code} onChange={e=>field('code',e.target.value)} placeholder="PROD-001"/><small>{t('Letters, numbers, hyphens and underscores.')}</small></label>
 <label>{t('Name')} *<input required maxLength={120} value={form.name} onChange={e=>field('name',e.target.value)}/></label>
 <label>{t('Category')}<input maxLength={80} value={form.category} onChange={e=>field('category',e.target.value)}/></label>
 <label>{t('Type')}<select value={form.kind} onChange={e=>setForm(prev=>({...prev,kind:e.target.value,tracks_inventory:e.target.value==='service'?false:prev.tracks_inventory}))}><option value="product">{t('Product')}</option><option value="service">{t('Service')}</option></select></label>
 <label>{t('Base price (COP)')} *<input type="number" min="0" max="999999999999.99" step="0.01" required value={form.base_price} onChange={e=>field('base_price',e.target.value)}/></label>
 <label>{t('Tax treatment')}<select value={form.tax_treatment} onChange={e=>setForm(prev=>({...prev,tax_treatment:e.target.value,vat_rate:e.target.value==='taxed'?'':'0'}))}><option value="taxed">{t('Taxed')}</option><option value="exempt">{t('Exempt')}</option><option value="excluded">{t('Excluded')}</option></select></label>
 <label>{t('VAT rate (%)')} *<input type="number" min="0" max="100" step="0.01" required disabled={form.tax_treatment!=='taxed'} value={form.vat_rate} onChange={e=>field('vat_rate',e.target.value)}/></label>
 <label>{t('State')}<select value={String(form.active)} onChange={e=>field('active',e.target.value==='true')}><option value="true">{t('active')}</option><option value="false">{t('inactive')}</option></select></label>
 <label className="orbit-catalog-wide">{t('Description')}<textarea rows={3} maxLength={1000} value={form.description} onChange={e=>field('description',e.target.value)}/></label>
 <label className="orbit-catalog-check orbit-catalog-wide"><input type="checkbox" checked={form.tracks_inventory} disabled={form.kind==='service'} onChange={e=>field('tracks_inventory',e.target.checked)}/>{t('Track inventory for this product')}</label>
 <label className="orbit-catalog-wide">{t('Reason for change')} *<textarea required rows={2} minLength={5} maxLength={500} value={form.reason} onChange={e=>field('reason',e.target.value)} placeholder={t('Explain why you are creating or changing this item.')}/></label>
 </div><div className="orbit-catalog-footer"><button type="button" className="orbit-admin-btn" disabled={saving} onClick={()=>setOpen(false)}>{t('Cancel')}</button><button className="orbit-admin-btn orbit-admin-btn--primary" disabled={saving}><Save size={17}/>{t(saving?'Saving...':'Save')}</button></div></form></section>}
 <section className="orbit-audit-panel"><div className="orbit-audit-panel-heading"><span className="orbit-audit-section-icon"><Package size={21}/></span><div><h3>{t('Catalog')}</h3><p>{t('View products and services available to your team.')}</p></div></div>
 <div className="orbit-catalog-filters"><label className="orbit-catalog-search"><Search size={18}/><input aria-label={t('Search catalog')} placeholder={t('Search by code, name or category...')} value={search} onChange={e=>setSearch(e.target.value)}/></label><select aria-label={t('Filter by state')} value={state} onChange={e=>setState(e.target.value)}><option value="all">{t('All states')}</option><option value="active">{t('active')}</option><option value="inactive">{t('inactive')}</option></select><select aria-label={t('Filter by type')} value={kind} onChange={e=>setKind(e.target.value)}><option value="all">{t('All types')}</option><option value="product">{t('Product')}</option><option value="service">{t('Service')}</option></select></div>
 <div className="orbit-admin-scroll"><table><thead><tr>{['Code','Name','Category','Type','Base price','VAT','Final price','Inventory','State',...(admin?['Actions']:[])].map(x=><th key={x}>{t(x)}</th>)}</tr></thead><tbody>{shown.map(p=><tr key={p.id}><td><strong>{p.code}</strong></td><td><strong>{p.name}</strong>{p.description&&<small className="orbit-catalog-description">{p.description}</small>}</td><td>{p.category||'—'}</td><td>{t(p.kind==='product'?'Product':'Service')}</td><td className="orbit-catalog-money">{money(p.base_price)}</td><td><span>{t({taxed:'Taxed',exempt:'Exempt',excluded:'Excluded'}[p.tax_treatment]||p.tax_treatment)}</span><small className="orbit-audit-entity">{p.vat_rate}%</small></td><td className="orbit-catalog-money">{money(p.final_price)}</td><td>{t(p.tracks_inventory?'Yes':'No')}</td><td><span className={`orbit-audit-badge orbit-audit-badge--${p.active?'active':'inactive'}`}>{t(p.active?'active':'inactive')}</span></td>{admin&&<td><button className="orbit-admin-btn orbit-admin-btn--small" onClick={()=>edit(p)}><Pencil size={15}/>{t('Edit')}</button></td>}</tr>)}</tbody></table>{(loading||!shown.length)&&<div className="orbit-audit-empty">{t(loading?'Loading catalog...':'No catalog items found.')}</div>}</div>
 </section></main></div>;
}
