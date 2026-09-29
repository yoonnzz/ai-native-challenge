export type Product = {sku:number;name:string;option:string;price:number;stock:number};
export type Customer = {id:number;name:string};
export type CartLine = {sku:number;qty:number;selected:boolean};
export type Address = {id:number;label:string;recipient:string;phone:string;street:string;detail:string;isDefault:boolean};
export type OrderItem = {sku:number;name:string;option:string;price:number;qty:number;canceled:number;discount:number};
export type Order = {id:number;customerId:number;createdAt:string;items:OrderItem[];address:Address;memo:string;subtotal:number;discount:number;shipping:number;total:number;coupon:boolean};
export type CustomerState = {cart:CartLine[];saved:CartLine[];favorites:number[];recent:number[];addresses:Address[];couponUsed:boolean;orders:Order[]};
export type ShopState = {products:Product[];customers:Customer[];users:Record<number,CustomerState>;nextOrderId:number;nextAddressId:number};
export class ShopError extends Error {status:number; constructor(message:string,status=400){super(message);this.status=status;}}
const fail=(message:string):never=>{throw new ShopError(message)};
const integer=(value:unknown,min:number,max=Number.MAX_SAFE_INTEGER)=>Number.isInteger(value)&&Number(value)>=min&&Number(value)<=max;
const getUser=(s:ShopState,id:number)=>s.users[id]??fail('고객을 찾을 수 없습니다.');
const getProduct=(s:ShopState,sku:number)=>s.products.find(p=>p.sku===sku)??fail('상품 옵션을 찾을 수 없습니다.');
const getOrder=(u:CustomerState,id:number)=>u.orders.find(o=>o.id===id)??fail('주문을 찾을 수 없습니다.');
export const emptyUser=():CustomerState=>({cart:[],saved:[],favorites:[],recent:[],addresses:[],couponUsed:false,orders:[]});
export function initialState(data:{products:Product[];customers:Customer[]}):ShopState{return {products:structuredClone(data.products),customers:structuredClone(data.customers),users:Object.fromEntries(data.customers.map(c=>[c.id,emptyUser()])),nextOrderId:1,nextAddressId:1};}
export function status(o:Order){const ordered=o.items.reduce((n,i)=>n+i.qty,0),canceled=o.items.reduce((n,i)=>n+i.canceled,0);return canceled===0?'취소 없음':canceled===ordered?'전체 취소':'일부 취소';}
export function refund(o:Order){const productRefund=o.items.reduce((n,i)=>n+Math.floor((i.price*i.qty-i.discount)*i.canceled/i.qty),0);return productRefund+(status(o)==='전체 취소'?o.shipping:0);}
export function summary(o:Order){return {...o,status:status(o),refund:refund(o),remainingTotal:o.total-refund(o)};}
export function quote(s:ShopState,customerId:number,addressId:number,memo:string,couponInput:string){
 const u=getUser(s,customerId),lines=u.cart.filter(l=>l.selected);if(!lines.length)fail('주문할 상품을 선택하세요.');
 const address=u.addresses.find(a=>a.id===addressId)??fail('배송지를 선택하세요.');
 const items=lines.map(l=>{const p=getProduct(s,l.sku);if(p.stock<l.qty)fail(`${p.name} ${p.option}: 재고가 ${p.stock}개만 남았습니다.`);return {sku:p.sku,name:p.name,option:p.option,price:p.price,qty:l.qty,canceled:0,discount:0};});
 const subtotal=items.reduce((n,i)=>n+i.price*i.qty,0),code=couponInput.trim().toUpperCase(),coupon=code.length>0;
 if(coupon&&code!=='WELCOME3000')fail('쿠폰 코드가 올바르지 않습니다.');
 if(coupon&&u.couponUsed)fail('이미 사용한 쿠폰입니다.');
 if(coupon&&subtotal<30000)fail('쿠폰은 상품 금액 30,000원 이상에 사용할 수 있습니다.');
 const discount=coupon?3000:0,shipping=subtotal>=30000?0:3000;
 if(discount){let allocated=0;for(const item of [...items].sort((a,b)=>a.sku-b.sku)){item.discount=Math.floor(discount*item.price*item.qty/subtotal);allocated+=item.discount;}for(const item of [...items].sort((a,b)=>a.sku-b.sku)){if(allocated===discount)break;item.discount++;allocated++;}}
 return {items,address:structuredClone(address),memo:String(memo??''),subtotal,discount,shipping,total:subtotal-discount+shipping,coupon};
}
function addCart(s:ShopState,u:CustomerState,sku:number,qty:number){if(!integer(qty,1,99))fail('수량은 1~99개여야 합니다.');const p=getProduct(s,sku),line=u.cart.find(l=>l.sku===sku),next=(line?.qty??0)+qty;if(next>99)fail('한 옵션은 최대 99개까지 담을 수 있습니다.');if(p.stock<next)fail(`현재 재고는 ${p.stock}개입니다.`);if(line)line.qty=next;else u.cart.push({sku,qty:next,selected:true});}
function validAddress(input:any):Omit<Address,'id'|'isDefault'>{const label=String(input.label??'').trim(),recipient=String(input.recipient??'').trim(),phone=String(input.phone??'').replace(/[\s-]/g,''),street=String(input.street??'').trim(),detail=String(input.detail??'').trim();if(!label||!recipient||!street)fail('별칭, 받는 사람, 주소는 필수입니다.');if(!/^\d{10,11}$/.test(phone))fail('연락처는 숫자 10~11자리여야 합니다.');return {label,recipient,phone,street,detail};}
export type Action = {type:string;customerId:number;sku?:number;qty?:number;selected?:boolean;addressId?:number;orderId?:number;label?:string;recipient?:string;phone?:string;street?:string;detail?:string;memo?:string;coupon?:string};
export function apply(s:ShopState,a:Action){const u=getUser(s,a.customerId),sku=Number(a.sku),qty=Number(a.qty),addressId=Number(a.addressId),orderId=Number(a.orderId);let message='처리했습니다.';
 switch(a.type){
 case 'favorite.toggle':{getProduct(s,sku);u.favorites=u.favorites.includes(sku)?u.favorites.filter(x=>x!==sku):[sku,...u.favorites];break;}
 case 'recent.add':{getProduct(s,sku);u.recent=[sku,...u.recent.filter(x=>x!==sku)].slice(0,10);break;}
 case 'recent.clear':u.recent=[];break;
 case 'cart.add':addCart(s,u,sku,qty);message='장바구니에 담았습니다.';break;
 case 'cart.qty':{const line=u.cart.find(l=>l.sku===sku)??fail('장바구니 상품을 찾을 수 없습니다.');if(!integer(qty,1,99))fail('수량은 1~99개여야 합니다.');const stock=getProduct(s,sku).stock;if(qty>line.qty&&qty>stock)fail(`현재 재고는 ${stock}개입니다.`);line.qty=qty;break;}
 case 'cart.remove':u.cart=u.cart.filter(l=>l.sku!==sku);break;
 case 'cart.clear':u.cart=[];break;
 case 'cart.select':{const line=u.cart.find(l=>l.sku===sku)??fail('장바구니 상품을 찾을 수 없습니다.');line.selected=Boolean(a.selected);break;}
 case 'cart.selectAll':u.cart.forEach(l=>l.selected=Boolean(a.selected));break;
 case 'saved.move':{const line=u.cart.find(l=>l.sku===sku)??fail('장바구니 상품을 찾을 수 없습니다.');const old=u.saved.find(l=>l.sku===sku);if(old){if(old.qty+line.qty>99)fail('나중에 구매 목록은 옵션당 최대 99개입니다.');old.qty+=line.qty;}else u.saved.push({...line,selected:false});u.cart=u.cart.filter(l=>l.sku!==sku);break;}
 case 'saved.restore':{const line=u.saved.find(l=>l.sku===sku)??fail('나중에 구매 상품을 찾을 수 없습니다.');addCart(s,u,sku,line.qty);u.saved=u.saved.filter(l=>l.sku!==sku);break;}
 case 'address.save':{const v=validAddress(a),existing=u.addresses.find(x=>x.id===addressId);if(a.addressId&&!existing)fail('배송지를 찾을 수 없습니다.');if(existing)Object.assign(existing,v);else u.addresses.push({...v,id:s.nextAddressId++,isDefault:u.addresses.length===0});break;}
 case 'address.delete':{if(!u.addresses.some(x=>x.id===addressId))fail('배송지를 찾을 수 없습니다.');u.addresses=u.addresses.filter(x=>x.id!==addressId);if(u.addresses.length&&!u.addresses.some(x=>x.isDefault))u.addresses[0].isDefault=true;break;}
 case 'address.default':{if(!u.addresses.some(x=>x.id===addressId))fail('배송지를 찾을 수 없습니다.');u.addresses.forEach(x=>x.isDefault=x.id===addressId);break;}
 case 'order.place':{const q=quote(s,a.customerId,addressId,String(a.memo??''),String(a.coupon??''));for(const i of q.items)getProduct(s,i.sku).stock-=i.qty;const order:Order={id:s.nextOrderId++,customerId:a.customerId,createdAt:new Date().toISOString(),...q};u.orders.unshift(order);u.cart=u.cart.filter(l=>!l.selected);if(q.coupon)u.couponUsed=true;message=`주문 #${order.id}이 확정되었습니다.`;return {message,orderId:order.id};}
 case 'order.cancelItem':{const o=getOrder(u,orderId),i=o.items.find(x=>x.sku===sku)??fail('주문 상품을 찾을 수 없습니다.');if(!integer(qty,1,i.qty-i.canceled))fail('취소 가능한 수량을 확인하세요.');i.canceled+=qty;getProduct(s,sku).stock+=qty;if(status(o)==='전체 취소'&&o.coupon)u.couponUsed=false;message=`${qty}개를 취소했습니다.`;break;}
 case 'order.cancelAll':{const o=getOrder(u,orderId);if(status(o)==='전체 취소')fail('이미 전체 취소한 주문입니다.');for(const i of o.items){const remaining=i.qty-i.canceled;i.canceled=i.qty;getProduct(s,i.sku).stock+=remaining;}if(o.coupon)u.couponUsed=false;message='남은 상품을 모두 취소했습니다.';break;}
 case 'order.readd':{const o=getOrder(u,orderId);for(const i of o.items){const p=getProduct(s,i.sku),next=(u.cart.find(l=>l.sku===i.sku)?.qty??0)+i.qty;if(next>99||next>p.stock)fail(`${p.name} ${p.option}: 다시 담을 수 없습니다. 재고 ${p.stock}개, 합산 ${next}개.`);}for(const i of o.items)addCart(s,u,i.sku,i.qty);message='원래 주문 수량을 장바구니에 담았습니다.';break;}
 default:fail('알 수 없는 작업입니다.');
 }return {message};
}
export function view(s:ShopState,customerId:number){const u=getUser(s,customerId);return {products:s.products,customers:s.customers,user:u,orders:u.orders.map(summary),cartTotal:u.cart.reduce((n,l)=>n+getProduct(s,l.sku).price*l.qty,0),selectedTotal:u.cart.filter(l=>l.selected).reduce((n,l)=>n+getProduct(s,l.sku).price*l.qty,0)};}
export function orderSearch(orders:Order[],search:string,filter:string){const q=search.trim().toLowerCase();return orders.filter(o=>(!q||String(o.id).includes(q)||o.items.some(i=>i.name.toLowerCase().includes(q)))&&(filter==='전체'||status(o)===filter));}
export function csv(s:ShopState,customerId:number,search:string,filter:string){const rows=[['주문번호','주문시각','상품','상품금액','쿠폰할인','배송비','최종금액','상태','취소금액']];for(const o of orderSearch(getUser(s,customerId).orders,search,filter))rows.push([String(o.id),o.createdAt,o.items.map(i=>`${i.name} ${i.option} ×${i.qty}`).join(' / '),String(o.subtotal),String(o.discount),String(o.shipping),String(o.total),status(o),String(refund(o))]);return '\ufeff'+rows.map(r=>r.map(v=>'"'+v.replaceAll('"','""')+'"').join(',')).join('\r\n');}
