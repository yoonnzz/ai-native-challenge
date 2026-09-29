from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import landscape, A4
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/'과제설명.pdf'
pdfmetrics.registerFont(TTFont('AppleGothic','/System/Library/Fonts/Supplemental/AppleGothic.ttf'))
W,H=landscape(A4)
GREEN=HexColor('#245b3a'); DARK=HexColor('#1c2b22'); MUTED=HexColor('#5e7164'); LIGHT=HexColor('#eef3ec')
slides=[
('목적','작은 쇼핑몰의 구매자용 웹앱',['상품을 찾고 찜한 뒤 장바구니에 담고, 배송지와 쿠폰을 선택해 주문한다.','주문 확인, 전체·일부 취소, 다시 담기까지 한 앱에서 연결한다.','핵심 목표: 정책 충돌과 재고·금액·고객별 자료 오류를 줄인다.','실제 결제 대신 모의 주문 확정 버튼을 제공한다.'], 'PRD.md의 사용자 승인 목적과 PROBLEM.md 범위를 따름'),
('범위','제공 데이터와 제출 범위',['초기 데이터: 상품 11종, 옵션 30개, 고객 4명.','로그인·실제 결제·환불·배송 추적·외부 서비스는 범위에서 제외한다.','로컬 웹앱, 데이터 생성 코드, 전체 SPEC, API 문서, 제출 기록을 포함한다.','기존 PROBLEM.md와 initial-data.json은 보존한다.'], '문서화 완료 / 구현 결과는 뒤 페이지에 구분해 표시'),
('정책 1','요구사항 충돌 4건',['7 ↔ 26: 장바구니 담기와 재고 차감 시점이 충돌한다.','15 ↔ 27: 무료 배송 기준이 할인 전·후로 다르다.','22 ↔ 28: 전체 취소 주문 기록을 보존할지 삭제할지 충돌한다.','24 ↔ 29: 다시 담기가 장바구니 이동인지 즉시 주문인지 충돌한다.'], '사용자가 네 건 모두 처리 기준을 승인함'),
('정책 2','재고와 배송비 결정',['장바구니 담기는 재고를 확보하거나 차감하지 않는다.','모의 주문 확정 시 현재 재고를 다시 확인하고 성공 시 차감한다.','먼저 확정에 성공한 주문에 재고를 배정한다.','무료 배송은 쿠폰 할인 전 상품 금액 30,000원 이상을 기준으로 한다.'], 'SPEC 001·002 / 주문 실패 시 저장 자료 유지'),
('정책 3','취소와 다시 담기 결정',['전체 취소 주문도 내역에 남긴다.','다시 담기는 최초 수량을 장바구니에 넣고, 주문 확정은 별도로 한다.','일부 취소 시 할인 배분액을 반영하고 배송비를 새로 청구하지 않는다.','전체 취소 시 최초 배송비를 돌려주고 사용 쿠폰을 복원한다.'], 'SPEC 002 / 주문 당시 상품·가격·배송 정보는 스냅샷으로 보존'),
('구현 1','고객의 전체 흐름',['상품 탐색 → 검색·필터·정렬 → 찜 또는 장바구니 담기','장바구니 선택·수량 조정 → 배송지·쿠폰 선택 → 금액 확인','모의 주문 확정 → 주문 검색·상세 → 부분 또는 전체 취소','이전 주문을 다시 담아 새로운 주문을 준비할 수 있다.'], '브라우저에서 연결된 화면으로 제공'),
('구현 2','상품과 장바구니',['옵션별 이름·가격·재고·품절을 표시한다.','검색은 상품명·옵션을 대상으로 하고 필터·정렬과 함께 적용한다.','같은 옵션을 다시 담으면 한 줄로 합치고 1~99개로 제한한다.','전체 상품 금액과 선택 상품 금액을 구분한다.'], '초기 데이터 30개 옵션 렌더링 확인'),
('구현 3','배송지와 주문 확인',['고객별 배송지 등록·수정·삭제와 기본 배송지 지정을 제공한다.','주문 확인에 상품·수량·받는 사람·주소·메모·할인·배송비를 표시한다.','쿠폰 WELCOME3000은 조건 충족 시 3,000원 할인한다.','주문 확정 시 재고·쿠폰을 다시 확인하고 한 번에 저장한다.'], '브라우저에서 배송지 등록 → 주문 확정 흐름 확인'),
('구현 4','주문·취소·저장',['내 주문을 최신순으로 보고 번호·상품명·상태로 찾는다.','상품별 일부 취소와 남은 상품 전체 취소 후 재고를 복구한다.','취소 금액과 주문 상태를 기록하고 전체 취소 주문도 유지한다.','SQLite에 고객별 장바구니·찜·배송지·주문·재고를 저장한다.'], 'API와 핵심 계산 로직의 자동 검사를 수행함'),
('추가 기능 1','반복 쇼핑을 돕는 기능',['ADD-01 기본 배송지: 고객별 하나를 지정하고 주문 준비에 자동 선택한다.','ADD-02 최근 본 상품: 옵션 10개까지 저장하고 목록 조회·전체 삭제를 제공한다.','등록 직후 기본 배송지 자동 선택 오류를 브라우저 검사에서 발견했다.','수정 후 별도 초기 DB에서 주문 완료까지 다시 확인했다.'], 'SPEC 003·006'),
('추가 기능 2','상품 보관과 내역 다운로드',['ADD-03 나중에 구매: 장바구니 줄을 분리하고 다시 복원한다.','ADD-04 주문 CSV: 현재 주문 검색·상태 필터 결과를 다운로드한다.','CSV에는 금액과 취소 상태를 담고 배송 개인정보는 제외한다.','두 기능은 기존 찜·주문 검색과 구분되는 추가 요구사항이다.'], 'SPEC 003 / API 문서에 동작 기재'),
('데이터 1','제공 초기 데이터 사용',['상품 옵션 30개와 고객 4명을 initial-data.json에서 읽는다.','SKU 1~30, 옵션별 가격·초기 재고·고객 번호를 유지한다.','장바구니·주문·찜·배송지는 빈 상태로 시작한다.','초기 앱 DB는 처음 실행할 때 제공 JSON으로 생성한다.'], '초기 JSON은 수정하지 않음'),
('데이터 2','별도 대량 테스트 데이터',['상품 옵션 200개 + 고객 100명 + 주문 800건 = 1,100건.','실제 사용 가능한 상품명·색상 옵션·가상 고객 이름을 사용한다.','정상·일부 취소·전체 취소 주문을 섞어 생성한다.','초기 DB와 test.sqlite를 분리해 실행한다.'], '생성 결과: 취소가 포함된 주문 400건 / 초기 데이터 미포함'),
('검증','실행 전 기대와 실제 결과',['기대: 19,000원 + 12,000원 주문에서 쿠폰 3,000원, 배송비 0원, 최종 28,000원.','실제: 자동 검사에서 상품 금액 31,000원·할인 3,000원·배송비 0원·최종 28,000원.','기대: 전체 취소 시 전액 반환·재고 복구·쿠폰 복원·주문 보존. 실제: 네 항목 일치.','브라우저: 상품 30개, 검색 3개, 품절 4개, 배송지 등록·주문 확정 성공.'], '자동 검사 5건 통과 / 사람의 직접 화면 확인은 아직 미수행'),
('실행','로컬 실행과 문서',['npm install → npm run server → npm run dev 순서로 실행한다.','기본 화면: http://127.0.0.1:5173 / API: http://127.0.0.1:3001','npm test, npm run build, npm run generate로 검사·생성을 반복한다.','API 사용법은 docs/API.md, 세부 판단과 결과는 specs/에 기록한다.'], '실제 결제 및 공개 배포 없음'),
('현황','완료와 남은 직접 확인',['구현: 구매자 화면, 고객별 자료, 주문·취소, 추가 기능 4개, 생성 코드.','AI 검사: 핵심 정책 테스트 5건, 빌드, 대량 데이터 정합성, 브라우저 구매 흐름.','사람 확인: 사용자가 최소 한 사례를 화면에서 직접 조작해 기대값과 대조해야 한다.','제출 기록은 SUBMISSION.md에서 완료·미확인을 구분해 관리한다.'], '현재 문서는 실행 결과와 미확인 사항을 구분해 작성함'),
]
assert len(slides)==16
c=canvas.Canvas(str(OUTPUT),pagesize=(W,H),pageCompression=1)
c.setTitle('구매자용 온라인 쇼핑몰 과제 설명')
def lines(text,maxwidth,size):
 words=text.split(' ');out=[];line=''
 for word in words:
  cand=(line+' '+word).strip()
  if pdfmetrics.stringWidth(cand,'AppleGothic',size)>maxwidth and line:out.append(line);line=word
  else:line=cand
 if line:out.append(line)
 return out
