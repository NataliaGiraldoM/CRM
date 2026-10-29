import { API_BASE } from './api-url';
import { AuthService } from './auth.service';
export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
 const {token}=AuthService.getAuthData();
 const response=await fetch(`${API_BASE}${path}`,{...options,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...options.headers}});
 const data=await response.json().catch(()=>({message:`HTTP ${response.status}: empty response`}));
 if(response.status===401){AuthService.clearAuthData();window.location.assign('/login');throw new Error('Session expired');}
 if(!response.ok)throw new Error(data.message||'Request failed');return data;
}

export async function download(path: string, filename: string): Promise<void> {
 const {token}=AuthService.getAuthData();
 const response=await fetch(`${API_BASE}${path}`,{headers:{Authorization:`Bearer ${token}`}});
 if(response.status===401){AuthService.clearAuthData();window.location.assign('/login');throw new Error('Session expired');}
 if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.message||'Could not export report');}
 const url=URL.createObjectURL(await response.blob());const link=document.createElement('a');
 link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
