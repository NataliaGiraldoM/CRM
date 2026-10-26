import { AuthService } from './auth.service';
export async function api<T>(path:string,options:RequestInit={}):Promise<T>{
 const {token}=AuthService.getAuthData();
 const response=await fetch(`/api${path}`,{...options,headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`,...options.headers}});
 const data=await response.json().catch(()=>({message:`HTTP ${response.status}: empty response`}));
 if(response.status===401){AuthService.clearAuthData();window.location.assign('/login');throw new Error('Session expired');}
 if(!response.ok)throw new Error(data.message||'Request failed');return data;
}
