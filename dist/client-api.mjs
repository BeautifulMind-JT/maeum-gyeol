export async function api(path,{method='GET',body}={}){
 let response;
 try{response=await fetch(path,{method,credentials:'same-origin',headers:body?{'Content-Type':'application/json','X-Maeum-Request':'1'}:method==='GET'?{}:{'X-Maeum-Request':'1'},body:body?JSON.stringify(body):undefined});}
 catch{throw Object.assign(new Error('연결하지 못했어요. 작성한 내용은 그대로 두고 다시 시도해주세요.'),{status:0});}
 let data;try{data=await response.json();}catch{throw new Error('응답을 읽지 못했어요. 잠시 후 다시 시도해주세요.');}
 if(!response.ok)throw Object.assign(new Error(data.error||'요청을 처리하지 못했어요.'),{status:response.status});
 return data;
}
export function signInPath(returnTo='/#journal'){if(globalThis.location?.pathname.startsWith('/legacy'))returnTo='/legacy/'+returnTo.replace(/^\//,'');return '/signin-with-chatgpt?return_to='+encodeURIComponent(returnTo);}
