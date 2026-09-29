import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';

test('대량 데이터 생성은 주문 800건을 저장하고 기존 DB를 덮어쓰지 않는다',()=>{
 const dir=mkdtempSync(join(tmpdir(),'shop-generate-test-'));
 const path=join(dir,'test.sqlite');
 try{
  const run=()=>spawnSync(process.execPath,['--experimental-strip-types','scripts/generate.ts',path],{encoding:'utf8'});
  const first=run();
  assert.equal(first.status,0,first.stderr);
  const result=JSON.parse(first.stdout);
  assert.deepEqual([result.productOptions,result.customers,result.orders,result.canceledOrders],[200,100,800,400]);
  assert.equal(result.stockVerified,true);
  assert.equal(result.refundVerified,true);
  const db=new DatabaseSync(path);
  const row=db.prepare('SELECT data FROM shop WHERE id=1').get() as {data:string};
  db.close();
  const state=JSON.parse(row.data);
  assert.equal(state.products.length,200);
  assert.equal(state.customers.length,100);
  assert.equal(Object.values(state.users).reduce((n:number,u:any)=>n+u.orders.length,0),800);
  const second=run();
  assert.notEqual(second.status,0);
  assert.match(second.stderr,/파일이 이미 있습니다/);
 }finally{rmSync(dir,{recursive:true,force:true})}
});
