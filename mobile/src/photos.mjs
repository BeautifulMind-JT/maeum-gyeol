// Photos and journal text are saved to the account only after sign-in. Decode/re-encode before upload to remove EXIF/location data.
export const PHOTO_PATH=/^[0-9a-f-]{36}\/[0-9a-f-]{36}$/i;
export function photoFiles(path){if(!PHOTO_PATH.test(path))throw Error('사진 경로를 확인해주세요.');return [path+'-full.jpg',path+'-thumb.jpg'];}
export async function preparePhoto(file){
 if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('JPG, PNG, WebP 사진을 선택해주세요.');
 if(file.size>15*1024*1024)throw Error('15MB 이하의 사진을 선택해주세요.');
 const url=URL.createObjectURL(file),img=new Image();
 try{
  img.src=url;await img.decode();
  if(!img.naturalWidth||img.naturalWidth*img.naturalHeight>60000000)throw Error('사진 크기를 줄여서 다시 선택해주세요.');
  async function resize(max,limit){
   const ratio=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
   const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*ratio));canvas.height=Math.max(1,Math.round(img.naturalHeight*ratio));
   const context=canvas.getContext('2d');context.fillStyle='#fffaf0';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(img,0,0,canvas.width,canvas.height);
   for(const quality of [.86,.72,.55]){const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));if(blob&&blob.size<=limit)return blob;}
   throw Error('사진을 조금 작게 줄여서 다시 선택해주세요.');
  }
  return {full:await resize(1600,1400000),thumb:await resize(480,240000)};
 }finally{URL.revokeObjectURL(url);}
}

export function createPhotoLoader(getCloud){
 const active=new Map();
 async function hydrate(root=document){
  const cloud=getCloud();if(!cloud)return;
  await Promise.allSettled([...root.querySelectorAll('img[data-photo]')].map(async img=>{
   if(img.dataset.loading)return;img.dataset.loading='true';
   const path=img.dataset.photo,size=img.dataset.photoSize||'thumb';
   try{const blob=await cloud.photo(path,size);if(!img.isConnected||getCloud()!==cloud)return;const url=URL.createObjectURL(blob);active.set(img,url);img.src=url;img.alt='이 순간에 남긴 사진';img.classList.add('uploaded-photo');}
   catch{if(img.isConnected){img.removeAttribute('data-loading');img.alt='사진을 불러오지 못했어요';}}
  }));
 }
 function release(){for(const [img,url] of active){URL.revokeObjectURL(url);active.delete(img);}}
 return {hydrate,release};
}
