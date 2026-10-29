import {JWT} from 'google-auth-library';
export function googleJsonClient(env,scopes) {
  const email=env.GCP_CLIENT_EMAIL || env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key=env.GCP_PRIVATE_KEY || env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if(!email || !key)throw Error('Google service configuration missing');
  return new JWT({email,key:key.replace(/\\n/g,'\n'),scopes});
}
export function sheetValuesClient(env,auth=googleJsonClient(env,['https://www.googleapis.com/auth/spreadsheets'])) {
  const url=({spreadsheetId,range})=>`https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
  return {spreadsheets:{values:{
    get:(args,options)=>auth.request({url:url(args),method:'GET',timeout:options?.timeout || 3500,retry:false}),
    append:(args,options)=>auth.request({url:url(args)+':append',method:'POST',params:{valueInputOption:args.valueInputOption,insertDataOption:args.insertDataOption},
      data:args.requestBody,timeout:options?.timeout || 3500,retry:false}),
  }}};
}
export function privateObjectStore(env,auth=googleJsonClient(env,['https://www.googleapis.com/auth/devstorage.read_write'])) {
  const email=env.GCP_CLIENT_EMAIL || env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const project=env.GCP_PROJECT_ID || email.split('@')[1].replace(/\.iam\.gserviceaccount\.com$/u,'');
  if(!/^[a-z][a-z0-9-]{4,40}$/u.test(project))throw Error('Invalid storage project');
  const bucket=project+'-chatbot-preview';
  return {
    async read(name){const r=await auth.request({url:`https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(name)}`,params:{alt:'media'},method:'GET',timeout:2000,retry:false,responseType:'json'});return r.data;},
    async write(name,data){await auth.request({url:`https://storage.googleapis.com/upload/storage/v1/b/${bucket}/o`,params:{uploadType:'media',name},method:'POST',
      headers:{'Content-Type':'application/json'},data:JSON.stringify(data),timeout:2500,retry:false});},
  };
}
