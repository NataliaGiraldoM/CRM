import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../services/access.service';
import type { SaleDetail } from '../../services/sales.types';
import { useLanguage } from '../../i18n/LanguageContext';
export default function SaleDetails({id,onClose}:{id:string;onClose:()=>void}) {
 const {t,language}=useLanguage();
 const [sale,setSale]=useState<SaleDetail|null>(null),[error,setError]=useState('');
 const dialog=useRef<HTMLDialogElement>(null);
 useEffect(()=>{let active=true;api<SaleDetail>(`/sales/${id}`).then(s=>{if(active)setSale(s);}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[id]);
 useEffect(()=>{const node=dialog.current;node?.showModal();return()=>node?.close();},[]);
 const money=(n:unknown)=>new Intl.NumberFormat(language==='es'?'es-CO':'en-US',{style:'currency',currency:'COP'}).format(Number(n||0));
 return <dialog ref={dialog} className="orbit-sale-dialog" onCancel={onClose} aria-labelledby="sale-title"><div className="orbit-audit-panel-heading"><h3 id="sale-title">{t('Sale details')}</h3><button className="orbit-admin-btn" onClick={onClose} aria-label={t('Close')}><X size={18}/></button></div>{error?<p role="alert">{t(error)}</p>:!sale?<p>{t('Loading...')}</p>:<><p><strong>{sale.customer_name}</strong> · {new Date(sale.sale_date).toLocaleString(language==='es'?'es-CO':'en-US')}</p><p>{sale.id} · {t(sale.status==='completed'?'Completed':'Cancelled')}</p><p>{t('Seller')}: {sale.seller_name}</p><div className="orbit-admin-scroll"><table><thead><tr>{['Product or service','Quantity','Unit price','VAT rate (%)','Tax','Total'].map(x=><th key={x}>{t(x)}</th>)}</tr></thead><tbody>{sale.items.map(i=><tr key={i.id}><td>{i.product_code} — {i.product_name}</td><td>{i.quantity}</td><td>{money(i.unit_price)}</td><td>{i.vat_rate}%</td><td>{money(i.tax_amount)}</td><td>{money(i.total)}</td></tr>)}</tbody></table></div><p>{t('Subtotal')}: {money(sale.subtotal)} · {t('Tax')}: {money(sale.tax_total)} · <strong>{t('Total')}: {money(sale.total)}</strong></p>{sale.notes&&<p>{t('Notes')}: {sale.notes}</p>}</>}</dialog>;
}
