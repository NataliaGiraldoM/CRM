import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { AuthService } from '../../services/auth.service';
import { api } from '../../services/access.service';
import { useLanguage } from '../../i18n/LanguageContext';
export default function AccessGuard({children,admin=false}:{children:ReactNode,admin?:boolean}){
 const [state,setState]=useState<'loading'|'ready'|'denied'>('loading');const {t}=useLanguage();
 useEffect(()=>{let mounted=true;api<{user:ReturnType<typeof AuthService.getAuthData>['user']}>('/auth/me').then(({user})=>{
  const {token}=AuthService.getAuthData();if(token&&user)AuthService.saveAuthData(token,user);
  if(mounted)setState(admin&&user?.role!=='admin'?'denied':'ready');
 }).catch(()=>{if(mounted)setState('denied');});return()=>{mounted=false;};},[admin]);
 useEffect(()=>{
  // Activity is sent only after actual keyboard/pointer input, never from dashboard polling.
  let lastSent=0;const activity=()=>{if(state!=='ready'||Date.now()-lastSent<60000)return;lastSent=Date.now();void api('/auth/activity',{method:'POST'}).catch(()=>{});};
  document.addEventListener('pointerdown',activity);document.addEventListener('keydown',activity);
  return()=>{document.removeEventListener('pointerdown',activity);document.removeEventListener('keydown',activity);};
 },[state]);
 if(state==='loading')return <p>{t('Checking access...')}</p>;
 if(state==='denied')return <Navigate to={admin?'/dashboard':'/login'} replace/>;
 return children;
}
