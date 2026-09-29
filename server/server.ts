import {createServer} from 'node:http';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,extname} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {initialState,apply,quote,view,csv,ShopError,type ShopState,type Action} from './core.ts';
const dbPath=resolve(process.env.SHOP_DB??'data/shop.sqlite');mkdirSync(resolve(dbPath,'..'),{recursive:true});
const db=new DatabaseSync(dbPath);db.exec('PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS shop (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)');
let state:ShopState;const existing=db.prepare('SELECT data FROM shop WHERE id=1').get() as {data:string}|undefined;
if(existing)state=JSON.parse(existing.data);else{const seed=JSON.parse(readFileSync(resolve('initial-data.json'),'utf8'));state=initialState(seed);db.prepare('INSERT INTO shop(id,data) VALUES(1,?)').run(JSON.stringify(state));}
function send(res:any,status:number,data:unknown,contentType='application/json; charset=utf-8'){res.writeHead(status,{'Content-Type':contentType,'Cache-Control':'no-store'});res.end(typeof data==='string'||Buffer.isBuffer(data)?data:JSON.stringify(data));}
async function body(req:any){let text='';for await(const part of req){text+=part;if(text.length>100000)throw new ShopError('요청이 너무 큽니다.',413);}try{return JSON.parse(text)}catch{throw new ShopError('JSON 요청을 확인하세요.')}}
const server=createServer(async(req,res)=>{try{const url=new URL(req.url??'/',`http://${req.headers.host??'localhost'}`),path=url.pathname,id=Number(url.searchParams.get('customerId'));
 if(path==='/api/health')return send(res,200,{ok:true,dbPath});
 if(path==='/api/state'&&req.method==='GET')return send(res,200,view(state,id));
 if(path==='/api/quote'&&req.method==='POST'){const input=await body(req);return send(res,200,quote(state,Number(input.customerId),Number(input.addressId),String(input.memo??''),String(input.coupon??'')));}
 if(path==='/api/action'&&req.method==='POST'){const a=await body(req) as Action;const next=structuredClone(state);const result=apply(next,a);db.exec('BEGIN IMMEDIATE');try{db.prepare('UPDATE shop SET data=? WHERE id=1').run(JSON.stringify(next));db.exec('COMMIT');state=next;}catch(e){db.exec('ROLLBACK');throw e;}return send(res,200,{...result,state:view(state,Number(a.customerId))});}
 if(path==='/api/orders.csv'&&req.method==='GET'){const data=csv(state,id,url.searchParams.get('search')??'',url.searchParams.get('filter')??'전체');res.setHeader('Content-Disposition','attachment; filename="orders.csv"');return send(res,200,data,'text/csv; charset=utf-8');}
 if(req.method==='GET'&&!path.startsWith('/api/')){const dist=resolve('dist'),target=resolve(dist,path==='/'?'index.html':'.'+path);if(!target.startsWith(dist+'/')&&!target.endsWith('/dist'))throw new ShopError('잘못된 경로입니다.',404);const file=existsSync(target)?target:resolve(dist,'index.html');if(existsSync(file)){const type:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'};return send(res,200,readFileSync(file),type[extname(file)]??'application/octet-stream');}}
 throw new ShopError('주소를 찾을 수 없습니다.',404);
 }catch(e){const err=e as Error;send(res,e instanceof ShopError?e.status:500,{error:err.message});}});
const port=Number(process.env.PORT??3001);server.listen(port,'127.0.0.1',()=>console.log(`API http://127.0.0.1:${port} | DB ${dbPath}`));
