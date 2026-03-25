# 차트 가독성 (Chart Readability)

**범주:** 디멘션·메트릭이 불명확하거나 값 범위가 좁을 때 차트 가독성 저하 문제와, ECharts 참고 요소 및 기존 대시보드 적용 사항, 적용 방안을 정리합니다.

---

## 1. 문제 요약

- **증상:** 디멘션(축)과 메트릭(값)이 많거나, 값이 좁은 구간(예: 3,000~4,000)에 몰려 있을 때 **Y축을 0부터 쓰면 막대 높이 차이가 거의 안 보여** 가독성이 매우 떨어짐.
- **예:** "일자별 발송·성공·오픈·클릭 (막대)"처럼 메트릭이 여러 개이고 카테고리(일자+캠페인 등)가 50~60개일 때, 모든 막대가 0~4,000 축 상단에 몰려 있어 구분이 어려움.
- **원인:**  
  - Y축이 항상 0부터 자동 확장되어, 실제 데이터 구간(예: 3,000~4,000)이 화면에서 차지하는 비율이 작음.  
  - X축 카테고리 수가 많아 레이블 밀집·겹침.  
  - 스택/그룹 구분이 없으면 어떤 값이 무엇인지 한눈에 들어오지 않음.

---

## 2. ECharts 참고: 데이터를 효과적으로 처리하는 차트 요소 및 적용 방법

ECharts 문서(축 개념, 옵션)를 참고한 요소와 적용 방법입니다.

### 2.1 Y축 스케일·범위 (yAxis min / max)

- **개념:** `yAxis.min`, `yAxis.max`를 지정하면 축 범위를 고정할 수 있음.  
  데이터가 좁은 구간에 몰려 있을 때 **0을 포함하지 않고 데이터 구간만 보이도록** 하면 미세한 차이가 잘 보임.
- **적용:**  
  - 값 범위가 “좁다”고 판단되는 경우(예: `(dataMax - dataMin) / dataMax < 0.2`)  
    → `min: dataMin - padding`, `max: dataMax + padding` 형태로 **데이터 구간 기준**으로 Y축 설정.  
  - ECharts는 `min: 'dataMin'`, `max: 'dataMax'` 같은 문자열도 지원하나, 패딩을 넣어 “nice”한 눈금을 쓰려면 숫자 min/max를 직접 계산해 주는 편이 좋음.