for idx,(section,title,bullets,foot) in enumerate(slides,1):
 c.setFillColor(HexColor('#f9fbf8'));c.rect(0,0,W,H,fill=1,stroke=0)
 c.setFillColor(GREEN);c.rect(0,H-13,W,13,fill=1,stroke=0)
 c.setFont('AppleGothic',12);c.drawString(48,H-54,section)
 c.setFillColor(DARK);c.setFont('AppleGothic',29);c.drawString(48,H-100,title)
 c.setStrokeColor(HexColor('#cedcce'));c.line(48,H-115,W-48,H-115)
 y=H-160
 for bullet in bullets:
  c.setFillColor(GREEN);c.circle(57,y+3,4,fill=1,stroke=0)
  c.setFillColor(DARK);c.setFont('AppleGothic',15)
  for line in lines(bullet,W-135,15):
   c.drawString(75,y,line);y-=25
  y-=22
 c.setFillColor(LIGHT);c.roundRect(48,45,W-96,42,8,fill=1,stroke=0)
 c.setFont('AppleGothic',11);c.setFillColor(MUTED)
 c.drawString(61,61,foot)
 c.setFillColor(MUTED);c.setFont('AppleGothic',9);c.drawString(49,23,'구매자용 온라인 쇼핑몰 · 과제 설명');c.drawRightString(W-48,23,f'{idx:02d} / 16')
 c.showPage()
c.save();print(OUTPUT)
