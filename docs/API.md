# 구매자 쇼핑몰 API

로컬 기본 주소: `http://127.0.0.1:3001`. 모든 요청과 응답은 UTF-8 JSON이며, CSV 엔드포인트만 `text/csv`입니다. 실제 인증은 과제 범위 밖입니다. `customerId`에는 초기 데이터 기준 1~4를 사용합니다. 별도 테스트 DB에서는 1001~1100을 사용합니다. 실패 시 HTTP 400 또는 404와 `{ "error": "이유" }`를 반환합니다.

## 읽기

| 방식 | 경로 | 설명 |
|---|---|---|
| GET | `/api/health` | 서버 상태와 DB 경로 |
| GET | `/api/state?customerId=1` | 전체 상품·고객 목록, 선택 고객의 장바구니·찜·배송지·최근 본 상품·나중에 구매·쿠폰 사용·주문, 장바구니 전체/선택 합계 |
| POST | `/api/quote` | 주문 확정 전 현재 재고·쿠폰 확인과 가격·배송 정보 계산. 저장 자료는 변경하지 않음 |
| GET | `/api/orders.csv?customerId=1&search=머그컵&filter=전체` | 현재 주문 검색·상태 필터 결과의 CSV. 배송 개인정보 제외, UTF-8 BOM 포함 |

`/api/quote` 요청 예시:

```json
{"customerId":1,"addressId":1,"memo":"문 앞","coupon":"WELCOME3000"}
```

응답에는 `items`, `address`, `memo`, `subtotal`, `discount`, `shipping`, `total`, `coupon`, `confirmationKey`가 들어갑니다. 배송비는 쿠폰 할인 전 상품 금액이 30,000원 이상이면 0원, 미만이면 3,000원입니다. 쿠폰은 기준 충족 시 3,000원 할인입니다. 상품·수량·배송 정보가 바뀌면 `/api/quote`를 다시 호출해야 합니다.

## 변경

모든 변경은 `POST /api/action`으로 보냅니다. 공통 필드 `type`, `customerId`가 필요합니다. 성공 응답은 `{ "message": "...", "state": {...} }`이며 주문 확정에는 `orderId`가 추가됩니다. 서버는 변경 전체를 하나의 SQLite 트랜잭션으로 저장합니다. 실패한 요청은 저장하지 않습니다.

| `type` | 추가 필드 | 동작 |
|---|---|---|
| `favorite.toggle` | `sku` | 찜 추가·해제 |
| `recent.add` | `sku` | 최근 본 상품 맨 앞에 저장, 최대 10개 |
| `recent.clear` | 없음 | 최근 본 상품 전체 삭제 |
| `cart.add` | `sku`, `qty` | 같은 옵션 한 줄로 합침, 신규 줄 기본 선택 |
| `cart.qty` | `sku`, `qty` | 줄 수량 변경, 1~99 |
| `cart.remove` | `sku` | 줄 삭제 |
| `cart.clear` | 없음 | 장바구니 전체 비우기 |
| `cart.select` | `sku`, `selected` | 줄 선택·해제 |
| `cart.selectAll` | `selected` | 전체 선택·해제 |
| `saved.move` | `sku` | 장바구니에서 나중에 구매로 이동 |
| `saved.restore` | `sku` | 나중에 구매에서 장바구니로 복원 |
| `address.save` | `label`, `recipient`, `phone`, `street`, `detail`, 선택적 `addressId` | 배송지 추가·수정. 첫 등록은 기본 배송지. `addressId`가 있으면 수정 |
| `address.delete` | `addressId` | 배송지 삭제. 기본 배송지 삭제 시 첫 배송지를 기본으로 지정 |
| `address.default` | `addressId` | 기본 배송지 지정 |
| `order.place` | `addressId`, `memo`, `coupon`, `confirmationKey` | 직전 확인 내용과 현재 주문 내용이 일치할 때만 확정. 재고·쿠폰 재검사 후 재고 차감, 쿠폰 사용 및 장바구니 선택 줄 삭제를 한 번에 처리 |
| `order.cancelItem` | `orderId`, `sku`, `qty` | 해당 주문 옵션의 남은 수량 일부 취소, 재고 복구 |
| `order.cancelAll` | `orderId` | 해당 주문에서 아직 취소하지 않은 수량 전부 취소, 주문 기록 보존 |
| `order.readd` | `orderId` | 최초 주문 수량을 현재 장바구니에 다시 담음. 재고 부족이나 99개 초과 시 전체 거절 |

주문 예시:

```json
{"type":"order.place","customerId":1,"addressId":1,"memo":"문 앞","coupon":"WELCOME3000","confirmationKey":"/api/quote 응답의 confirmationKey"}
```

취소 예시:

```json
{"type":"order.cancelItem","customerId":1,"orderId":1,"sku":1,"qty":1}
```

## 주요 정책

- 장바구니는 재고를 확보하지 않습니다. 담기·수량 증가 시 현재 재고 이상으로 늘릴 수 없고, 다른 고객이 먼저 주문해 재고가 줄면 줄은 남아 부족을 표시합니다. 주문 확정 때 모든 선택 줄의 재고를 다시 확인하며 부족하면 주문 전체를 거절합니다.
- `WELCOME3000`은 앞뒤 공백과 대소문자 차이를 무시합니다. 고객별 1회이며 상품 금액 30,000원 이상에서 사용합니다.
- 주문은 당시 상품 이름·옵션·가격·배송 정보를 보존합니다. 배송지 수정·삭제는 과거 주문에 영향을 주지 않습니다.
- 부분 취소 금액은 원 단위 배분 할인을 뺀 실구매액을 누적 수량으로 계산합니다. 일부 취소로 배송비를 새로 부과하지 않으며, 전체 취소 때 최초 배송비도 반환합니다. 쿠폰은 전체 취소 시 복원합니다.
- `GET /api/state`의 `orders`에는 계산된 `status`(취소 없음/일부 취소/전체 취소), `refund`, `remainingTotal`이 포함됩니다.
- 검색·정렬·상품 필터는 현재 상품 목록을 브라우저에서 처리합니다. 주문 검색·필터는 브라우저 목록과 CSV 엔드포인트에 같은 조건을 적용합니다.
