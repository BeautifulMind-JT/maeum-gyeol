import assets from './assets.mjs';
import {handleApi} from './api.mjs';
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname.startsWith('/api/'))return handleApi(request,env);
 if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
 const configAsset=assets['/mobile/cloud-config.json'];
 const hasCloud=configAsset&&JSON.parse(atob(configAsset.data)).url;
 if(hasCloud&&url.pathname==='/')return Response.redirect(new URL('/mobile/'+url.search,url),307);
 if(hasCloud&&url.pathname==='/delete-account')return Response.redirect(new URL('/mobile/#account',url),307);
 if(url.pathname==='/legacy')return Response.redirect(new URL('/legacy/',url),308);
 if(url.pathname==='/mobile')return Response.redirect(new URL('/mobile/',url),308);
 const path=['/','/delete-account','/legacy/'].includes(url.pathname)?'/index.html':url.pathname==='/mobile/'?'/mobile/index.html':url.pathname;
 const asset=assets[path];
 if(!asset)return new Response('Not found',{status:404,headers:{'Cache-Control':'no-store'}});
 const bytes=Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0));
 return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset.type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});
}};
