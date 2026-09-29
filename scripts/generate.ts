import {DatabaseSync} from 'node:sqlite';
import {readFileSync,existsSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {initialState,apply,quote,status,refund,type Product,type Customer} from '../server/core.ts';
const names=['코튼 티셔츠','스트라이프 셔츠','니트 가디건','데님 팬츠','린넨 셔츠','캔버스백','크로스백','미니 파우치','세라믹 머그','유리컵','스테인리스 텀블러','에코 보틀','베이직 볼캡','울 양말','면 손수건','하드커버 노트','위클리 플래너','접이식 우산','노트북 거치대','책상 조명'];
const options=['크림 / 기본형','블랙 / 기본형','네이비 / 기본형','베이지 / 기본형','올리브 / 기본형','화이트 / 기본형','그레이 / 기본형','브라운 / 기본형','블루 / 기본형','코랄 / 기본형'];
const products:Product[]=names.flatMap((name,i)=>options.map((option,j)=>({sku:1001+i*10+j,name,option,price:8000+i*1900+j*500,stock:200})));
const surnames=['김','이','박','최','정','강','조','윤','장','임'];const given=['서연','민준','지우','도윤','하린','서준','수빈','지호','채원','준서'];
const customers:Customer[]=surnames.flatMap((surname,i)=>given.map((name,j)=>({id:1001+i*10+j,name:surname+name})));
const s=initialState({products,customers});let made=0,canceled=0;
for(const c of customers){const address=apply(s,{type:'address.save',customerId:c.id,label:'집',recipient:c.name,phone:'01012345678',street:`서울특별시 중구 테스트로 ${c.id%100+1}`,detail:'101호'});void address;const addressId=s.users[c.id].addresses[0].id;
 for(let n=0;n<8;n++){const sku=products[((c.id-1001)*8+n)%products.length].sku;apply(s,{type:'cart.add',customerId:c.id,sku,qty:2});const confirmationKey=quote(s,c.id,addressId,'','').confirmationKey;const placed=apply(s,{type:'order.place',customerId:c.id,addressId,memo:'',coupon:'',confirmationKey});made++;if(n%5===1){apply(s,{type:'order.cancelItem',customerId:c.id,orderId:placed.orderId,sku,qty:1});canceled++}if(n%5===2){apply(s,{type:'order.cancelAll',customerId:c.id,orderId:placed.orderId});canceled++}}
}
if(products.length!==200||customers.length!==100||made!==800||s.nextOrderId!==801)throw Error('생성 건수가 맞지 않습니다.');
for(const p of s.products){const sold=Object.values(s.users).flatMap(u=>u.orders).flatMap(o=>o.items).filter(i=>i.sku===p.sku).reduce((n,i)=>n+i.qty-i.canceled,0);if(p.stock!==200-sold)throw Error(`SKU ${p.sku} 재고 불일치`)}
for(const o of Object.values(s.users).flatMap(u=>u.orders)){if(refund(o)>o.total)throw Error('취소 금액 초과');if(!['취소 없음','일부 취소','전체 취소'].includes(status(o)))throw Error('상태 오류')}
const output=resolve(process.argv[2]??'data/test.sqlite');if(existsSync(output))throw Error(`${output} 파일이 이미 있습니다. 기존 자료 보존을 위해 중단합니다. 새 경로를 지정하세요.`);mkdirSync(resolve(output,'..'),{recursive:true});const db=new DatabaseSync(output);db.exec('CREATE TABLE shop (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL)');db.prepare('INSERT INTO shop(id,data) VALUES(1,?)').run(JSON.stringify(s));db.close();console.log(JSON.stringify({output,productOptions:products.length,customers:customers.length,orders:made,canceledOrders:canceled,stockVerified:true,refundVerified:true},null,2));
