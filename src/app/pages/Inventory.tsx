import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Boxes, Plus, History, RefreshCw, AlertTriangle } from 'lucide-react';
import Header from '../components/Header';
import { api } from '../../services/access.service';
import { AuthService } from '../../services/auth.service';
import { useLanguage } from '../../i18n/LanguageContext';
import '../styles/audit.scss';
import '../styles/products.scss';
type Item={id:string;code:string;name:string;active:boolean;minimum_stock:number;stock:number;movement_count:number};
type Movement={id:string;movement_type:string;quantity:number;before_stock:number;after_stock:number;reason:string;created_at:string;actor_name:string};
function createRequestId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);

    const value = character === "x"
      ? random
      : (random & 0x3) | 0x8;

    return value.toString(16);
  });
}
export default function Inventory(){
 const {t,language}=useLanguage();const admin=AuthService.getAuthData().user?.role==='admin';
 const [items,setItems]=useState<Item[]>([]),[error,setError]=useState(''),[message,setMessage]=useState(''),[loading,setLoading]=useState(true),[selected,setSelected]=useState<Item|null>(null),[mode,setMode]=useState<'move'|'minimum'|'history'|null>(null),[type,setType]=useState('entry'),[quantity,setQuantity]=useState(''),[reason,setReason]=useState(''),[saving,setSaving]=useState(false),[requestId,setRequestId]=useState(''),[history,setHistory]=useState<Movement[]>([]),[page,setPage]=useState(0),[search,setSearch]=useState('');
 async function load(){setLoading(true);try{setItems(await api<Item[]>('/inventory'));}catch(e){setError(e instanceof Error?e.message:'Request failed');}finally{setLoading(false);}}
 useEffect(()=>{void load();},[]);
 useEffect(()=>{if(mode==='history'&&selected){void api<Movement[]>(`/inventory/movements?product_id=${selected.id}&page=${page}`).then(setHistory).catch(e=>setError(e.message));}},[mode,selected,page]);
 function open(item:Item,next:'move'|'minimum'|'history'){setError('');setMessage('');setSelected(item);setMode(next);setType('entry');setQuantity(next==='minimum'?String(item.minimum_stock):'');setReason('');setRequestId(createRequestId());setHistory([]);setPage(0);}
 async function submit(e:FormEvent){e.preventDefault();if(!selected)return;setSaving(true);setError('');try{const value=Number(quantity);
 if(mode==='move')await api('/inventory/movements',{method:'POST',body:JSON.stringify({product_id:selected.id,movement_type:type,quantity:value,expected_stock:selected.stock,reason,request_id:requestId})});
 else await api(`/inventory/${selected.id}/minimum`,{method:'PATCH',body:JSON.stringify({minimum_stock:value,reason})});
 setMode(null);setMessage('Inventory saved successfully');await load();
 }catch(e){setError(e instanceof Error?e.message:'Request failed');}finally{setSaving(false);}}
 const filtered=items.filter(p=>`${p.code} ${p.name}`.toLowerCase().includes(search.trim().toLowerCase()));
 return <div className="orbit-audit-page"><Header/><main className="orbit-admin orbit-catalog"><div className="orbit-audit-heading"><div><div className="orbit-audit-eyebrow"><Boxes size={16}/>{t('Inventory management')}</div><h2>{t('Inventory')}</h2><p>{t('Track stock and review movements for your products.')}</p></div><button className="orbit-admin-btn" onClick={()=>void load()}><RefreshCw size={17}/>{t('Refresh')}</button></div>
 <div className="orbit-audit-stats">{[{label:'Tracked products',value:items.length},{label:'Low stock',value:items.filter(p=>p.active&&p.movement_count>0&&p.stock<=p.minimum_stock).length},{label:'Awaiting initial stock',value:items.filter(p=>p.active&&p.movement_count===0).length}].map(x=><article className="orbit-audit-stat" key={x.label}><div><p>{t(x.label)}</p><strong>{x.value}</strong></div><span className="orbit-audit-stat-icon orbit-audit-stat-icon--blue"><Boxes size={24}/></span></article>)}</div>
 <div className="orbit-audit-notice"><AlertTriangle size={18}/><p>{t('New products start at zero. Register their physical opening balance as an adjustment. Sales are not yet connected to inventory.')}</p></div>
 {error&&<p role="alert">{t(error)}</p>}{message&&<p role="status" className="orbit-catalog-success">{t(message)}</p>}
 {mode&&selected&&<section className="orbit-audit-panel"><div className="orbit-audit-panel-heading"><span className="orbit-audit-section-icon"><Boxes size={21}/></span><div><h3>{t(mode==='move'?'Register movement':mode==='minimum'?'Set minimum stock':'Movement history')}: {selected.name}</h3><p>{selected.code} · {t('Available')}: {selected.stock}</p></div></div>
 {mode==='history'?<><div className="orbit-admin-scroll"><table><thead><tr>{['Date','Type','Quantity','Before','After','Reason','Name'].map(x=><th key={x}>{t(x)}</th>)}</tr></thead><tbody>{history.map(m=><tr key={m.id}><td>{new Date(m.created_at).toLocaleString(language==='es'?'es-CO':'en-US')}</td><td>{t(m.movement_type)}</td><td>{m.quantity}</td><td>{m.before_stock}</td><td>{m.after_stock}</td><td>{m.reason}</td><td>{m.actor_name}</td></tr>)}</tbody></table>{history.length===0&&<div className="orbit-audit-empty">{t('No movements found.')}</div>}</div><div className="orbit-audit-pagination"><button className="orbit-admin-btn" disabled={!page} onClick={()=>setPage(page-1)}>{t('Previous')}</button><span>{t('Page')} {page+1}</span><button className="orbit-admin-btn" disabled={history.length<50} onClick={()=>setPage(page+1)}>{t('Next')}</button><button className="orbit-admin-btn" onClick={()=>setMode(null)}>{t('Close')}</button></div></>:<form className="orbit-catalog-form" onSubmit={submit}><div className="orbit-catalog-fields">{mode==='move'&&<label>{t('Movement type')}<select value={type} onChange={e=>{setType(e.target.value);setRequestId(crypto.randomUUID());}}><option value="entry">{t('entry')}</option><option value="exit">{t('exit')}</option><option value="adjustment">{t('adjustment')}</option></select><small>{t('An adjustment sets the final stock count.')}</small></label>}<label>{t(mode==='minimum'?'Minimum stock':type==='adjustment'?'Final stock':'Quantity')}<input required type="number" min={mode==='move'&&type!=='adjustment'?1:0} max="1000000000" step="1" value={quantity} onChange={e=>{setQuantity(e.target.value);setRequestId(crypto.randomUUID());}}/></label><label className="orbit-catalog-wide">{t('Reason')}<textarea required minLength={5} maxLength={500} value={reason} onChange={e=>{setReason(e.target.value);setRequestId(crypto.randomUUID());}}/></label></div><div className="orbit-catalog-footer"><button type="button" className="orbit-admin-btn" onClick={()=>setMode(null)} disabled={saving}>{t('Cancel')}</button><button className="orbit-admin-btn orbit-admin-btn--primary" disabled={saving}>{t(saving?'Saving...':'Save')}</button></div></form>}</section>}
 <section className="orbit-audit-panel"><div className="orbit-audit-panel-heading"><span className="orbit-audit-section-icon"><Boxes size={21}/></span><div><h3>{t('Stock overview')}</h3><p>{t('Only products marked for inventory tracking appear here.')}</p></div></div><div className="orbit-catalog-filters"><input aria-label={t('Search inventory')} placeholder={t('Search by code or name...')} value={search} onChange={e=>setSearch(e.target.value)}/></div><div className="orbit-admin-scroll"><table><thead><tr>{['Code','Name','Available','Minimum stock','State','Actions'].map(x=><th key={x}>{t(x)}</th>)}</tr></thead><tbody>{filtered.map(item=><tr key={item.id}><td>{item.code}</td><td>{item.name}</td><td><strong>{item.stock}</strong></td><td>{item.minimum_stock}</td><td><span className={`orbit-audit-badge orbit-audit-badge--${!item.active?'inactive':item.movement_count===0?'pending':item.stock<=item.minimum_stock?'pending':'active'}`}>{t(!item.active?'inactive':item.movement_count===0?'Not initialized':item.stock<=item.minimum_stock?'Low stock':'In stock')}</span></td><td><button className="orbit-admin-btn orbit-admin-btn--small" onClick={()=>open(item,'history')}><History size={15}/>{t('History')}</button>{admin&&item.active&&<><button className="orbit-admin-btn orbit-admin-btn--small" onClick={()=>open(item,'move')}><Plus size={15}/>{t('Movement')}</button><button className="orbit-admin-btn orbit-admin-btn--small" onClick={()=>open(item,'minimum')}>{t('Minimum')}</button></>}</td></tr>)}</tbody></table>{(loading||filtered.length===0)&&<div className="orbit-audit-empty">{t(loading?'Loading inventory...':'No inventory products found.')}</div>}</div></section></main></div>;
}
