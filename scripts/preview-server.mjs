import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createChatPipeline } from '../lib/chatPipeline.js';
import { parseWorkbook } from '../lib/drive-knowledge.js';
import { getStoreContact } from '../lib/store-contact.js';
const port=Number(process.env.PORT || 8787);
const snapshot=process.env.PREVIEW_FAQ_FILE ? await parseWorkbook(await fs.readFile(process.env.PREVIEW_FAQ_FILE)) : null;
const pipeline=createChatPipeline(snapshot ? {knowledge:async()=>({status:'ready',data:snapshot})} : {});
const publicDir=path.resolve('public');
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png'};
http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 try {
  if(url.pathname==='/api/chat'&&req.method==='POST'){
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>20000)return json(413,{reply:'Frågan är för stor.'});}
   const result=await pipeline({body:JSON.parse(raw),headers:req.headers,socket:req.socket});return json(result.via==='rate-limit'?429:200,{...result,source:result.via==='faq'?'FAQ':result.via});
  }
  if(url.pathname==='/api/contact')return json(200,await getStoreContact({lang:url.searchParams.get('lang')}));
  if(url.pathname.startsWith('/api/'))return json(404,{error:'Not found'});
  const target=path.resolve(publicDir,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));
  if(!target.startsWith(publicDir+path.sep))return json(403,{error:'Forbidden'});
  let content=await fs.readFile(target);
  if(snapshot&&target.endsWith('index.html'))content=Buffer.from(content.toString().replace('<h1>🤖 Chatbot</h1>','<h1>Chatbot – lokal förhandsvisning</h1><p>FAQ från en hämtad Excel-kopia. Google-anslutning och AI är ännu inte verifierade.</p>'));
  res.writeHead(200,{'Content-Type':(mime[path.extname(target)]||'application/octet-stream')+'; charset=utf-8'});res.end(content);
 } catch {json(500,{reply:'Tjänsten kunde inte svara. Försök igen.'});}
}).listen(port,'127.0.0.1',()=>console.log(`Preview listening on http://127.0.0.1:${port}; snapshot=${!!snapshot}`));