- **참고:** [ECharts Axis - Handbook](https://echarts.apache.org/handbook/en/concepts/axis/), 옵션 문서 `yAxis.min`, `yAxis.max`.

### 2.2 축 라벨 (axisLabel)

- **개념:** `axisLabel.formatter`, `axisLabel.rotate` 등으로 축 라벨 내용·각도 제어.
- **적용:**  
  - X축 카테고리가 많을 때: `rotate: 45` 등으로 기울여 겹침 완화.  
  - Y축: 큰 수는 `formatter`로 `1e6`, `1e9` 등 축약 표기해 레이블 잘림 방지.  
  - 기존 dashboard의 `XAxisTickTruncate`, `formatYAxisTick`과 동일한 “가독성” 목적.

### 2.3 데이터 줌 (dataZoom)

- **개념:** `dataZoom`으로 보이는 구간을 제한해, 카테고리/시간이 많을 때 **일부만 보여 주고** 나머지는 스크롤·슬라이더로 탐색.
- **적용:**  
  - 카테고리 수가 임계값 초과(예: 20개 초과)일 때 `dataZoom: [{ type: 'slider', xAxisIndex: 0, start: 0, end: 50 }]`처럼 초기 보이는 비율을 제한.  
  - ECharts `rangeMode: 'value'`는 데이터 인덱스 기준으로 범위를 고정할 때 유용.

### 2.4 스택 막대 (stack)

- **개념:** 여러 메트릭을 한 카테고리에서 쌓아서 보여 주면 “발송 요청·성공·오픈·클릭” 같은 구성이 명확해짐.
- **적용:** 복수 시리즈 막대에 동일한 `stack: 'total'` 지정 → ECharts가 같은 축에 스택으로 그림.  
  스택일 때 Y축 범위는 “카테고리별 합계”의 min/max로 계산하면 됨.

### 2.5 데이터 라벨 (series.label)

- **개념:** 막대/선 위에 값 표시하면 축만으로는 구분이 어려운 좁은 구간에서도 수치를 직접 읽을 수 있음.
- **적용:** 카테고리 수가 적당할 때(예: 20개 이하) `series[].label: { show: true, formatter: ... }`로 막대 끝에 값 표시.  
  카테고리가 많으면 과도한 라벨로 인해 오히려 가독성이 떨어질 수 있으므로 조건부 적용 권장.

### 2.6 차트 유형 전환

- **개념:** “비율/추이”가 중요하면 막대 대신 **선/영역**이 더 잘 보일 수 있음.
- **적용:** 템플릿에서 “일자별 발송·성공·오픈·클릭”을 막대뿐 아니라 **선/영역** 옵션으로도 제공하면, 사용자가 가독성 좋은 유형을 선택 가능.

---

## 3. 기존 대시보드에서 이미 적용한 사항

아래는 위와 같은 “가독성” 문제를 줄이기 위해 **이미 적용된** 내용입니다. ECharts 차트 개선 시 참고할 수 있습니다.

### 3.1 ChartWidget (Recharts, dashboard 패키지)

- **Y축 Nice Numbers:**  
  `calculateYAxisScale`, `calculateYAxisScaleForBar`, `calculateYAxisScaleForLineArea`로 1·2·5·10 계열 눈금과 min/max/step 계산.  
  → 축 레이블이 읽기 좋은 숫자로 표시됨.
- **Rate(비율) 데이터 구간 확대:**  
  `calculateYAxisScaleForRate`: 범위가 좁을 때(예: 5% 미만) **0이 아닌 데이터 구간**으로 Y축을 확대해 미세한 차이를 보이게 함.  
  막대 + rate일 때 “Y축이 데이터 구간으로 확대되었습니다” 안내 문구 표시.
- **Y축 도메인:**  
  `yDomain`을 계산된 scale의 min/max로 설정해 Recharts `YAxis`에 `domain` 적용.  
  스크롤 영역에는 `allowDataOverflow`와 숨김 Y축으로 동일 도메인 유지.
- **X축:**  
  `LABEL_SLOT_WIDTH`·`XAxisTickTruncate`로 레이블 길이 제한·겹침 방지.  
  가로 스크롤로 많은 카테고리 대응, Y축은 고정 영역에 단일 축만 표시.

### 3.2 AggregatedBarChart (기준별 발송 현황)

- **상위 N건만 표시:**  
  `TOP_N = 10`으로 정렬 후 상위 10건만 막대에 표시 → 디멘션 조합이 많아도 차트는 10개로 제한되어 가독성 확보.
- **X축 복합 라벨:**  
  `getCompositeXLabel`로 일자·캠페인·워크플로우·채널을 “ / ”로 이어 한 라벨로 표시.  
  `XAxisTickMultiline`으로 “ / ” 기준 줄바꿈, 세그먼트당 글자 수 제한(`truncateSegment`)으로 겹침 방지.
- **차트 폭:**  
  `minWidth: max(70%, barCount * LABEL_SLOT_WIDTH)`로 막대당 최소 폭 확보.

## 4. 적용 방안 요약 (ECharts 기반 커스텀 차트 개선)

- **Y축 데이터 구간 확대:**  
  막대(및 스택) 값의 min/max를 구한 뒤, `(dataMax - dataMin) / dataMax < 0.2` 등으로 “좁은 구간”일 때  
  `yAxis.min`, `yAxis.max`를 데이터 구간 + 패딩으로 설정.  
  필요 시 “Y축이 데이터 구간으로 확대되었습니다”와 같은 안내 표시.
- **스택 막대:**  
  복수 메트릭 막대 템플릿(예: `bar_both`, `bar_all`)에 `stack: 'total'` 적용.
- **dataZoom:**  
  카테고리 수가 임계값(예: 20) 초과일 때 X축 `dataZoom`(slider 또는 inside)으로 초기 보이는 구간 제한.
- **X축 라벨:**  
  카테고리 수에 따라 `axisLabel.rotate` 유지, 필요 시 길이 제한(truncate) 또는 툴팁에서 전체 텍스트 제공.
- **선택:**  
  카테고리 수가 적을 때만 막대에 `label.show`로 값 표시.

동일한 원칙은 프로젝트 내 ECharts 옵션을 구성하는 컴포넌트에 적용할 수 있다.

---

## 5. 참고 문서

- ECharts Axis: https://echarts.apache.org/handbook/en/concepts/axis/
- ECharts Option: https://echarts.apache.org/option.html (yAxis, xAxis, dataZoom, series.bar.stack, series.label)
