# 테이블 관계 정의 및 현재 JOIN 로직 사용법

## 1. 관계가 잡히는 방식 (현재 로직, FK 기반)

1. **DB FK**  
   `information_schema`에 정의된 FOREIGN KEY → **mode=fk** 시 사용. join-order도 FK만 사용.
2. **_id 추론 (mode=all)**  
   **파일:** `Backend/api_server/pluralize.py` — `find_parent_table(column_name, allowed_tables)`  
   컬럼명 `*_id`에서 부모 테이블 추론 (단수/복수/복합어).  
   예: `workflow_id`→workflows, `campaign_id`→campaigns.  
   테이블명이 정확히 맞아야 함 (예: `delivery_id`→`deliveries` 필요, `test_deliveries_data`는 매칭 안 됨).

---

## 2. 관계 정의 방법 (FK 기반)

**DB에 FK 추가**  
추론으로 안 잡히는 관계(예: delivery_id → test_deliveries_data)는 DB에 FK를 두면 됨.

```sql
ALTER TABLE test_delivery_tracking
  ADD CONSTRAINT fk_tracking_delivery
  FOREIGN KEY (delivery_id) REFERENCES test_deliveries_data(id);
```

- **사용**: `GET /api/table-relationships` (mode=fk), join-order 모두 FK만 사용.

---

## 3. 현재 JOIN 로직에서 어떻게 쓰이는지

| 단계 | 사용처 | 설명 |
|------|--------|------|
| 관계 목록 | `GET /api/table-relationships` | FK + (mode=all이면 _id 추론) + **extra_relationships** |
| JOIN 순서 | `POST /api/join-order` | 위 관계만 사용. base_table 기준 BFS로 경로 계산 |
| 프론트 | 쿼리 빌더 Sidebar / MainArea | `relationshipOptions`로 “이 테이블 추가 가능/조인 조건” 판단 |
| SQL 생성 | `sqlBuilder.js` | `joinConfigs`(테이블 쌍별 컬럼)로 ON 절 생성 |

따라서 **정의**는 다음 중 하나로 하면 됨.

- DB FK 추가 (방법 A), 또는  
- `config.backend.extra_relationships`에 한 줄 추가 (방법 B).

**사용**은 따로 할 일 없음.  
관계가 목록에만 들어가면, 자동 정렬·테이블 추가·JOIN 조건·SQL 생성이 모두 그 관계를 사용한다.

---

## 4. 5개 테이블 관계 요약

| 부모 | 자식 | 연결 | 정의 방법 |
|------|------|------|-----------|
| campaigns | workflows | workflows.campaign_id → campaigns.id | DB FK 있음 |
| campaigns | test_coupons_data, test_deliveries_data | campaign_id → campaigns.id | mode=all 시 _id 추론 |
| workflows | test_coupons_data, test_deliveries_data | workflow_id → workflows.id | mode=all 시 _id 추론 |
| test_deliveries_data | test_delivery_tracking | delivery_id → test_deliveries_data.id | DB FK 없음 → DB에 FK 추가 시 사용 가능 |

---

## 5. 적용 후 확인

1. **config에 extra_relationships 추가 후** API 서버 재시작.
2. `GET /api/table-relationships` 호출 시  
   `from_table: "test_delivery_tracking"`, `to_table: "test_deliveries_data"`, `source: "config"` 인 항목이 있으면 성공.
3. 쿼리 빌더에서  
   `test_deliveries_data` 추가 후 `test_delivery_tracking` 추가 가능하고,  
   자동 정렬 시 두 테이블이 `delivery_id` = `id` 로 연결되면 정상 동작.
