import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { ChartNoAxesCombined, Download, RefreshCw, Search } from 'lucide-react';
import Header from '../components/Header';
import { api } from '../../services/access.service';
import { useLanguage } from '../../i18n/LanguageContext';
import '../styles/audit.scss';

type Customer = { id: string; full_name: string; company?: string; status: string };
type Product = { id: string; code: string; name: string; active: boolean };
type Sale = { id: string; customer_name: string; customer_company?: string; seller_name: string; sale_date: string; status: 'completed' | 'cancelled'; subtotal: string | number; tax_total: string | number; total: string | number; item_count: number };
type Summary = { sales_count: number; revenue: string | number; average_sale: string | number; cancelled_count: number };
type ReportResponse = { sales: Sale[]; summary: Summary };
const localDateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const today = () => localDateString(new Date());
const daysAgo = (days: number) => { const d = new Date(); d.setDate(d.getDate() - days); return localDateString(d); };
const money = (value: unknown) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 2 }).format(Number(value || 0));
const initialSummary: Summary = { sales_count: 0, revenue: 0, average_sale: 0, cancelled_count: 0 };

export default function Reports() {
  const { t, language } = useLanguage();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [from, setFrom] = useState(daysAgo(29));
  const [to, setTo] = useState(today());
  const [customerId, setCustomerId] = useState('');
  const [productId, setProductId] = useState('');
  const [status, setStatus] = useState('all');
  const [search, setSearch] = useState('');
  const [sales, setSales] = useState<Sale[]>([]);
  const [summary, setSummary] = useState<Summary>(initialSummary);
  const [previousSummary, setPreviousSummary] = useState<Summary>(initialSummary);
  const [previousRange, setPreviousRange] = useState({ from: '', to: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasRun, setHasRun] = useState(false);

  async function loadOptions() {
    try {
      const [customerData, productData] = await Promise.all([api<Customer[]>('/customers'), api<Product[]>('/products')]);
      setCustomers(customerData.filter(c => c.status === 'active'));
      setProducts(productData.filter(p => p.active));
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load report filters'); }
  }
  useEffect(() => { void loadOptions(); }, []);

  const buildQuery = (start: string, end: string) => new URLSearchParams({
    ...(start ? { from: start } : {}), ...(end ? { to: end } : {}),
    ...(customerId ? { customer_id: customerId } : {}), ...(productId ? { product_id: productId } : {}), status,
  }).toString();

  async function runReport(event?: FormEvent) {
    event?.preventDefault();
    if (from && to && from > to) { setError(t('Start date must be before end date.')); return; }
    setLoading(true); setError('');
    try {
      const current = await api<ReportResponse>(`/sales/report?${buildQuery(from, to)}`);
      setSales(current.sales); setSummary(current.summary);
      if (from && to) {
        const startDate = new Date(`${from}T12:00:00`);
        const endDate = new Date(`${to}T12:00:00`);
        const periodDays = Math.round((endDate.getTime() - startDate.getTime()) / 86400000) + 1;
        const previousEnd = new Date(startDate); previousEnd.setDate(previousEnd.getDate() - 1);
        const previousStart = new Date(previousEnd); previousStart.setDate(previousStart.getDate() - periodDays + 1);
        const previousFrom = previousStart.toISOString().slice(0, 10);
        const previousTo = previousEnd.toISOString().slice(0, 10);
        const previous = await api<ReportResponse>(`/sales/report?${buildQuery(previousFrom, previousTo)}`);
        setPreviousSummary(previous.summary); setPreviousRange({ from: previousFrom, to: previousTo });
      } else { setPreviousSummary(initialSummary); setPreviousRange({ from: '', to: '' }); }
      setHasRun(true);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not load report'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void runReport(); }, []);

  const shownSales = useMemo(() => sales.filter(s => [s.customer_name, s.customer_company || '', s.seller_name, s.id].some(v => v.toLowerCase().includes(search.trim().toLowerCase()))), [sales, search]);
  const revenueChange = Number(previousSummary.revenue) > 0 ? ((Number(summary.revenue) - Number(previousSummary.revenue)) / Number(previousSummary.revenue)) * 100 : (Number(summary.revenue) > 0 ? null : 0);
  const exportCsv = () => {
    const header = ['Date', 'Sale ID', 'Customer', 'Seller', 'Items', 'Subtotal', 'Tax', 'Total', 'Status'];
    const rows = shownSales.map(s => [new Date(s.sale_date).toLocaleString(language === 'es' ? 'es-CO' : 'en-US'), s.id, s.customer_name, s.seller_name, s.item_count, s.subtotal, s.tax_total, s.total, s.status]);
    const csv = [header, ...rows].map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a'); link.href = url; link.download = `orbit-sales-report-${from || 'all'}-${to || 'all'}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return <div className="orbit-audit-page"><Header /><main className="orbit-admin">
    <div className="orbit-audit-heading"><div><div className="orbit-audit-eyebrow"><ChartNoAxesCombined size={16} />{t('Commercial analysis')}</div><h2>{t('Reports and filters')}</h2><p>{t('Review and compare commercial information by date, customer and product.')}</p></div><div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}><button className="orbit-admin-btn" onClick={() => void runReport()} disabled={loading}><RefreshCw size={17} />{t('Refresh report')}</button><button className="orbit-admin-btn orbit-admin-btn--primary" onClick={exportCsv} disabled={!hasRun || shownSales.length === 0}><Download size={17} />{t('Export CSV')}</button></div></div>
    <form className="orbit-audit-panel" onSubmit={runReport}><div className="orbit-audit-panel-heading"><span className="orbit-audit-section-icon"><Search size={20} /></span><div><h3>{t('Report filters')}</h3><p>{t('Choose one or more filters and run the report.')}</p></div></div><div style={{ padding: 20, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))', gap: 14, alignItems: 'end' }}>
      <label style={{ display: 'grid', gap: 7, minWidth: 0 }}>{t('From')}<input style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }} type="date" value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label style={{ display: 'grid', gap: 7, minWidth: 0 }}>{t('To')}<input style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }} type="date" value={to} onChange={e => setTo(e.target.value)} /></label>
      <label style={{ display: 'grid', gap: 7, minWidth: 0 }}>{t('Customer')}<select style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }} value={customerId} onChange={e => setCustomerId(e.target.value)}><option value="">{t('All customers')}</option>{customers.map(c => <option key={c.id} value={c.id}>{c.full_name}{c.company ? ` — ${c.company}` : ''}</option>)}</select></label>
      <label style={{ display: 'grid', gap: 7, minWidth: 0 }}>{t('Product')}<select style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }} value={productId} onChange={e => setProductId(e.target.value)}><option value="">{t('All products')}</option>{products.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}</select></label>
      <label style={{ display: 'grid', gap: 7, minWidth: 0 }}>{t('Status')}<select style={{ width: '100%', minWidth: 0, boxSizing: 'border-box' }} value={status} onChange={e => setStatus(e.target.value)}><option value="all">{t('All')}</option><option value="completed">{t('Completed')}</option><option value="cancelled">{t('Cancelled')}</option></select></label>
      <button style={{ width: '100%', minWidth: 0, boxSizing: 'border-box', justifyContent: 'center' }} className="orbit-admin-btn orbit-admin-btn--primary" type="submit" disabled={loading}>{loading ? t('Generating report...') : t('Generate report')}</button>
    </div></form>
    {error && <p role="alert">{t(error)}</p>}
    <div className="orbit-audit-stats">{[
      { label: 'Completed sales', value: summary.sales_count, icon: <ChartNoAxesCombined size={23} />, tone: 'blue' },
      { label: 'Revenue', value: money(summary.revenue), icon: <ChartNoAxesCombined size={23} />, tone: 'green' },
      { label: 'Average sale', value: money(summary.average_sale), icon: <ChartNoAxesCombined size={23} />, tone: 'amber' },
    ].map(card => <article className="orbit-audit-stat" key={card.label}><div><p>{t(card.label)}</p><strong style={{ fontSize: typeof card.value === 'string' ? '1.4rem' : '2rem' }}>{card.value}</strong></div><span className={`orbit-audit-stat-icon orbit-audit-stat-icon--${card.tone}`}>{card.icon}</span></article>)}</div>
    <section className="orbit-audit-panel"><div className="orbit-audit-panel-heading"><span className="orbit-audit-section-icon"><ChartNoAxesCombined size={21} /></span><div><h3>{t('Period comparison')}</h3><p>{previousRange.from && previousRange.to ? `${previousRange.from} – ${previousRange.to} ${t('compared with the selected period')}` : t('Select a date range to compare periods.')}</p></div></div><div style={{ padding: 22, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 18 }}><div><p style={{ color: '#64748b', margin: '0 0 8px' }}>{t('Selected period revenue')}</p><strong style={{ fontSize: '1.4rem' }}>{money(summary.revenue)}</strong></div><div><p style={{ color: '#64748b', margin: '0 0 8px' }}>{t('Previous period revenue')}</p><strong style={{ fontSize: '1.4rem' }}>{money(previousSummary.revenue)}</strong></div><div><p style={{ color: '#64748b', margin: '0 0 8px' }}>{t('Revenue change')}</p><strong style={{ fontSize: '1.4rem', color: revenueChange === null ? '#64748b' : revenueChange >= 0 ? '#15803d' : '#b91c1c' }}>{revenueChange === null ? t('No previous revenue to compare') : `${revenueChange > 0 ? '+' : ''}${revenueChange.toFixed(1)}%`}</strong></div></div></section>
    <section className="orbit-audit-panel"><div className="orbit-audit-panel-heading"><span className="orbit-audit-section-icon"><Search size={21} /></span><div><h3>{t('Sales report details')}</h3><p>{t('Sales matching the selected filters. Cancelled sales are excluded from revenue indicators.')}</p></div></div><div style={{ padding: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}><label style={{ display: 'flex', gap: 10, alignItems: 'center', flex: '1 1 260px' }}><Search size={16} /><input style={{ width: '100%' }} placeholder={t('Search customer, seller or sale ID')} value={search} onChange={e => setSearch(e.target.value)} /></label><span style={{ color: '#64748b', fontSize: '.85rem' }}>{t('Records')}: {shownSales.length}</span></div><div className="orbit-admin-scroll"><table><thead><tr>{['Date', 'Sale ID', 'Customer', 'Seller', 'Items', 'Subtotal', 'Tax', 'Total', 'Status'].map(x => <th key={x}>{t(x)}</th>)}</tr></thead><tbody>{shownSales.map(s => <tr key={s.id}><td>{new Date(s.sale_date).toLocaleString(language === 'es' ? 'es-CO' : 'en-US')}</td><td><small>{s.id.slice(0, 8).toUpperCase()}</small></td><td><strong>{s.customer_name}</strong><small style={{ display: 'block' }}>{s.customer_company}</small></td><td>{s.seller_name}</td><td>{s.item_count}</td><td>{money(s.subtotal)}</td><td>{money(s.tax_total)}</td><td><strong>{money(s.total)}</strong></td><td>{t(s.status === 'completed' ? 'Completed' : 'Cancelled')}</td></tr>)}</tbody></table>{(loading || shownSales.length === 0) && <div className="orbit-audit-empty">{t(loading ? 'Generating report...' : 'No sales found.')}</div>}</div></section>
  </main></div>;
}
