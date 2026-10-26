import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { AuthService } from '../../services/auth.service';
import { api } from '../../services/access.service';
import { useLanguage } from '../../i18n/LanguageContext';
import '../styles/audit.scss';
export default function Profile(){
 const {t}=useLanguage();const navigate=useNavigate();const initial=AuthService.getAuthData().user;
 const [name,setName]=useState(initial?.name||'');const [email,setEmail]=useState(initial?.email||'');const [error,setError]=useState('');const [saved,setSaved]=useState(false);const [saving,setSaving]=useState(false);
 async function submit(e:React.FormEvent){e.preventDefault();setError('');setSaved(false);setSaving(true);try{const result=await api<{user:NonNullable<typeof initial>}>('/auth/profile',{method:'PATCH',body:JSON.stringify({name,email})});const {token}=AuthService.getAuthData();if(token)AuthService.saveAuthData(token,result.user);setName(result.user.name);setEmail(result.user.email);setSaved(true);}catch(e){setError(e instanceof Error?e.message:'Unable to save profile');}finally{setSaving(false);}}
 return <div className="orbit-audit-page"><Header/><main className="orbit-admin"><div className="orbit-audit-heading"><div><h2>{t('Edit Profile')}</h2><p>{t('Update your account details.')}</p></div></div><form className="orbit-access-form" onSubmit={submit}><label>{t('Full Name')}<input value={name} onChange={e=>setName(e.target.value)} required minLength={2} maxLength={100}/></label><label>{t('Email')}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required maxLength={150}/></label>{error&&<p role="alert">{t(error)}</p>}{saved&&<p role="status">{t('Profile saved successfully')}</p>}<p><button className="orbit-admin-btn orbit-admin-btn--primary" disabled={saving}>{t(saving?'Saving...':'Save')}</button><button type="button" className="orbit-admin-btn" onClick={()=>navigate('/dashboard')}>{t('Cancel')}</button></p></form></main></div>;
}
