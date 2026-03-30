# Analytica 스타일 — 레이아웃·규칙·CSS 일괄 적용 가이드

**목적:** 원본 앱의 **기능·페이지·HTML을 그대로 옮기지 않고**, 다른 프로젝트에 **위치 관계·간격·색·타이포·모양 규칙**만 맞추는 것.  
**근거 파일:** `css.zip` → `css_extracted/` (또는 Analytica의 `resources/css/`) — 여기 있는 CSS가 이 규칙의 단일 출처다.

아래 **부록**에는 `css_extracted`에 포함된 **전체 CSS 원문**을 파일 경로별로 그대로 실었다. 문서만 넘겨도 스타일 전체를 복사·검색할 수 있다.

---

## 1. 적용 범위를 이렇게 나눈다

| 가져올 것 | 가져오지 않을 것 |
|-----------|------------------|
| 뷰포트·고정 헤더·사이드바·본문 스크롤 영역의 **치수 관계** | 특정 URL, Thymeleaf, jQuery, 화면별 비즈니스 로직 |
| **색·글꼴·모서리·테두리** 토큰 | `campaign_*`, `contents_*` 같은 **도메인 전용 마크업** (필요 시 클래스명만 참고해 자기 프로젝트 이름으로 매핑) |
| **컴포넌트 형태** (칩, 필터 박스, 테이블 헤더, 주요 버튼 실루엣) | 서브메뉴 호버 스크립트, AI 패널 열기 등 **동작** |

---

## 2. 공간 모델 (위치 규칙의 핵심)

원본은 **왼쪽 고정 폭 컬럼 + 상단 고정 띠(헤더·브레드크럼) + 나머지 스크롤** 구조다. 숫자는 서로 묶여 있어 **하나만 바꾸면 어긋난다.**

```
[ 사이드바 80px ][──────────── 메인 영역 ────────────]
                 [ 헤더 60px (fixed, 좌측 80px 만큼 들여쓰기) ]
                 [ 브레드크럼 ~35px (fixed, top ≈ 헤더 아래) ]
                 [ 본문 .main-container: 스크롤, 좌 80px·상단 오프셋 ]
```

**고정값 표 (common.css + header.css + navi.css 기준)**

| 이름 | 값 | 쓰임 |
|------|-----|------|
| `--nav-width` | `80px` | 사이드바, `#header`/`#breadcrumb`의 `margin-left`, `.main-container`의 `margin-left`·`width` 보정 |
| `--header-height` | `60px` | `.header-container` 높이 |
| `--breadcrumb-height` | `35px` | `.nav-container` (브레드크럼 바) |
| `--header-breadcrumb-offset` | `61px` | `#breadcrumb`의 `margin-top` (헤더와 시각적 맞춤) |
| `--main-top-offset` | `96px` | `.main-container`의 `margin-top` (고정 띠 두 줄 합의 근사) |
| `--main-height-trim` | `100px` | `.main-container`의 `height: calc(100vh - …)` |
| `--split-min-left` | `880px` | 2단 편집 시 좌측 `.left-area` `min-width` |
| `--split-vertical-trim` | `115px` | 좌·우 `.left-area`/`.right-area` 높이 `calc` |
| `--subnav-width` | `150px` | 내부 서브내비 오버레이 폭 (navi.css) |

**다른 스택(React/Vue/Flutter)으로 옮길 때:** 위 표를 **디자인 토큰·테마 한 곳**에만 두고, 레이아웃 컴포넌트에서 참조한다. 원본처럼 `#header`에 `calc(100% - 80px)`를 하드코딩하지 말고 변수로 통일하는 것이 유지보수에 유리하다.

**z-index 층 (겹침 순서 참고)**

| 대략 | 선택자/요소 |
|------|-------------|
| 낮음 | `#ai_button` (플로팅) |
| 중간 | `#header`, `#breadcrumb` (`5`) |
| 위 | AI 패널 `.ai-wrapper` (`6`) |
| 더 위 | `.navi-sub-container` (`10`) |

---

## 3. CSS 파일 층위 (무엇을 어디서 가져오는지)

`css_extracted/` 기준. **일괄 적용**이면 아래 순서가 “전역 규칙 → 레이아웃 조각” 순서다.

1. **`templates/common.css`** — `html`/`body`, `#header`/`#breadcrumb`/`.main-container`, 폼·칩·버튼·페이징 등 **공통 패턴 대부분**
2. **`templates/navi.css`** — 좌측 80px 컬럼, 그라데이션, 서브메뉴 폭·위치
3. **`templates/header.css`** — 헤더 바·브레드크럼 줄 (`.header-container`, `.nav-container`, `.breadcrumb`)
4. **`templates/ai_chat.css`** — 우측 패널·말풍선 (AI UI를 쓰지 않으면 **링크 생략 가능**)
5. **`main/**/**.css`** — 목록/폼 **밀도·테이블·필터 박스** 등 화면별. 다른 프로젝트에서는 **필요한 패턴만** 발췌해 합치는 편이 낫다.

**권장:** 새 프로젝트에 `analytica-shell.css` 하나를 만들고, 1~3(필요 시 4)에서 **규칙만 복사**하거나, 빌드에서 위 순서로 `@import` 한다. `main/*`은 “테이블+필터 UI가 필요할 때”만 참고한다.

---

## 4. 시각 토큰 (색·타이포·모양)

**타이포**

- 전역: **Noto Sans KR**
- 본문 라벨: `#030303`
- 보조/설명: `#7f7f7f` (12px 대역 — `item-label-explanation` 등)
- 일반 스팬: 14px (`item-span`)

**면·선**

- 구분선/약한 테두리: `#c2c2c2`, `#e3e3e3`, `#e5e5e5`
- 입력 기본 테두리: `2px solid rgb(229,229,229)` 또는 `1px solid #c1c1c1` (화면별)
- 헤더 하단: `1px solid #030303`

**액션색 (의미만 맞추면 됨)**

- **링크형/윤곽 주요 버튼:** `#00704a` (채우기·테두리 조합은 common.css 참고)
- **로그인 CTA:** `#00704a` / hover `#005237` — **로그인 화면 전용** (`login.css`), 배경 그라데이션과 구분되는 솔리드 버튼
- **강조(뱃지·일부 실행 버튼):** `#C37AFF`
- **위험/거절/삭제:** `#fe5655`, `#f25656`

**그라데이션**

- **사이드바:** 위→아래 `#c873ff` → `#94bbfa` → `#4dd9fe`
- **로그인 배경:** 135deg, `#d890f9` / `#91b9f9` / `#33f2fa`

**모서리 (반복 패턴)**

- **필터/카드형 박스:** `border-radius: 10px`
- **둥근 입력·셀렉트·칩:** `border-radius: 25px`
- **작은 직사각 버튼:** `border-radius: 5px`
- **주요 다음/제출형:** `border-radius: 20px` 전후

**2단 편집**

- 우측 패널 배경: `rgb(242,242,242)`, `border-radius: 10px` (`.right-area`)

**채널·상태 칩 (선택 시 배경)**

- `common.css`의 `.item-talk`, `.item-msg`, `.item-app`, `.item-email`, `.item-onsite` 등 — **도메인 이름이 아니라 “선택된 태그 색”**으로만 재사용하면 된다.

---

## 5. 마크업에 대한 최소 요구 (규칙만 적용할 때)

원본 CSS는 **특정 ID/클래스**에 고정되어 있다. 기능 없이 **모양만** 쓰려면 아래만 맞추면 된다.

- **앱 뼈대:** `body` 가로 flex + 첫 자식이 **폭 80px 사이드 영역**, 그 옆에 **고정 헤더·브레드크럼·스크롤 본문**이 오도록 하되, 원본은 `#header`/`#breadcrumb`를 `fixed`로 두고 본문만 `margin`으로 비운다. **동일 수치**를 유지할지, flex/grid로 재구현할지는 새 프로젝트 선택이다. 수치는 §2 표를 따른다.
- **본문 스크롤:** `.main-container`에 해당하는 영역에 `overflow: auto`와 §2의 `margin-top`/`height`/`width` 관계를 재현한다.
- **칩·버튼·테이블:** `common.css`에 정의된 **클래스명을 그대로 쓰거나**, 규칙 블록만 복사해 자기 네이밍으로 바꾼다.

**원본 HTML/JS는 필수 아님.**

---

## 6. 다른 프로젝트에 “일괄 적용”하는 실무 절차

1. §2 표를 **프로젝트 테마(`:root` 또는 디자인 시스템)**에 옮긴다.  
2. §3의 1~3번 CSS에서 **레이아웃·타이포·리셋** 구간만 발췌해 한 파일로 합치거나, 순서대로 import한다.  
3. 필요한 UI 패턴(테이블 헤더, 필터 박스, 페이징)이 있으면 `common.css` + 해당 `main/*.css`에서 **관련 선택자만** 복사한다.  
4. **반응형:** 원본은 데스크톱·고정 `min-width` 전제가 많다. 모바일은 §2 수치를 미디어쿼리로 깨거나 레이아웃을 바꿔야 한다.  
5. **접근성/상태:** `header.css`의 `button:active { background-color: blue }` 등은 디자인 의도와 맞는지 검토 후 조정한다.

---

## 7. 원본과의 대응 (참고 한 줄)

- **단일 소스:** `css_extracted` = 스타일만; Analytica 전체 repo는 동일 규칙이 `resources/css/`에도 있다.  
- **페이지별 CSS:** `main/`은 “규칙 저장소”로 보고, 새 앱의 화면에 맞게 **발췌**하는 용도다.

상단은 **규칙·위치·CSS 층** 요약이고, **부록**에 `css_extracted`와 동일한 **전체 CSS 원문**이 있다. 기능 이식·HTML 복제는 별도 작업이다.

---

## 부록: css_extracted 전체 CSS 원문

로드 권장 순서: `templates/common.css` → `navi.css` → `header.css` → `ai_chat.css`(선택) → 화면별 `main/...`.

### `templates/common.css`

```css
html {
    padding: 0;
    margin: 0;
    min-height: 100vh;
    overflow-x: auto;
    overflow-y: hidden;
}
body {
    padding: 0;
    margin: 0;
    min-height: 100vh;
    display: flex;
    flex-direction: row;
    /*overflow: hidden;*/
}
#header {
    position: fixed;
    width: calc(100% - 80px);
    margin-left: 80px;
    z-index: 5; /* z-index 속성은 고정된 요소가 다른 요소 위에 나타나게 합니다. */
}
* {
    font-family: 'Noto Sans KR', sans-serif;
}
button, a {
    cursor: pointer;
    text-decoration: none;
}
button {
    border: none;
    background: none;
}
.hidden {
    display: none;
}
.bold {
    font-weight: bold;
}
.item-span {
    font-size: 14px;
}
/*빵 부스러기*/
#breadcrumb {
    margin-top: 61px;
    position: fixed;
    width: calc(100% - 80px);
    margin-left: 80px;
    z-index: 5;
}
.breadcrumb-item:last-child a {
    color: black;
    font-weight: bold;
}
.breadcrumb-item::after {
    content: none;
    margin-left: 5px;
    color: #c2c2c2;
}
/*입력창 테두리 유지*/
input:focus, textarea:focus {
    outline: none;
}
/* wrapper -> container -> area -> group */
.main-wrapper {
    margin: 0;
    padding: 0;
    display: flex;
    width: 100%;
    height: 100vh;
    align-items: start;
    justify-content: start;
}
.main-container {
    position: absolute;
    margin-top: 96px; /* header 높이 */
    margin-left: 80px; /* navi 너비 */
    padding: 0;
    height: calc(100vh - 100px); /* 100% 뷰포트 높이에서 header 높이 빼기 */
    width: calc(100% - 80px); /* 100% 뷰포트 너비에서 navi 너비 빼기 */
    /*min-width: calc(1800px - 100px - 16px);*/
    overflow: auto;
}
ol {
    list-style-type: none;
}
label {
    color: #030303;
}
/*메인 컨텐츠 영역*/
.campaign-container {
    padding: 0 20px;
    display: flex;
    /*height: calc(100vh - 115px);*/
}

.content-container .left-area,
.campaign-container .left-area {
    width: 50%;
    min-width: 880px;
    height: calc(100vh - 115px);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    overflow-x: hidden;
    margin: 0 10px;
    flex: 1;
}

.input-clear-wrap {
    display: flex;
    position: relative;
    width: 780px;
}
.title-clear-wrap {
    display: flex;
    position: relative;
}
.campaign-title-clear-wrap {
    display: flex;
    position: relative;
    width: 780px;
}
.span-clear-wrap {
    display: flex;
}
.file-clear-wrap {
    display: flex;
    position: relative;
    width: 90%;
    justify-content: center;
}
.input-clear-wrap .item-input:focus ~ .clear-button,
.input-clear-wrap .item-input:not([value=""]) ~ .clear-button {
    display: block;
}
.input-clear-wrap .item-input:focus ~ .title-clear-button,
.input-clear-wrap .item-input:not([value=""]) ~ .title-clear-button {
    display: block;
}
.input-search-clear-wrap .item-input:focus ~ .search-clear-button,
.input-search-clear-wrap .item-input:not([value=""]) ~ .search-clear-button {
    display: block;
}
.file-clear-wrap .item-input:focus ~ .clear-button,
.file-clear-wrap .item-input:not([value=""]) ~ .clear-button {
    display: block;
}
.title-clear-wrap .item-input:focus ~ .clear-button,
.title-clear-wrap .item-input:not([value=""]) ~ .clear-button {
    display: block;
}
.campaign-title-clear-wrap .item-input:focus ~ .title-clear-button,
.campaign-title-clear-wrap .item-input:not([value=""]) ~ .title-clear-button {
    display: block;
}
.span-clear-wrap .clear-button,
.span-clear-wrap .clear-button {
    display: block;
}
.clear-button {
    position: absolute;
    height: 20px;
    right: 20px;
    top: 50%;
    transform: translateY(-50%);  /* 버튼이 정확히 input 필드의 중심에 위치하도록 조정 */
    padding: 0;  /* 기존의 패딩 값을 제거 */
    border: none;  /* 기존의 테두리를 제거 */
    background: none;
}
.title-clear-button {
    position: absolute;
    height: 20px;
    right: 90px;
    top: 50%;
    transform: translateY(-50%);  /* 버튼이 정확히 input 필드의 중심에 위치하도록 조정 */
    padding: 0;  /* 기존의 패딩 값을 제거 */
    border: none;  /* 기존의 테두리를 제거 */
    background: none;
}
.span-clear-button {
    transform: translate(-25px, 10%);
    padding: 0;  /* 기존의 패딩 값을 제거 */
    border: none;  /* 기존의 테두리를 제거 */
    background: none;
}
.remove-button {
    position: absolute;
    height: 20px;
    transform: translate(-30px, 1px);
    padding: 0;  /* 기존의 패딩 값을 제거 */
    border: none;  /* 기존의 테두리를 제거 */
    background: none;
}
.clear-button-img {
    width: 20px;
    height: 20px;
}
#ai_button {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 1;
    background: none;
    border: none;
}
#ai_button img {
    width: 40px;
    height: 40px;
}

.right-area {
    display: flex;
    justify-content: center;
    align-items: center;
    height: calc(100vh - 115px);
    /*공용*/
    overflow-y: auto;
    overflow-x: hidden;
    margin: 0 10px;
    flex: 1;
    flex-direction: column;
    width: 50%;
    background-color: rgb(242, 242, 242);
    border-radius: 10px;
}
.device-msg-container {

}
/*input search css 제거*/
input[type="search"]::-webkit-search-decoration,
input[type="search"]::-webkit-search-cancel-button,
input[type="search"]::-webkit-search-results-button,
input[type="search"]::-webkit-search-results-decoration {
    display: none;
}

/*부연 설명*/
.item-label-explanation {
    font-size: 12px;
    color: #7f7f7f;
}
.item-span-explanation {
    font-size: 12px;
    color: #7f7f7f;
    margin-left: 5px;
}

/*필터링*/
.item-filtered {
    display: inline-block;
    position: relative;
    width: 92px;
    /* text-align: center; */
    padding: 2px 13px;
    background-color: #e3e3e3;
    color: black;
    border: none;
    font-size: 13px;
    border-radius: 25px;
}
/*채널*/
.item-channel-span {
    display: inline-block;
    padding: 4px 10px;
    text-align: center;
    width: 50px;
    background-color: #f1f1f1;
    color: black;
    border: none;
    font-size: 13px;
    border-radius: 25px;
    transition: background-color 0.1s ease;
}
.item-channel-button {
    padding: 4px 10px;
    text-align: center;
    width: 70px;
    background-color: #f1f1f1;
    color: black;
    border: none;
    font-size: 13px;
    border-radius: 25px;
    transition: background-color 0.1s ease;
}

/*발송 상태*/
/*발송중*/
.item-provision {
    border: 1px solid #c2c2c2;
    padding: 3px 10px;
    font-size: 12px;
    border-radius: 25px;
    transition: background-color 0.3s ease;
    font-weight: 500;
    color: #030303;
    width: 50px;
    margin: auto;
    text-align: center;
}
/*발송대기*/
.item-delivery-wait {
    background-color: rgb(0,0,0,0);
    border: 1px solid #c2c2c2;
    border-radius: 25px;
    transition: background-color 0.3s ease;
    color: black;
    padding: 3px 10px;
    font-size: 12px;
    width: 50px;
    margin: auto;
    font-weight: 500;
    text-align: center;
}
/*준비중*/
.item-preparing {
    background-color: rgb(0,0,0,0);
    border: 1px solid #c2c2c2;
    border-radius: 25px;
    transition: background-color 0.3s ease;
    color: black;
    padding: 3px 10px;
    font-size: 12px;
    width: 50px;
    margin: auto;
    font-weight: 500;
    text-align: center;
}
.item-stop {
    padding: 3px 10px;
    font-size: 12px;
    border: 1px solid #424242;
    border-radius: 25px;
    transition: background-color 0.3s ease;
    background-color: #424242;
    color: #ffffff;
    width: 50px;
    margin: auto;
    font-weight: 500;
    text-align: center;
}
/*승인 거부*/
.item-refuse {
    padding: 3px 10px;
    font-size: 12px;
    border: 1px solid #fe5655;
    border-radius: 25px;
    transition: background-color 0.3s ease;
    background-color: #ffffff;
    color: #fe5655;
    width: 50px;
    margin: auto;
    font-weight: 500;
    text-align: center;
}
/*오류*/
.item-error {
    padding: 3px 10px;
    font-size: 12px;
    border: 1px solid #fe5655;
    border-radius: 25px;
    transition: background-color 0.3s ease;
    background-color: #ffffff;
    color: #fe5655;
    width: 50px;
    margin: auto;
    font-weight: 500;
    text-align: center;
}
.item-approval-wait {
    background-color: rgb(0,0,0,0);
    border: 1px solid #c2c2c2;
    border-radius: 25px;
    transition: background-color 0.3s ease;
    color: black;
    padding: 3px 10px;
    font-size: 12px;
    width: 50px;
    margin: auto;
    font-weight: 500;
    text-align: center;
}

.send-channel {
    display: inline-block;
    padding: 2px 0;
    text-align: center;
    width: 60px;
    background-color: #f1f1f1;
    color: black;
    border: none;
    font-size: 13px;
    border-radius: 25px;
}

/*채널 선택시*/
.item-talk {
    background-color: #FFCC00 !important;
}
.item-msg {
    background-color: #98B4FA !important;
    color: white !important;
}
.item-app {
    background-color: #A66FBF !important;
    color: white !important;
}
.item-email {
    background-color: #5856D6 !important;
    color: white !important;
}
.item-onsite {
    background-color: #4F1287 !important;
    color: white !important;
}


.item-sending {
    background-color: #e91e63;
    color: white;
}
/*오퍼*/
.item-offer {
    padding: 2px 4px;
    background-color: #c2c2c2;
    color: white;
    border: none;
    font-size: 14px;
    border-radius: 25px;
    font-weight: bold;
}

/*페이징*/
.paging-container {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px;
    margin-top: 20px;
}
.paging-item {
    height: 20px;
    color: black;
    float: left;
    padding: 10px 5px 5px 5px;
    text-decoration: none;
    transition: background-color .3s;
}
.paging-number {
    height: 20px;
    color: #c2c2c2;
    font-weight: bolder;
    padding: 10px;
    text-decoration: none;
    transition: background-color .3s;
}
.paging-item.active,
.paging-number.active {
    color: black;
}

.paging-item:hover:not(.active),
.paging-number:hover:not(.active){
    background-color: #ddd;
}

/*페이지 이동 버튼*/
.next-page-container {
    height: 100px;
    width: 100%;
    flex-shrink: 0;
    display: flex;
    justify-content: center;
    align-items: center;
}
.pre-page-button {
    width: 105px;
    height: 30px;
    border-radius: 20px;
    color: #00704a;
    border: 1px solid #00704a;
    background-color: #ffffff;
    margin-right: 10px;
    font-weight: bold;
}
.next-page-button {
    width: 105px;
    height: 30px;
    border-radius: 20px;
    color: white;
    background-color: #00704a;
    margin-left: 10px;
    font-weight: bold;
}
.submit-button {
    width: 105px;
    height: 30px;
    border-radius: 20px;
    color: white;
    background-color: #00704a;
    margin-left: 10px;
    font-weight: bold;
}

/*캠페인 생성,복사,삭제*/
.campaign-create-button{
    width: 85px;
    height: 30px;
    border-radius: 5px;
    border: 1px solid #c2c2c2;
    margin: 0 2px;
    background: none;
}
.campaign-copy-button {
    width: 85px;
    font-size: 14px;
    height: 30px;
    border-radius: 5px;
    border: 1px solid #c2c2c2;
    margin: 0 2px;
    background: none;
}
.campaign-update-button {
    width: 50px;
    height: 30px;
    font-size: 14px;
    border-radius: 5px;
    border: 1px solid #c2c2c2;
    margin: 0 2px;
    background: none;
}
.campaign-delete-button {
    width: 50px;
    height: 30px;
    font-size: 14px;
    border-radius: 5px;
    border: 1px solid #f25656;
    color: #f25656;
    margin: 0 2px;
    background: none;
}
.help-outline {
    transform: translate(0px, 4px);
    font-size: 16px;
}
.item-underline {
    border-bottom: 2px solid #e3e3e3;
}

/*로그인 페이지*/
```

### `templates/navi.css`

```css
/* CSS 코드 */
.navi-wrapper {
    display: flex;
    min-height: 100vh;
    /*align-items: flex-start;  !* 추가된 속성 *!*/
    width: 80px;
}
.navi-container {
    position: relative;
    width: 80px; /* 원하는 너비 설정 */
    height: 100vh; /* 화면 전체 높이 */
    /*position: fixed; !* 화면에 고정 *!
    left: 0; !* 화면 왼쪽에서부터의 거리 *!
    top: 0; !* 화면 상단에서부터의 거리 *!*/
    background: linear-gradient(to bottom, #c873ff, #94bbfa, #4dd9fe);
    display: flex;
    flex-direction: column;
}
.main-menu-area {
    list-style: none; /* 리스트 이전에 기본적으로 붙는 마크 제거 */
    margin: 0; /* 마진 제거 */
    padding: 40px 0 0 0;
}

.menu-item {
    width: 100%;
    margin: 20px 0;
}
.menu-item > button > img {
    width: 30px;
    height: 30px;
}

.menu-item-bottom > button > img {
    width: 30px;
    height: 30px;
}

.menu-button {
    width: 100%; /* 버튼의 너비를 100%로 설정하여 부모 요소인 .menu-item의 전체 너비를 차지하도록 합니다. */
    text-align: center; /* 텍스트를 왼쪽으로 정렬합니다. */
    background-color: rgba(255, 255, 255, 0);
    border: none; /* 버튼의 테두리 선을 없애기 */
    display: flex; /* Flexbox layout을 사용합니다. */
    flex-direction: column; /* 자식 요소들을 수직으로 정렬합니다. */
    justify-content: center; /* 자식 요소들을 버튼의 중앙에 배치합니다. */
    align-items: center; /* 자식 요소들을 버튼의 수평 중앙에 배치합니다. */
}
.menu-item-bottom {
    width: 100%; /* 버튼의 너비를 100%로 설정하여 부모 요소인 .menu-item의 전체 너비를 차지하도록 합니다. */
    text-align: center; /* 텍스트를 왼쪽으로 정렬합니다. */
    background-color: rgba(255, 255, 255, 0);
    border: none; /* 버튼의 테두리 선을 없애기 */
    display: flex; /* Flexbox layout을 사용합니다. */
    flex-direction: column; /* 자식 요소들을 수직으로 정렬합니다. */
    justify-content: center; /* 자식 요소들을 버튼의 중앙에 배치합니다. */
    align-items: center; /* 자식 요소들을 버튼의 수평 중앙에 배치합니다. */
    /*position: absolute;
    bottom: 5%;*/
    margin-top: 500px; /*이를 사용하여 하단에 고정*/
    position: sticky;
}
/*.menu-button:active {
    background-color: red; !* 클릭한 동안의 배경색을 red로 지정함 *!
}*/
.menu-text {
    font-size: 13px;
    color: #ffffff;
    font-weight: bold;
}

/*서브 메뉴*/
.navi-sub-container {
    position: absolute;
    width: 150px; /* 원하는 너비 설정 */
    height: calc(100vh - 115px);
    overflow-y: auto; /* 내용이 많을경우 스크롤 생성 */
    margin-left: 80px;
    padding-top: 115px;
    background: linear-gradient(to bottom, #c873ff, #94bbfa, #4dd9fe);
    z-index: 10; /*로고 가리기*/
    display: none;
    /*border-left: 1px solid white;*/
}
.navi-sub-container::after {
    content: '';
    position: absolute;
    width: 2px; /*서브네비 세로줄*/
    height: calc(100vh - 90px);
    transform: translate(-1px, -420px);
    background-color: white;
}
.menu-button:active .navi-sub-container, .menu-item:focus-within .submenu {
    display: block;
}
.submenu {
    padding: 5px 0 5px 30px;
    color: #ffffff;
    margin: 13px 0;
}
.submenu li a {
    color: #ffffff;
}
.navi-sub-container ul li {
    font-size: 14px;
    padding: 1px 0;
}
```

### `templates/header.css`

```css
.header-container{
    position: relative; /* 위치 상대 설정 */
    /*width: calc(100% - 80px); !* 전체 너비에서 navi의 너비를 뺌 *!*/
    width: 100%;
    height: 60px;
    border-bottom: 1px solid rgb(3, 3, 3); /*하단에 1px 두께의 검은색*/
    display: flex;         /* Flexbox 사용 */
    align-items: center;   /* 아이템들을 수직으로 중앙 정렬 */
    justify-content: space-between;  /* 가운데 있는 로고와 우측의 버튼 그룹 사이에 가능한 많은 공간을 둠 */
    background-color: white;
}
.header-left {
    padding-left: 20px;
}
.header-right {
    display: flex;
    align-items: center; /*텍스트 아이템 수직 중앙정렬*/
    gap: 10px;
    justify-content: flex-end; /*아이템들을 우측 끝으로 정렬 */
    padding-right: 20px;
}
.header-right button {
    height: 40px;
    background-color: rgba(255, 255, 255, 0);
    border: none; /* 버튼의 테두리 선을 없애기 */
    padding: 5px;
}
.header-right button:active {
    background-color: blue; /* 클릭한 동안의 배경색을 red로 지정함 */
}
.img-with-badge {
    position: relative;
}
.img-with-badge .badge {
    position: absolute;
    top: 1px;
    right: -2px;
    background: #C37AFF;
    color: white;
    padding: 0px 4px;
    border-radius: 50%;
    min-width: 5px;
    text-align: center;
}
.header-right img{
    width: 30px;
}
.profile-button img{
    border-radius: 15px;
}

.logout-button{
    display: inline-block;
    text-decoration: none;
    color: inherit;
    vertical-align: middle;
}

/*빵 부스러기 영역*/
.nav-container {
    position:relative;
    display: flex;
    width: 100%;
    height: 35px;
    background-color: white;
}
.breadcrumb{
    padding: 5px 0 5px 15px;
    margin: 0;
    list-style: none;
    display: flex;
    justify-content: flex-start;
}
.breadcrumb-item {
    margin-right: 5px;
}
.breadcrumb-item a {
    text-decoration: none;
    color: #c2c2c2;
}
/* li 태그를 구분하는 '>' 문자를 넣는 부분입니다. */
/*.breadcrumb-item::after {
    content: '>';
}*/
/* 마지막 li 태그에는 '>' 문자를 표시하지 않도록 합니다. */
.breadcrumb-item:last-child::after {
    content: '';
    color: black;
}
```

### `templates/ai_chat.css`

```css
#ai_chat {
    display: none;
}
ul {
    list-style-type: none;
}
.ai-wrapper {
    position: fixed;
    /*transform: translateX(965px);*/
    right: 0;
    z-index: 6;
    width: 450px;
    height: calc(100vh - 20px);
    background-color: rgb(229, 229, 229);
    padding: 10px;
    border-left: 2px solid #c2c2c2;
}
.logo-container {
    display: flex;
    position: relative;
    align-items: center;
    justify-content: space-between;
}
.logo-area img {
    width: 50px;
    height: 50px;
    margin-left: 10px;
}
.item-ai-analytica {
    padding-left: 10px;
    font-size: 24px;
}
.logo-area {
    height: 50px;
    width: 250px;
    display: flex;
    align-items: center;
}
.close-area {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    padding-right: 10px;
}
.close-button {
    border: none;
    background: none;
    margin-top: 5px;
}

/*채팅 영역*/
.chat-container {
    width: 98%;
    height: 75vh;
    background-color: white;
    margin: 10px auto;
    border: 1px solid #c2c2c2;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
}
.chat-list-container {
    width: 100%;
    padding: 0;
}
/*채팅 내 요소*/
.my-talk {
    width: auto;
    border-radius: 5px;
    margin-top: 5px;
    padding: 10px;
}

.ai-talk {
    display: flex;
    flex-direction: column;
    padding: 10px;
    margin-bottom: 5px;
}
.ai-info {
    text-align: left;
    margin-bottom: 5px;
    display: flex;
    flex-direction: row;
    align-items: center;
}
.my-talk {
    position: relative;
    text-align: right;
    margin-bottom: 5px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
}

.ai-status {
    display: flex;
    align-items: center;
    padding: 5px 10px;
}
.item-text-status {
    padding-left: 5px;
    color: #7f7f7f;
}
.my-talk-text {
    width: max-content;
    background-color: rgb(152, 180, 250, 0.2);
    border-radius: 5px;
    padding: 10px 15px;
}
.ai-talk-text {
    width: max-content;
    background-color: rgb(213, 235, 255, 0.5);
    border-radius: 5px;
    padding: 10px 15px;
}
.ai-icon {
    width: 30px;
    height: 30px;
}
.ai-name {
    margin-left: 5px;
    margin-right: auto;
}

.talk-time {
    color: #aaaaaa;
    font-size: 12px;
}

/*채팅 입력 영역*/
.input-chat-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 98%;
    border-radius: 5px;
    /*margin: auto;*/
    padding-left: 5px;
}
.input-text-chat {
    width: 89%;
    min-height: 80px;
    border-radius: 15px;
    border: 1px solid #c2c2c2;
    padding: 10px 40px 10px 10px;
    resize: none;
}

#chat-text-placeholder {
    position: absolute;
    width: 100%;
    pointer-events: none;
    color: rgba(0,0,0,.3);
    transition: 0.3s;
    display: flex;
    align-items: center;
    padding-left: 20px;
}
#input-text-chat:not(:placeholder-shown) + #input-text-chat-label,
#input-text-chat:focus + #input-text-chat {
    opacity: 0;
}

.send-button {
    background: none;
    border: none;
    width: 30px;
    height: 30px;
    padding: 0;
}
.input-sub-container {
    text-align: end;
    margin: 5px 45px 5px 0;
    height: 20px;
}
.input-sub-button {
    padding: 0;
    background: none;
    border: none;
}
```

### `main/login/login.css`

```css
body {
    margin: 0;
    padding: 0;
}
.login-wrapper {
    display: flex;
    height: 100vh;
    background: linear-gradient(135deg, rgb(216, 144, 249) 0%, rgb(145, 185, 249) 50%, rgb(51, 242, 250) 100%);
    align-items: center;
    justify-content: center;
}
.login-container {
    background: rgba(255, 255, 255, 0.9);
    padding: 2em;
    border-radius: 10px;
    width: 300px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}
.login-container .login-logo {
    display: block;
    margin: 0 auto 1.5em;
    width: 150px;
}
.login-container .login-form {
    display: flex;
    flex-direction: column;
}
.login-container .login-form .form-group {
    margin-bottom: 1em;
}
.login-container .login-form .form-group input {
    border: 1px solid #ccc;
    border-radius: 5px;
    padding: 0.5em;
    font-size: 1em;
}
.login-container .login-form .login-button {
    background: #00704a;
    color: white;
    border: none;
    padding: 0.7em;
    font-size: 1em;
    border-radius: 5px;
    cursor: pointer;
    transition: background 0.3s;
}
.login-container .login-form .login-button:hover {
    background: #005237;
}
```

### `main/campaign/campaign_list.css`

```css
label {
    position: relative;
}
img {
    border: none;
    background: none;
}
.left {
    text-align: left;
    padding: 0 40px 0 15px;
}
.campaign-container {
    display: flex;
    flex-direction: column;
    align-items: stretch;
}
.campaign-filter {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    width: 680px;
    padding: 10px 10px 3px 10px;
    margin-left: 10px;
    border: 2px solid #e5e5e5;
    border-radius: 10px;
}
.channel-select-container {
    display: flex;
    align-items: center;
    margin: 0 10px;
    padding: 5px 0;
}
.title-input-container {
    display: flex;
    align-items: center;
    margin: 0 10px;
    padding: 5px 0;
}
.delivery-select-container {
    display: flex;
    align-items: center;
    margin: 0 10px;
    width: 100%;
    padding: 5px 0 10px 0;
}
.campaign-filter .item-text-channel,
.campaign-filter .item-text-title,
.campaign-filter .item-text-delivery-status,
.campaign-filter .item-text-delivery-type {
    width: 80px;
    font-weight: bold;
    margin: 0;
}
.select-delivery-status {
    height: 40px;
    width: 210px;
    color: #000000;
    font-size: 13px;
    border: 1px solid #c1c1c1;
    border-radius: 25px;
    padding: 0 8px;
    margin-right: 20px;
}
.channel-filter-container {
    display: flex;
    align-items: center;
    width: 95%;
    margin: 0 10px;
}

.item-select {
    display: flex;
    gap: 10px;
}
.item-input {
    border: 2px solid rgb(229, 229, 229);
    height: 40px; /* input 창의 높이를 조정합니다. */
    width: 520px;
    border-radius: 25px;
    padding-left: 10px;
    padding-right: 40px; /* clear 버튼을 위한 공간을 확보합니다. */
    box-sizing: border-box; /* padding이 요소의 총 너비에 포함되도록 합니다. */
}
.item-input-search {
    border: 2px solid rgb(229, 229, 229);
    height: 40px; /* input 창의 높이를 조정합니다. */
    width: 520px;
    border-radius: 25px;
    padding-left: 10px;
    padding-right: 40px; /* clear 버튼을 위한 공간을 확보합니다. */
    box-sizing: border-box; /* padding이 요소의 총 너비에 포함되도록 합니다. */
}
.item-search {
    display: flex;
    align-items: center;
    width: 34px;
    height: 34px;
}
.search-button {
    width: 34px;
    height: 34px;
}
.item-text {
    font-weight: bold;
    font-size: medium;
    padding: 10px 0;
}
.top-line {
    width: 97%;
    border-top: 1px solid #c2c2c2;
    margin: 0 10px;
}
.item-filter {
    width: 80px;
}
.filter-clear-wrap {

}

/*.item-filtered {
    padding: 4px 20px;
    background-color: #e3e3e3;
    color: black;
    border: none;
    font-size: 13px;
    border-radius: 25px;
}*/

/*.item-talk {
    background-color: #FFCC00;
}
.item-mms {
    background-color: #98B4FA;
    color: white;
}
.item-app {
    background-color: #A66FBF;
    color: white;
}
.item-email {
    background-color: #5856D6;
    color: white;
}
.item-onsite {
    background-color: #4F1287;
    color: white;
}*/

/*컨텐츠 목록*/
.list-button-container {
    display: flex;
    justify-content: space-between;
    height: 40px;
    margin: 20px 0 2px 0;
}
.view-mode-area {
    display: flex;
    height: 40px;
    /*    width: 160px;*/
    align-items: center;
}
.view-mode-area button {
    width: 30px;
    padding: 5px 0;
    height: 30px;
    border: none;
    background: none;
}
.view-mode-button svg {
    fill: #7f7f7f; /* default color */
}
.view-mode-button.active svg {
    fill: #C37AFF !important; /* active color */
}
.campaign-button-area {
    display: flex;
    height: 40px;
    align-items: center;
}
.campaign-journey-select {
    width: 135px;
    height: 30px;
    border: 1px solid #c2c2c2;
    border-radius: 5px;
    font-size: 14px;
}
.campaign-journey-button {
    width: 100px;
    height: 30px;
    color: #00704a;
    border-radius: 5px;
    border: 1px solid #00704a;
    margin: 0 2px;
    background: none;
    font-size: 14px;
    margin-right: 15px;
}
/*.campaign-journey-button img {
    position: absolute;
    transform: translate(-20px, -5px);
}*/


/*캠페인 목록*/
.campaign-list-container {
    width: 100%;
    margin-top: 10px;
}
.view-mode {
    width: 100%;
}

/*리스트 모드*/
#list-mode {
    width: 100%;
}
thead th {
    border-top: 2px solid #c2c2c2;
    border-bottom: 2px solid #c2c2c2;
    height: 50px;
    color: #7f7f7f;
}
th img {
    position: absolute;
    transform: translateY(-15px);
}
td {
    padding: 10px 15px;
    border-bottom: 1px solid #c2c2c2;
}
table {
    width: 100%;
    border-collapse: collapse;
}
tr {
    text-align: center;
}
/*.list-checkbox {
    width: 5%;
    font-size: 16px;
    !*width: 80px;*!
}*/
.list-execute {
    width: 3%;
    font-size: 16px;
}
.list-campaign-code {
    width: 7%;
    font-size: 16px;
    /*width: 160px;*/
}
.list-campaign-title {
    width: 20%;
    font-size: 16px;
}
.list-campaign-delivery-state {
    width: 8%;
    font-size: 16px;
    text-align: center;
    vertical-align: middle;
}

/*발송 채널 관련*/
.list-delivery-channel {
    width: 10%;
    font-size: 16px;
}
.item-delivering-type {
    position: absolute;
    transform: translate(-30px,-2px);
    font-size: 16px;
}
.list-delivery-type {
    width: 11%;
    font-size: 16px;
    /*width: 100px;*/
}
.list-delivery-date {
    font-size: 16px;
    /*width: 150px;*/
    width: 14%;
}
.list-create-date {
    font-size: 16px;
    width: 11%;
}
.list-modify-date {
    font-size: 16px;
    width: 11%;
}
.list-overflow {
    width: 5%;
    font-size: 16px;
    /*width: 80px;*/
}

/*tbody*/
/*.item-checkbox {
    width: 15px;
    height: 15px;
}*/
.campaign-execute {
    width: 3%;
}
.item-execute-button {
    width: 80px;
    height: 30px;
    padding: 0 10px;
    border-radius: 15px;
    font-size: 14px;
}
.delivery-run {
    background-color: #C37AFF;
    color: white;
}
.delivery-stop {
    background-color: #ffcc00;
    color: black;
}
.campaign-code {
    font-size: 14px;
    width: 7%;
}
.campaign-title {
    width: 20%;
    font-size: 14px;
}
.campaign-delivery-state {
    font-size: 14px;
    width: 8%;
    text-align: center;
    vertical-align: middle;
}
.campaign-delivery-channel {
    font-size: 14px;
    width: 10%;
}
.delivery-type {
    font-size: 14px;
    width: 11%;
    /*text-align: left;*/
}
.delivery-date {
    font-size: 14px;
    width: 14%;
}
.create-date {
    font-size: 14px;
    width: 11%;
}
.modify-date {
    font-size: 14px;
    width: 11%;
}
.overflow {
    font-size: 14px;
    width: 5%;
}

/*페이징 처리*/
.paging-container {
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px;
    margin-top: 20px;
}

.paging-item {
    height: 20px;
    color: black;
    float: left;
    padding: 10px 5px 5px 5px;
    text-decoration: none;
    transition: background-color .3s;
}
.paging-number {
    height: 20px;
    color: black;
    font-weight: bolder;
    padding: 10px;
    text-decoration: none;
    transition: background-color .3s;
}
.paging-item.active,
.paging-number.active {
    background-color: #4CAF50;
    color: white;
    border: 1px solid #4CAF50;
}

.paging-item:hover:not(.active),
.paging-number:hover:not(.active){
    background-color: #ddd;
}
```

### `main/campaign/campaign_create.css`

```css
section {
    margin: 5px 0;
}
label {
    font-weight: 600;
}
input:focus, textarea:focus {
    /*입력창 테두리 유지*/
    outline: none;
}
/*버튼 영역*/
.left-area .item-button {
    /*display: flex;
    transform: translateX(530px);*/
    text-align: right;
    padding-right: 140px;
}
.left-area .load-button,
.left-area .save-button{
    width: 70px;
    height: 30px;
    border: 1px solid #c2c2c2;
    border-radius: 6px;
    margin: 0 2px;
}
.left-area .regi-button {
    width: 50px;
    height: 30px;
    border: 1px solid rgb(0, 112, 74);
    border-radius: 6px;
    margin: 0 2px;
}
.load-button, .save-button {
    background-color: #ffffff;
}
.regi-button {
    background-color: rgb(0, 112, 74);
    color: white;
}
/*캠페인 정보*/
.title-container {
    padding: 0 20px;
}
.item-text,
.item-input {
    display: block;
}
.item-text {
    font-weight: bold;
    font-size: medium;
    margin: 15px 0;
}
.item-input {
    width: 690px;
    height: 40px;
    border: 1px solid #c2c2c2;
    padding-right: 40px; /* clear 버튼을 위한 공간을 확보합니다. */
    box-sizing: border-box; /* padding이 요소의 총 너비에 포함되도록 합니다. */
    padding-left: 10px;
    border-radius: 25px;
    margin: 5px 10px;
}
.campaign-campaign-container {
    display: none;
}
.campaign-condition {
    width: 650px;
    height: 200px;
    margin-left: 10px;
    border-radius: 15px;
    padding: 20px;
    background-color: rgba(152, 180, 250, 0.25);
}
.campaign-label {
    width: 100%;
    height: 50px;
    display: flex;
    flex-direction: row;
    align-items: center;
}
.item-label {
    font-weight: 600;
    font-size: 14px;
    width: 100px;
}
.item-text-summary{
    width: 550px;
    height: 40px;
    border-radius: 20px;
    padding-left: 10px;
    border: 1px solid #c2c2c2;
}
.item-select {
    width: 130px;
    height: 40px;
    border-radius: 20px;
    padding-left: 10px;
    margin-right: 5px;
    border: 1px solid #c2c2c2;
}
.item-select-division {
    width: 275px;
    height: 40px;
    border-radius: 20px;
    padding-left: 10px;
    margin-right: 15px;
    border: 1px solid #c2c2c2;
}
.item-input-name {
    width: 250px;
    height: 36px;
    border-radius: 20px;
    padding-left: 10px;
    margin-right: 15px;
    border: 1px solid #c2c2c2;
}

/*세그먼트 등록*/
.segment-container {
    padding: 0 10px;
}
.segment-regi {
    margin: 35px 0;
}
.segment-load-container {
    padding: 0 10px;
}
.item-load {
    width: 160px;
    height: 45px;
    border: 1px dashed #c2c2c2;
    border-radius: 25px;
    margin: 10px;
    text-align: left;
    padding-left: 15px;
    display: flex;
    align-items: center;
    color: #00704a;
}
#modal-seg-load {
    display: none;
    width: 750px;
    height: 600px;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: #94bbfa;
}
/*세그먼트 등록 후*/
.segment-loaded-container {
    width: 653px;
    height: 150px;
    margin-left: 15px;
    border: 1px solid #c2c2c2;
    border-radius: 15px;
    padding: 20px;
}
.segment-info-container {
    width: 650px;
    height: 70px;
    padding-bottom: 3px;
}
.segment-info {
    display: flex;
}
.segment-send-type {
    background-color: rgba(0,0,0,0.08);
    padding: 3px 7px;
    border-radius: 8px;
    font-size: 12px;
    color: #000000;
}
.segment-title {
    /*display: flex;*/
    align-items: center;
    margin-left: 5px;
    color: #030303;
    font-size: 14px;
    font-weight: 600;
    line-height: 18px;
}
.segment-result {
    height: 30px;
    margin-top: 10px;
}
.segment-result span {
    color: #7f7f7f;
    font-size: 14px;
}

.segment-result-container {
    width: 650px;
    height: 70px;
    border-top: 1px solid #c1c1c1;
}
.segment-expect-count {
    display: flex;
    align-items: center;
    margin-top: 20px;
}
.segment-caution {
    margin-top: 5px;
}
.segment-caution span {
    font-size: 12px;
    color: #7f7f7f;
}
.target-parameter {
    font-size: 14px;
    font-weight: bold;
}
.parameter-count {
    font-size: 14px;
    font-weight: bold;
}
.item-refresh {
    display: flex;
    align-items: center;
}
/*발송 컨텐츠 등록*/
.send-contents-container {
    padding: 0 10px;
    height: auto;
}
.item-switch-label {
    margin: 0 10px;
}
.contents-load-container {
    padding: 20px;
    width: 653px;
    margin-left: 15px;
    margin-top: 10px;
    border: 1px solid #c2c2c2;
    border-radius: 10px;
}
.send-contents {
    margin-bottom: 23px;
}
.next-page-container {
    height: 100px;
    width: 100%;
    flex-shrink: 0;
    display: flex;
    justify-content: center;
    align-items: center;
}
.next-page-button {
    width: 90px;
    height: 30px;
    border-radius: 20px;
    color: white;
    background-color: #00704a;
}


/*스위치 설정*/
/* 슬라이더 주변 상자 */
.switch {
    position: relative;
    display: inline-block;
    width: 53px;
    height: 25px;
}

/* HTML 기본 체크박스 숨기기 */
.switch input {
    opacity: 0;
    width: 0;
    height: 0;
}

/* 슬라이더 효과 */
.slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    -webkit-transition: .4s;
    transition: .4s;
}

.slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 4px;
    bottom: 4px;
    background-color: white;
    -webkit-transition: .4s;
    transition: .4s;
}

input:checked + .slider {
    background-color: #00704a;
}

input:focus + .slider {
    box-shadow: 0 0 1px #00704a;
}

input:checked + .slider:before {
    -webkit-transform: translateX(26px);
    -ms-transform: translateX(26px);
    transform: translateX(26px);
}

/* 둥근스위치버튼 스타일 및 효과 */
.slider.round {
    border-radius: 34px;
}

.slider.round:before {
    border-radius: 50%;
}

/*발송 컨텐츠 등록(on)*/
.contents-regi {
    display: flex;
}
.contents-select {
    display: flex;
    height: 25px;
    margin: 10px 10px;
}
.item-button-select {
    width: 25px;
    height: 25px;
    border: none;
    background-color: #f2f2f2;
    color: black;
    font-size: 13px;
    border-radius: 5px;
    margin-right: 3px;
    transition: background-color 0.3s ease;
}
.add-remove-area {
    display: flex;
    height: 25px;
    margin: 10px 0;
}
.add, .remove {
    padding: 0;
}
.item-button-select:hover {
    background-color: #98b4fa;
}
.selected {
    background-color: #c37aff;
    color: white;
}
.contents-select-container {
    width: 653px;
    margin: 10px 15px;
    border-radius: 15px;
    padding: 20px;
    border: 1px solid #c2c2c2;
}
.send-limit {
    display: flex;
    flex-direction: column;
    height: 130px;
    background-color: white;
}
.item-input-limit {
    width: 80px;
    height: 30px;
    border-radius: 10px;
    padding-left: 5px;
    margin: 5px;
    border: 1px solid #c2c2c2;
}
.item-select-unit {
    width: 50px;
    height: 35px;
    border-radius: 10px;
    padding-left: 5px;
    border: 1px solid #c2c2c2;
}
.no-send {
    margin: 0 2px;
    display: flex;
    align-items: center;
}
.contents-loaded {
    height: 165px;
    margin: 10px;
    border: 3px solid #98b4fa;
    border-radius: 5px;
}

.item-sending {
    background-color: #e91e63;
    color: white;
}
.item-talk {
    background-color: #FFCC00;
}
.item-mms {
    background-color: #98B4FA;
    color: white;
}
.item-app {
    background-color: #A66FBF;
    color: white;
}
.item-email {
    background-color: #5856D6;
    color: white;
}
.item-onsite {
    background-color: #4F1287;
    color: white;
}
.segment-loaded-info {
    display: flex;
    padding: 10px 5px;
    justify-content: space-between;
}
.edit-clear-area {
    padding: 0;
}
.edit-clear-area button img {
    margin: 0;
}
.edit-button {
    padding: 0;
}
.segment-clear-button {
    padding: 0;
}
.segment-loaded-title {
    display: flex;
    padding: 5px 15px;
    flex-direction: column;
}
.item-text-title {
    color: #7f7f7f;
    font-size: 14px;
}
.segment-loaded-content {
    display: flex;
    padding: 10px 15px;
    flex-direction: column;
}
.item-text-contents {
    color: #7f7f7f;
    font-size: 14px;
}
.contents-load-button {
    width: 630px;
    height: 60px;
    border: 1px dotted #c2c2c2;
    border-radius: 10px;
    justify-content: center;
    align-items: center;
    display: flex;
    color: #00704a;
}

/*오퍼*/
.offer {
    display: flex;
    flex-direction: column;
    margin-top: 35px;
}
.offer-load-container {
    display: flex;
}
.offer-loaded-left-area {
    width: calc(50% - 25px);
    padding: 15px 10px;
    margin: 10px;
    border: 1px solid #c2c2c2;
    border-radius: 5px;
}
.offer-loaded-right-area {
    display: flex;
    width: calc(50% - 25px);
    height: 120px;
    margin: 10px;
    padding: 15px 10px;
    border: 1px dotted #c2c2c2;
    border-radius: 5px;
    justify-content: center;
    align-items: center;
}
.offer-loaded {

}
.offer-loaded-head {
    display: flex;
    justify-content: flex-start;
    padding-top: 5px;
}

/*향후 오퍼 타입에 따라 클래스명 변경*/
.offer-type-xxx {

}
.offer-title {
    display: flex;
    align-items: center;
    margin-left: 5px;
    color: #030303;
    font-size: 14px;
    font-weight: 600;
    line-height: 18px;
}
.offer-loaded-body {
    display: flex;
    flex-direction: column;
    padding: 5px;
    color: #030303;
}
.item-offer-load-button {
    width: 150px;
    height: 30px;
    justify-content: center;
    align-items: center;
    display: flex;
    color: #00704a;
}
.item-offer-label {
    font-size: 14px;
}
.offer-amount, .offer-condition, .offer-period {
    font-size: 14px;
}
```

### `main/campaign/campaign_update.css`

```css
section {
    margin: 5px 0;
}
label {
    font-weight: 600;
}
input:focus, textarea:focus {
    /*입력창 테두리 유지*/
    outline: none;
}
/*버튼 영역*/
.left-area .item-button {
    /*display: flex;
    transform: translateX(530px);*/
    text-align: right;
    padding-right: 140px;
}
.left-area .load-button,
.left-area .save-button{
    width: 70px;
    height: 30px;
    border: 1px solid #c2c2c2;
    border-radius: 6px;
    margin: 0 2px;
}
.left-area .regi-button {
    width: 50px;
    height: 30px;
    border: 1px solid rgb(0, 112, 74);
    border-radius: 6px;
    margin: 0 2px;
}
.load-button, .save-button {
    background-color: #ffffff;
}
.regi-button {
    background-color: rgb(0, 112, 74);
    color: white;
}
/*캠페인 정보*/
.title-container {
    padding: 0 20px;
}
.item-text,
.item-input {
    display: block;
}
.item-text {
    font-weight: bold;
    font-size: medium;
    margin: 15px 0;
}
.item-input {
    width: 690px;
    height: 40px;
    border: 1px solid #c2c2c2;
    padding-right: 40px; /* clear 버튼을 위한 공간을 확보합니다. */
    box-sizing: border-box; /* padding이 요소의 총 너비에 포함되도록 합니다. */
    padding-left: 10px;
    border-radius: 25px;
    margin: 5px 10px;
}
.campaign-container {
    display: none;
}
.campaign-condition {
    width: 650px;
    height: 200px;
    margin-left: 10px;
    border-radius: 15px;
    padding: 20px;
    background-color: rgba(152, 180, 250, 0.25);
}
.campaign-label {
    width: 100%;
    height: 50px;
    display: flex;
    flex-direction: row;
    align-items: center;
}
.item-label {
    font-weight: 600;
    font-size: 14px;
    width: 100px;
}
.item-text-summary{
    width: 550px;
    height: 40px;
    border-radius: 20px;
    padding-left: 10px;
    border: 1px solid #c2c2c2;
}
.item-select {
    width: 130px;
    height: 40px;
    border-radius: 20px;
    padding-left: 10px;
    margin-right: 5px;
    border: 1px solid #c2c2c2;
}
.item-select-division {
    width: 275px;
    height: 40px;
    border-radius: 20px;
    padding-left: 10px;
    margin-right: 15px;
    border: 1px solid #c2c2c2;
}
.item-input-name {
    width: 250px;
    height: 36px;
    border-radius: 20px;
    padding-left: 10px;
    margin-right: 15px;
    border: 1px solid #c2c2c2;
}

/*세그먼트 등록*/
.segment-container {
    padding: 0 10px;
}
.segment-regi {
    margin: 35px 0;
}
.segment-load-container {
    padding: 0 10px;
}
.item-load {
    width: 160px;
    height: 45px;
    border: 1px dashed #c2c2c2;
    border-radius: 25px;
    margin: 10px;
    text-align: left;
    padding-left: 15px;
    display: flex;
    align-items: center;
    color: #00704a;
}
#modal-seg-load {
    display: none;
    width: 750px;
    height: 600px;
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: #94bbfa;
}
/*세그먼트 등록 후*/
.segment-loaded-container {
    width: 653px;
    height: 150px;
    margin-left: 15px;
    border: 1px solid #c2c2c2;
    border-radius: 15px;
    padding: 20px;
}
.segment-info-container {
    width: 650px;
    height: 70px;
    padding-bottom: 3px;
}
.segment-info {
    display: flex;
}
.segment-send-type {
    background-color: rgba(0,0,0,0.08);
    padding: 3px 7px;
    border-radius: 8px;
    font-size: 12px;
    color: #000000;
}
.segment-title {
    /*display: flex;*/
    align-items: center;
    margin-left: 5px;
    color: #030303;
    font-size: 14px;
    font-weight: 600;
    line-height: 18px;
}
.segment-result {
    height: 30px;
    margin-top: 10px;
}
.segment-result span {
    color: #7f7f7f;
    font-size: 14px;
}

.segment-result-container {
    width: 650px;
    height: 70px;
    border-top: 1px solid #c1c1c1;
}
.segment-expect-count {
    display: flex;
    align-items: center;
    margin-top: 20px;
}
.segment-caution {
    margin-top: 5px;
}
.segment-caution span {
    font-size: 12px;
    color: #7f7f7f;
}
.target-parameter {
    font-size: 14px;
    font-weight: bold;
}
.parameter-count {
    font-size: 14px;
    font-weight: bold;
}
.item-refresh {
    display: flex;
    align-items: center;
}
/*발송 컨텐츠 등록*/
.send-contents-container {
    padding: 0 10px;
    height: auto;
}
.item-switch-label {
    margin: 0 10px;
}
.contents-load-container {
    padding: 20px;
    width: 653px;
    margin-left: 15px;
    margin-top: 10px;
    border: 1px solid #c2c2c2;
    border-radius: 10px;
}
.send-contents {
    margin-bottom: 23px;
}
.next-page-container {
    height: 100px;
    width: 100%;
    flex-shrink: 0;
    display: flex;
    justify-content: center;
    align-items: center;
}
.next-page-button {
    width: 90px;
    height: 30px;
    border-radius: 20px;
    color: white;
    background-color: #00704a;
}

/*스위치 설정*/
/* 슬라이더 주변 상자 */
.switch {
    position: relative;
    display: inline-block;
    width: 53px;
    height: 25px;
}

/* HTML 기본 체크박스 숨기기 */
.switch input {
    opacity: 0;
    width: 0;
    height: 0;
}

/* 슬라이더 효과 */
.slider {
    position: absolute;
    cursor: pointer;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: #ccc;
    -webkit-transition: .4s;
    transition: .4s;
}

.slider:before {
    position: absolute;
    content: "";
    height: 18px;
    width: 18px;
    left: 4px;
    bottom: 4px;
    background-color: white;
    -webkit-transition: .4s;
    transition: .4s;
}

input:checked + .slider {
    background-color: #00704a;
}

input:focus + .slider {
    box-shadow: 0 0 1px #00704a;
}

input:checked + .slider:before {
    -webkit-transform: translateX(26px);
    -ms-transform: translateX(26px);
    transform: translateX(26px);
}

/* 둥근스위치버튼 스타일 및 효과 */
.slider.round {
    border-radius: 34px;
}

.slider.round:before {
    border-radius: 50%;
}

/*발송 컨텐츠 등록(on)*/
.contents-regi {
    display: flex;
}
.contents-select {
    display: flex;
    height: 25px;
    margin: 10px 10px;
}
.item-button-select {
    width: 25px;
    height: 25px;
    border: none;
    background-color: #f2f2f2;
    color: black;
    font-size: 13px;
    border-radius: 5px;
    margin-right: 3px;
    transition: background-color 0.3s ease;
}
.add-remove-area {
    display: flex;
    height: 25px;
    margin: 10px 0;
}
.add, .remove {
    padding: 0;
}
.item-button-select:hover {
    background-color: #98b4fa;
}
.selected {
    background-color: #c37aff;
    color: white;
}
.contents-select-container {
    width: 653px;
    margin: 10px 15px;
    border-radius: 15px;
    padding: 20px;
    border: 1px solid #c2c2c2;
}
.send-limit {
    display: flex;
    flex-direction: column;
    height: 130px;
    background-color: white;
}
.item-input-limit {
    width: 80px;
    height: 30px;
    border-radius: 10px;
    padding-left: 5px;
    margin: 5px;
    border: 1px solid #c2c2c2;
}
.item-select-unit {
    width: 50px;
    height: 35px;
    border-radius: 10px;
    padding-left: 5px;
    border: 1px solid #c2c2c2;
}
.no-send {
    margin: 0 2px;
    display: flex;
    align-items: center;
}
.contents-loaded {
    height: 165px;
    margin: 10px;
    border: 3px solid #98b4fa;
    border-radius: 5px;
}

.item-sending {
    background-color: #e91e63;
    color: white;
}
.item-talk {
    background-color: #FFCC00;
}
.item-mms {
    background-color: #98B4FA;
    color: white;
}
.item-app {
    background-color: #A66FBF;
    color: white;
}
.item-email {
    background-color: #5856D6;
    color: white;
}
.item-onsite {
    background-color: #4F1287;
    color: white;
}
.segment-loaded-info {
    display: flex;
    padding: 10px 5px;
    justify-content: space-between;
}
.edit-clear-area {
    padding: 0;
}
.edit-clear-area button img {
    margin: 0;
}
.edit-button {
    padding: 0;
}
.segment-clear-button {
    padding: 0;
}
.segment-loaded-title {
    display: flex;
    padding: 5px 15px;
    flex-direction: column;
}
.item-text-title {
    color: #7f7f7f;
    font-size: 14px;
}
.segment-loaded-content {
    display: flex;
    padding: 10px 15px;
    flex-direction: column;
}
.item-text-contents {
    color: #7f7f7f;
    font-size: 14px;
}
.contents-load-button {
    width: 630px;
    height: 60px;
    border: 1px dotted #c2c2c2;
    border-radius: 10px;
    justify-content: center;
    align-items: center;
    display: flex;
    color: #00704a;
}

/*오퍼*/
.offer {
    display: flex;
    flex-direction: column;
    margin-top: 35px;
}
.offer-load-container {
    display: flex;
}
.offer-loaded-left-area {
    width: calc(50% - 25px);
    padding: 15px 10px;
    margin: 10px;
    border: 1px solid #c2c2c2;
    border-radius: 5px;
}
.offer-loaded-right-area {
    display: flex;
    width: calc(50% - 25px);
    height: 120px;
    margin: 10px;
    padding: 15px 10px;
    border: 1px dotted #c2c2c2;
    border-radius: 5px;
    justify-content: center;
    align-items: center;
}
.offer-loaded {

}
.offer-loaded-head {
    display: flex;
    justify-content: flex-start;
    padding-top: 5px;
}

/*향후 오퍼 타입에 따라 클래스명 변경*/
.offer-type-xxx {

}
.offer-title {
    display: flex;
    align-items: center;
    margin-left: 5px;
    color: #030303;
    font-size: 14px;
    font-weight: 600;
    line-height: 18px;
}
.offer-loaded-body {
    display: flex;
    flex-direction: column;
    padding: 5px;
    color: #030303;
}
.item-offer-load-button {
    width: 150px;
    height: 30px;
    justify-content: center;
    align-items: center;
    display: flex;
    color: #00704a;
}
.item-offer-label {
    font-size: 14px;
}
.offer-amount, .offer-condition, .offer-period {
    font-size: 14px;
}
```

### `main/campaign/campaign_detail.css`

```css
.hidden {
    display: none;
}
input:focus, textarea:focus {
    /*입력창 테두리 유지*/
    outline: none;
}


/*캠페인 정보 확인*/
.campaign-info-container {
    padding: 10px 20px;
    width: 1100px;
    display: flex;
    justify-content: space-between;
}
.campaign-confirm-container {
    padding: 20px;
}
label {
    font-weight: 600;
}
.campaign-info-confirm {
    display: flex;
    flex-direction: column;
    width: 770px;
    padding: 15px 23px;
    margin: 20px 10px;
    border-radius: 10px;
    background-color: rgba(152, 180, 250, 0.2);
}


.campaign-info-confirm label {
    display: inline-block;
    width: 100px;
    font-weight: 600;
}
.campaign-info-confirm div {
    margin: 5px 0;
}
.campaign-code {
    width: 600px;
    height: 35px;
    color: #000000;
    font-size: 13px;
    padding: 0 10px;
}
.campaign-title {
    width: 600px;
    height: 35px;
    padding: 0 15px;
    color: #000000;
    font-size: 13px;
    border-radius: 25px;
    border: 1px solid #c2c2c2;
}
.campaign-summary {
    width: 600px;
    height: 35px;
    padding: 0 15px;
    color: #000000;
    font-size: 13px;
    border-radius: 25px;
    border: 1px solid #c2c2c2;
}
.campaign-promotion {
    width: 115px;
    height: 35px;
    padding: 0 15px;
    color: #000000;
    font-size: 13px;
    border-radius: 25px;
    border: 1px solid #c2c2c2;
    margin-right: 10px;
}
.campaign-purpose {
    width: 115px;
    height: 35px;
    padding: 0 15px;
    color: #000000;
    font-size: 13px;
    border-radius: 25px;
    border: 1px solid #c2c2c2;
    margin-right: 10px;
}
.marketing-purpose {
    width: 115px;
    height: 35px;
    padding: 0 15px;
    color: #000000;
    font-size: 13px;
    border-radius: 25px;
    border: 1px solid #c2c2c2;
    margin-right: 10px;
}
.marketing-step {
    width: 115px;
    height: 35px;
    padding: 0 15px;
    color: #000000;
    font-size: 13px;
    border-radius: 25px;
    border: 1px solid #c2c2c2;
    margin-right: 10px;
}
.campaign-division {
    width: 275px;
    height: 35px;
    padding: 0 15px;
    color: #000000;
    font-size: 13px;
    border-radius: 25px;
    border: 1px solid #c2c2c2;
    margin-right: 10px;
}
.campaign-manager {
    width: 275px;
    height: 35px;
    padding: 0 15px;
    color: #000000;
    font-size: 13px;
    border-radius: 25px;
    border: 1px solid #c2c2c2;
    margin-right: 10px;
}

/*발송 정보 확인*/
.send-info-container {
    padding: 20px;
}
.send-info-confirm {
    display: flex;
    flex-direction: column;
    width: 1100px;
    padding: 15px 40px;
    margin: 20px 10px;
    border-radius: 10px;
    border: 1px solid #c2c2c2;
}
.segment-info-container {
    display: flex;
    padding: 20px 0;
    border-bottom: 2px solid #e3e3e3;
}
.item-label {
    padding: 0 10px;
    width: 120px;
}
.segment-info-confirm {
    width: 700px;
}
.segment-send-type {
    background-color: rgb(0, 0, 0, 0.08);
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 14px;
}
.segment-title {
    font-size: 14px;
}
.segment-result {
    color: #7f7f7f;
    font-size: 12px;
    padding-top: 7px;
}
.parameters-info-confirm {
    display: flex;
    flex-direction: column;
}
.parameters-info {
    display: flex;
    flex-direction: column;
}
.parameters-count {
    border: 2px solid #00704a;
    border-radius: 25px;
    padding: 8px 25px;
    font-size: 14px;
    font-weight: bold;
}
.item-label-explanation {
    text-align: center;
    margin-top: 6px;
}
.contents-info-confirm {
    display: flex;
    padding: 20px 0;
    border-bottom: 2px solid #e3e3e3;
}
.contents-info {
    display: flex;
    flex-direction: column;
    width: 950px;
}
.ab-test-boolean {
    padding: 0 0 10px 0;
}
.contents-title {
    padding: 10px 0;
}
.contents-offer {
    padding: 10px 0 0 0;
}
.test-period {
    margin: 10px 0;
}
.ab-test-contents {
    display: flex;

}
.contents-info-confirm-a {
    width: 430px;
    height: 200px;
    margin: 10px;
    padding: 10px;
    border: 2px solid #98b4fa;
    border-radius: 10px;
    display: flex;
}
.contents-info-confirm-b {
    width: 430px;
    height: 200px;
    margin: 10px;
    padding: 10px;
    border: 2px solid #98b4fa;
    border-radius: 10px;
    display: flex;
}
.contents-type {
    width: 35px;
    height: 35px;
    border-radius: 5px;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #00704a;
    color: #ffffff;
}
.contents-condition-info {
    display: flex;
    flex-direction: column;
    padding: 5px 10px;
}
.send-rate {
    padding: 0 10px 10px 10px;
    border-bottom: 2px solid #e3e3e3;
}
.readonly-data {
    border: none;
    width: 200px;
    font-size: 14px;
}
.contents-state {
    display: flex;
    padding: 10px;
    border-bottom: 2px solid #e3e3e3;
}
.contents-state-info {

}
.selected-contents {
    margin: 5px 0;
}
.info-label {
    display: inline-block;
    width: 80px;
    font-weight: 600;
}
.offer-stat {
    display: flex;
    padding: 10px;
}
.send-rank-info {
    display: flex;
}
.send-rank-confirm {
    display: flex;
    padding: 20px 0;
    border-bottom: 2px solid #e3e3e3;
}
.send-rank {
    width: 150px;
}
.send-type-confirm {
    display: flex;
    padding: 20px 0;
    border-bottom: 2px solid #e3e3e3;
}
.send-period-confirm {
    display: flex;
    padding: 20px 0;
    border-bottom: 2px solid #e3e3e3;
}
.not-send-cycle-confirm {
    display: flex;
    padding: 20px 0;
    border-bottom: 2px solid #e3e3e3;
}
.fatigue-confirm {
    display: flex;
    padding: 20px 0;
    border-bottom: 2px solid #e3e3e3;
}
.tester-confirm {
    display: flex;
    padding: 20px 0;
    border-bottom: 2px solid #e3e3e3;
}
.add-test-button {
    font-size: 12px;
    width: 75px;
    height: 25px;
    border: 1px solid #00704a;
    border-radius: 15px;
    color: #00704a;
}
.check-random-data {
    margin-left: auto;
}

.approval-confirm {
    display: flex;
    padding: 20px 0;
}
.select-approval-button {
    font-size: 12px;
    width: 75px;
    height: 25px;
    border: 1px solid #00704a;
    border-radius: 15px;
    color: #00704a;
}
.check-no-approval-procedure {
    margin-right: 45px;
    margin-left: auto;
}
.delivery-approval-container {
    height: 100px;
    width: 100%;
    flex-shrink: 0;
    display: flex;
    justify-content: center;
    align-items: center;
}

.delivery-test-button {
    width: 105px;
    height: 30px;
    border-radius: 20px;
    color: white;
    background-color: #c1c1c1;
    margin-right: 10px;
    font-size: 14px;
}
.approval-request-button {
    width: 105px;
    height: 30px;
    border-radius: 20px;
    color: white;
    background-color: #c1c1c1;
    margin-left: 10px;
    font-size: 14px;
}

/*활성화 시*/
/*
.delivery-test-button {
    width: 105px;
    height: 30px;
    border-radius: 20px;
    color: #00704a;
    border: 1px solid #00704a;
    background-color: #ffffff;
    margin-right: 10px;
    font-weight: bold;
}
.approval-request-button {
    width: 105px;
    height: 30px;
    border-radius: 20px;
    color: white;
    background-color: #00704a;
    margin-left: 10px;
    font-weight: bold;
}*/
.no-click {
    pointer-events: none;
    cursor: default;
}
.help-random-date {
    transform: translate(0px, 5px);
}
.help-description {
    position: absolute;
    background-color: #f9f9f9;
    min-width: 160px;
    border: 1px solid #7f7f7f;
    z-index: 2;
    padding: 5px;
    border-radius: 5px;
    font-size: 12px;
    color: #7f7f7f;
    transform: translate(-212px, -50px);
}
```

### `main/campaign/campaign_set.css`

```css
section {
    margin: 5px 0;
}
.hidden {
    display: none;
}
/*button img {
    margin: 0 5px;
}*/
label {
    font-weight: 600;
}
.item-label {
    margin: 20px 0 0 20px;
}
input:focus, textarea:focus {
    /*입력창 테두리 유지*/
    outline: none;
}

.load-button,
.save-button{
    width: 70px;
    height: 30px;
    border: 1px solid #c2c2c2;
    border-radius: 6px;
    margin: 0 2px;
}
.regi-button {
    width: 50px;
    height: 30px;
    border: 1px solid rgb(0, 112, 74);
    border-radius: 6px;
    margin: 0 2px;
}


/*캠페인 정보*/
.campaign-container {
    display: flex;
    flex-direction: column;
}
.schedule-set {
    display: flex;
    flex-direction: column;
    height: auto;
}
.schedule-regular-container {
    margin: 15px 20px;
}
.campaign-schedule-container {
    margin: 15px 0 0 20px;
}
.item-input-radio {
    /*font-weight: normal !important;*/
}
/*정기적으로 발송*/
.schedule-set-container {
    display: none;
    border: 1px solid #c2c2c2;
    width: 1000px;
    flex-direction: column;
    border-radius: 10px;
    padding: 20px;
}
.campaign-send-type {
    margin: 10px 20px 15px 20px;
}
.campaign-schedule-set {
    display: flex;
    flex-direction: column;
    margin: 10px 20px 25px 20px;
    padding: 20px;
    border-radius: 10px;
    background-color: rgba(152, 180, 250, 0.2);
    width: 800px;
}

.item-send-date {
    margin: 10px 0;
}
.item-label-date {
    font-size: 14px;
    font-weight: 500;
    margin: 0 5px;
}
.input-start-date {
    margin-right: 11px;
    border-radius: 5px;
    border: 1px solid #7f7f7f;
}
.input-end-date {
    margin-right: 5px;
    border-radius: 5px;
    border: 1px solid #7f7f7f;
}

.send-reserve-date {
    margin: 0 20px 25px 20px;
}
.send-reserve-date input {
    border-radius: 5px;
    border: 1px solid #7f7f7f;
}

/*ab test 기간 입력*/
.ab-test-date {
    width: 650px;
    height: 100px;
    border-radius: 10px;
    background-color: #d5ebff;
    margin: 10px 35px 20px 35px;
    padding: 10px 20px;
}

.item-send-cycle {
    margin: 10px 15px;
}
.send-cycle-hours {
    display: none;
    margin: 10px 35px;
    width: 690px;
    height: 25px;
}
.send-cycle-days {
    display: none;
    margin: 10px 35px;
    width: 690px;
    height: 25px;
}
.send-cycle-weeks {
    display: none;
    margin: 10px 35px;
    width: 690px;
    height: 25px;
}
.send-cycle-months {
    display: none;
    margin: 10px 35px;
    width: 690px;
    height: 55px;
}
.item-select-day {
    border-radius: 5px;
    width: 40px;
    margin-left: 5px;
    border: 1px solid #7f7f7f;
}
.item-select-date {
    border-radius: 5px;
    width: 65px;
    margin-left: 5px;
    border: 1px solid #7f7f7f;
}
.item-select-week {
    border-radius: 5px;
    width: 80px;
    margin-left: 5px;
    border: 1px solid #7f7f7f;
}
.item-select-time {
    border-radius: 5px;
    width: 100px;
    margin-right: 5px;
    border: 1px solid #7f7f7f;
}
.item-select-minute {
    border-radius: 5px;
    width: 50px;
    margin-left: 5px;
    border: 1px solid #7f7f7f;

}
.item-select-unit {
    border-radius: 5px;
    width: 50px;
    border: 1px solid #7f7f7f;
}
/*특정 행동시*/
.send-type-condition {
    display: none;
}
.send-type-condition label{
    display: block;
}
.item-not-applied {
    margin: 10px 15px;
}
.not-send-cycle-hours {
    margin: 10px 15px;
}

/*피로도*/
.item-fatigue {
    margin: 10px 25px;
}
.fatigue-condition {
    display: none;
    margin: 5px 25px;
    width: 690px;
    height: 25px;
}
.item-label-number {
    font-size: 13px;
    font-weight: 500;
    border-radius: 5px;
    border: 1px solid #7f7f7f;
    width: 38px;
}

/*발송 우선 순위*/
.campaign-priority-container {
    display: flex;
    flex-direction: column;
    margin-top: 30px;
}
.campaign-channel-priority {
    width: 650px;
    height: 144px;
    margin: 15px 25px;
    border: 1px solid #c2c2c2;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
}
.item-label-channel {
    display: flex;
    text-align: center;
    margin: 10px 15px;
}
.item-label-regi-channel {
    width: 130px;
    font-size: 14px;
    font-weight: 500;
    color: #000000;
}
.item-img-help {
    margin: 0 5px;
}
.item-help-regi-channel {
    font-size: 12px;
    background-color: rgba(0,0,0,0.08);
    color: #000000;
    border-radius: 10px;
    padding: 0 10px;
    font-weight: 300;
}

.channel-select-container {
    display: flex;
    align-items: center;
    margin: 0 15px;
    width: 410px;
    padding: 5px 0;
}
.item-select {
    width: 400px;
}
.item-channel {
    padding: 4px 20px;
    background-color: #f1f1f1;
    color: black;
    border: none;
    font-size: 13px;
    border-radius: 25px;
    cursor: pointer;
    transition: background-color 0.3s ease;
}
.item-channel.selected {
    background-color: #94bbfa;
}
.item-filtered {
    padding: 4px 20px;
    background-color: #e3e3e3;
    color: black;
    border: none;
    font-size: 13px;
    border-radius: 25px;
}
.item-sending {
    background-color: #e91e63;
    color: white;
}
.item-talk {
    background-color: #FFCC00;
}
.item-mms {
    background-color: #98B4FA;
    color: white;
}
.item-app {
    background-color: #A66FBF;
    color: white;
}
.item-email {
    background-color: #5856D6;
    color: white;
}
.item-onsite {
    background-color: #4F1287;
    color: white;
}
.send-channel-priority {
    height: 27px;
    margin: 20px 15px;
}
.item-rank {
    margin-right: 30px;
    font-size: 14px;
    color: #000000;
    font-weight: 500;
}
.item-selected {
    padding: 4px 30px 4px 12px;
    border: none;
    font-size: 13px;
    border-radius: 25px;
    margin-left: 5px;
}
```

### `main/campaign/campaign_confirm.css`

```css
.hidden {
    display: none;
}
input:focus, textarea:focus {
    /*입력창 테두리 유지*/
    outline: none;
}


/*캠페인 정보 확인*/
.campaign-confirm-container {
    padding: 20px;
}
label {
    font-weight: 600;
}
.campaign-info-confirm {
    display: flex;
    flex-direction: column;
    width: 770px;
    padding: 15px 23px;
    margin: 20px 10px;
    border-radius: 10px;
    background-color: rgba(152, 180, 250, 0.2);
}
.campaign-info-confirm label {
    display: inline-block;
    width: 100px;
    font-weight: 600;
}
.campaign-info-confirm div {
    margin: 5px 0;
}
.campaign-title {
    width: 600px;
    height: 35px;
    padding: 0 15px;
    color: #000000;
    font-size: 13px;
    border-radius: 25px;
    border: 1px solid #c2c2c2;
}
.campaign-summary {
    width: 600px;
    height: 35px;
    padding: 0 15px;
    color: #000000;
    font-size: 13px;
    border-radius: 25px;
    border: 1px solid #c2c2c2;
}
.campaign-promotion {
    width: 115px;
    height: 35px;
    padding: 0 15px;
    color: #000000;
    font-size: 13px;
    border-radius: 25px;
    border: 1px solid #c2c2c2;
    margin-right: 10px;
}
.campaign-purpose {
    width: 115px;
    height: 35px;
    padding: 0 15px;
    color: #000000;
    font-size: 13px;
    border-radius: 25px;
    border: 1px solid #c2c2c2;
    margin-right: 10px;
}
.marketing-purpose {
    width: 115px;
    height: 35px;
    padding: 0 15px;
    color: #000000;
    font-size: 13px;
    border-radius: 25px;
    border: 1px solid #c2c2c2;
    margin-right: 10px;
}
.marketing-step {
    width: 115px;
    height: 35px;
    padding: 0 15px;
    color: #000000;
    font-size: 13px;
    border-radius: 25px;
    border: 1px solid #c2c2c2;
    margin-right: 10px;
}
.campaign-division {
    width: 275px;
    height: 35px;
    padding: 0 15px;
    color: #000000;
    font-size: 13px;
    border-radius: 25px;
    border: 1px solid #c2c2c2;
    margin-right: 10px;
}
.campaign-manager {
    width: 275px;
    height: 35px;
    padding: 0 15px;
    color: #000000;
    font-size: 13px;
    border-radius: 25px;
    border: 1px solid #c2c2c2;
    margin-right: 10px;
}

/*발송 정보 확인*/
.send-info-container {
    padding: 20px;
}
.send-info-confirm {
    display: flex;
    flex-direction: column;
    width: 1100px;
    padding: 15px 40px;
    margin: 20px 10px;
    border-radius: 10px;
    border: 1px solid #c2c2c2;
}
.segment-info-container {
    display: flex;
    padding: 20px 0;
    border-bottom: 2px solid #e3e3e3;
}
.item-label {
    padding: 0 10px;
    width: 120px;
}
.segment-info-confirm {
    width: 700px;
}
.segment-send-type {
    background-color: rgb(0, 0, 0, 0.08);
    padding: 1px 8px;
    border-radius: 10px;
    font-size: 14px;
}
.segment-title {
    font-size: 14px;
}
.segment-result {
    color: #7f7f7f;
    font-size: 12px;
    padding-top: 7px;
}
.parameters-info-confirm {
    display: flex;
    flex-direction: column;
}
.parameters-info {
    display: flex;
    flex-direction: column;
}
.parameters-count {
    border: 2px solid #00704a;
    border-radius: 25px;
    padding: 8px 25px;
    font-size: 14px;
    font-weight: bold;
}
.item-label-explanation {
    text-align: center;
    margin-top: 6px;
}
.contents-info-confirm {
    display: flex;
    padding: 20px 0;
    border-bottom: 2px solid #e3e3e3;
}
.contents-info {
    display: flex;
    flex-direction: column;
}
.ab-test-boolean {
    margin: 0 0 10px 0;
}
/*.test-period {
    margin: 10px 0;
}*/
.ab-test-contents {
    display: flex;
}
.contents-info-confirm-a {
    width: 430px;
    height: 200px;
    margin: 10px;
    padding: 10px;
    border: 2px solid #98b4fa;
    border-radius: 10px;
    display: flex;
}
.contents-info-confirm-b {
    width: 430px;
    height: 200px;
    margin: 10px;
    padding: 10px;
    border: 2px solid #98b4fa;
    border-radius: 10px;
    display: flex;
}
.contents-type {
    width: 35px;
    height: 35px;
    border-radius: 5px;
    display: flex;
    justify-content: center;
    align-items: center;
    background-color: #00704a;
    color: #ffffff;
}
.contents-condition-info {
    display: flex;
    flex-direction: column;
    padding: 5px 10px;
}
.send-rate {
    padding: 0 10px 10px 10px;
    border-bottom: 2px solid #e3e3e3;
}
.readonly-data {
    border: none;
    width: 200px;
    font-size: 14px;
}
.contents-stat {
    display: flex;
    padding: 10px;
    border-bottom: 2px solid #e3e3e3;
}
.contents-stat-info {

}
.selected-contents {
    margin: 5px 0;
}
.info-label {
    display: inline-block;
    width: 80px;
    font-weight: 600;
}
.offer-stat {
    display: flex;
    padding: 10px;
}
.send-rank-info {
    display: flex;
}
.send-rank-confirm {
    display: flex;
    padding: 20px 0;
    border-bottom: 2px solid #e3e3e3;
}
.send-rank {
    width: 150px;
}
.send-type-confirm {
    display: flex;
    padding: 20px 0;
    border-bottom: 2px solid #e3e3e3;
}
.send-period-confirm {
    display: flex;
    padding: 20px 0;
    border-bottom: 2px solid #e3e3e3;
}
.not-send-cycle-confirm {
    display: flex;
    padding: 20px 0;
    border-bottom: 2px solid #e3e3e3;
}
.fatigue-confirm {
    display: flex;
    padding: 20px 0;
    border-bottom: 2px solid #e3e3e3;
}
.tester-confirm {
    display: flex;
    padding: 20px 0;
    border-bottom: 2px solid #e3e3e3;
}
.add-test-button {
    font-size: 12px;
    width: 75px;
    height: 25px;
    border: 1px solid #00704a;
    border-radius: 15px;
    color: #00704a;
}
.check-random-data {
    margin-left: auto;
}

.approval-confirm {
    display: flex;
    padding: 20px 0;
}
.select-approval-button {
    font-size: 12px;
    width: 75px;
    height: 25px;
    border: 1px solid #00704a;
    border-radius: 15px;
    color: #00704a;
}
.check-no-approval-procedure {
    margin-right: 45px;
    margin-left: auto;
}
```

### `main/contents/contents_list.css`

```css
label {
    position: relative;
}
img {
    border: none;
    background: none;
}
.highlight {
    background-color: #98b4fa; /* 배경색 */
    color: black; /* 텍스트 색상 */
    /*font-weight: bold; !* 폰트 강조 *!*/
    border-radius: 4px; /* 둥근 모서리 */
}
.left {
    text-align: left;
}
.folder-container {
    display: flex;
    flex-direction: column;
    margin: 10px 0;
}
.folder-breadcrumb {
    margin: 0;
    padding-left: 25px;
}
.folder-select-form {
    padding-left: 30px;
    margin: 10px 0;
    align-self: flex-start; /* form 요소를 왼쪽으로 정렬합니다 */
}

.folder-label-form, .contents-label-form, .contents-filter-label-form {
    padding-left: 25px;
    display: flex;
}
.folder-label, .contents-label, .contents-filter-label {
    font-weight: bold;
    font-size: 14px;
    align-content: center;
    width: 40px;
}
.contents-search-form {
    padding-left: 30px;
    margin: 10px 0;
    align-self: flex-start; /* form 요소를 왼쪽으로 정렬합니다 */
}
.contents-search-category-select {
    width: 105px;
    height: 30px;
    padding: 0 8px;
    border: 1px solid #c2c2c2;
    border-radius: 6px;
    font-size: 13px;
}
.contents-search-input {
    width: 400px;
    height: 40px;
    border: 1px solid #c1c1c1;
    border-radius: 20px;
    padding: 0 8px;
    font-size: 13px;
    margin-left: 13px;
}
.channel-container {
    display: inline-block;
}
.item-select-channel {
    display: flex;
    justify-content: start;
    align-items: center;
    flex-direction: row;
    gap: 10px;
    width: 560px;
    height: 30px;
    /*padding-left: 10px;*/
    border-radius: 25px;
    margin: 5px 10px;
}
.channel-select-button {
    padding: 4px 10px;
    text-align: center;
    width: 70px;
    background-color: #f1f1f1;
    color: black;
    border: none;
    font-size: 13px;
    border-radius: 25px;
    transition: background-color 0.1s ease;
}
.folder-list {
    display: flex;
    flex-direction: column; /* 리스트 아이템들을 세로로 정렬 */
    align-items: flex-start;
    list-style: none; /* 리스트 스타일 제거 */
    padding: 0;
    margin: 0;
}
.folder-grid-container {
    width: calc(100% - 60px);
    /*padding-left: 30px;*/
    margin: 10px 30px 10px 30px;
    height: 70px;
    align-self: flex-start; /* form 요소를 왼쪽으로 정렬합니다 */
}
/*폴더 생성 버튼 위치*/

/*콘텐츠 검색 위치*/
.content-container {
    display: flex;
    flex-direction: column;
    align-items: stretch;
}
.content-filter {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    width: 680px;
    height: 130px;
    padding: 10px;
    margin-left: 10px;
    border: 2px solid #e5e5e5;
    border-radius: 10px;
}
.channel-select-container {
    display: flex;
    align-items: center;
    margin: 0 10px;
    padding: 5px 0;
}
.title-input-container {
    display: flex;
    align-items: center;
    margin: 0 10px;
    padding: 10px 0;
}
.channel-filter-container {
    display: flex;
    align-items: center;
    width: 95%;
    margin: 0 10px;
}
.content-filter .item-text-channel,
.content-filter .item-text-title {
    width: 100px;
    font-weight: bold;
    margin: 0;
}
.item-select {
    display: flex;
    gap: 10px;
}
.item-input {
    border: 2px solid rgb(229, 229, 229);
    height: 35px; /* input 창의 높이를 조정합니다. */
    width: 517px;
    border-radius: 25px;
    padding-left: 10px;
    padding-right: 40px; /* clear 버튼을 위한 공간을 확보합니다. */
    box-sizing: border-box; /* padding이 요소의 총 너비에 포함되도록 합니다. */
}
.item-search {
    display: flex;
    align-items: center;
    width: 34px;
    height: 34px;
}
.search-button {
    width: 34px;
    height: 34px;
}
.item-text {
    font-weight: bold;
    font-size: medium;
    padding: 10px 0;
}
.top-line {
    width: 97%;
    border-top: 1px solid #c2c2c2;
    margin: 0 10px;
}
.item-filter {
    width: 100px;
}
/*컨텐츠 목록*/
.list-button-container {
    display: flex;
    height: 40px;
    right: 0;
    width: calc(100% - 585px);
    justify-content: flex-end;
}
.item-button-area {
    display: flex;
}
.view-mode-area {
    display: flex;
    height: 40px;
    align-items: center;
}
.view-mode-area button {
    width: 30px;
    padding: 5px 0;
    height: 30px;
    border: none;
    background: none;
}
.view-mode-button svg {
    fill: #7f7f7f; /* default color */
}
/*.view-mode-button.active svg {
    fill: #C37AFF
}*/
.contents-button-area {
    display: flex;
    height: 40px;
    align-items: center;
}
.contents-create-button{
    width: 80px;
    height: 30px;
    border-radius: 5px;
    border: 1px solid #c2c2c2;
    margin: 0 2px;
    background: none;
}
.contents-copy-button {
    width: 80px;
    height: 30px;
    border-radius: 5px;
    border: 1px solid #c2c2c2;
    margin: 0 2px;
    background: none;
}
.contents-delete-button {
    width: 50px;
    height: 30px;
    border-radius: 5px;
    border: 1px solid #f25656;
    color: #f25656;
    margin: 0 2px;
    background: none;
}

/*컨텐츠 목록*/
.content-list-container {
    width: 100%;
    margin-top: 10px;
}
.view-mode {
    width: 100%;
}

/*그리드 뷰*/
#grid-mode {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    grid-template-rows: repeat(2, 1fr);
    grid-gap: 20px;
}
.item-grid {
    width: 340px;
    height: 260px;
    border: 2px solid #e5e5e5;
    border-radius: 5px;
}
.item-option-box {
    padding: 10px;
    display: flex;
    justify-content: space-between;  /* Add this line */
    align-items: center; /* 아이템들을 수직 중앙에 배치 */
    gap: 3px; /* 아이템 사이의 간격 설정 */
}
.item-checkbox {
    width: 15px;
    height: 15px;
}
.list-item-channel {
    padding: 3px 15px;
    font-size: 13px;
    border: none;
    border-radius: 25px;
    transition: background-color 0.3s ease;
}
.item-overflow {
    width: 30px;
    height: 30px;
    padding: 5px;
    background: none;
    border: none;
    margin-left: auto;
}
.content-title {
    padding-left: 10px;
    font-weight: bolder;
}
.content-thumbnail {
    width: 95%;
    height: 140px;
    border-radius: 10px;
    margin: 10px auto 5px auto;
    background-color: #94bbfa;
}
.content-thumbnail img {
    width: 100%; /* 부모 요소의 크기에 맞춰 이미지가 너비를 채우게 합니다 */
    height: 100%; /* 부모 요소의 크기에 맞춰 이미지가 높이를 채우게 합니다 */
    object-fit: cover; /* 비율 유지를 위해 사용하며, 이미지가 지정된 너비와 높이에 맞춰 리사이징 되게합니다  */
    border-radius: 15px;
}
.last-update {
    padding-left: 10px;
    font-size: 14px;
    color: #c2c2c2;
}
.grid-last-modifier {
    padding-left: 5px;
    font-size: 14px;
    color: #c2c2c2;
}

/*리스트 모드*/
thead th {
    border-top: 2px solid #c2c2c2;
    border-bottom: 2px solid #c2c2c2;
    height: 50px;
}
th img {
    position: absolute;
    transform: translate(5px, 4px);
}
td {
    padding: 10px 0;
    border-bottom: 1px solid #c2c2c2;
}
table {
    width: 100%;
    border-collapse: collapse;
}
tr {
    text-align: center;
}
.list-checkbox {
    /*width: 40px;*/
    width: 5%;
}
.list-content-preview img {
    height: 100px;
    padding-top: 5px;
}
.list-contents-code {
    width: 10%;
}
.list-channel {
    width: 10%;
}
.list-contents-name {
    width: 30%;
    padding: 0 100px;
}
.list-linked-campaign {
    width: 10%;
}
.list-contents-modifier {
    width: 10%;
}
.list-last-update {
    width: 15%;
}
.list-content-option {
    width: 10%;
}



/*Grid & List 공통 사항*/
/* 그리드 및 리스트 항목에서 선택된 배경색 */
.item-table-tb-tr:hover {
    cursor: pointer;
}
.item-grid:hover {
    cursor: pointer;
}



/* 업데이트 사항 */
.folder-grid-container {
    display: flex; /* 요소를 가로로 정렬합니다 */
    flex-direction: row; /* 요소들의 방향을 가로로 설정합니다 */
    align-items: center; /* 수직 정렬을 중앙으로 맞춥니다 */
    gap: 20px; /* 버튼과 리스트 사이에 여백을 추가합니다 */
    padding-left: 30px;
    margin: 10px 0;
}

.folder-create-button {
    width: 200px;
    height: 66px;
    display: flex;
    justify-content: center; /* 버튼 내부 콘텐츠를 가로 중앙 정렬 */
    align-items: center; /* 버튼 내부 콘텐츠를 세로 중앙 정렬 */
    border: 2px solid #c2c2c2; /* 테두리 */
    border-radius: 8px; /* 둥근 모서리 */
}
.folder-create-button:active {
    transform: scale(0.95);
    transition: transform 0.1s;
}
.folder-grid {
    display: flex; /* 가로 나열 */
    list-style-type: none; /* 기본 리스트 스타일 제거 */
    padding: 0; /* 바깥 여백 제거 */
    margin: 0; /* 내부 여백 제거 */
    height: 70px;
    width: calc(100% - 300px);
}
.child-folder-grid {
    margin-right: 10px; /* 폴더 간 간격 조정 */
    list-style: none; /* 리스트 스타일 제거 */
    width: 200px;
    height: 66px;
    display: flex;
    justify-content: center; /* 버튼 내부 콘텐츠를 가로 중앙 정렬 */
    align-items: center; /* 버튼 내부 콘텐츠를 세로 중앙 정렬 */
    border: 2px solid #c2c2c2; /* 테두리 */
    border-radius: 8px; /* 둥근 모서리 */
    cursor: pointer;
}
.folder-overflow {
    width: 30px;
    height: 30px;
    display: flex; /* 중앙 정렬을 위한 FLEXBOX 사용 */
    justify-content: center; /* 가로 중앙 정렬 */
    align-items: center; /* 세로 중앙 정렬 */
    padding: 0; /* 여백 제거 */
    background: none;
    border: none;
    margin-left: 15px;
}

/* 드롭다운 메뉴 스타일 */
.folder-overflow-container {
    position: relative; /* 드롭다운 위치 기준 */
}

.folder-dropdown-menu {
    position: absolute;
    background: white;
    border: 1px solid #c2c2c2;
    border-radius: 4px;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    z-index: 10;
    transform: translate(120px, 50px); /*메뉴 위치*/
}

.folder-dropdown-menu button {
    border-bottom: 1px solid #c2c2c2;
    padding: 10px 20px; /* 내부 여백 추가 */
    cursor: pointer;
    font-size: 14px;
    text-align: left;
    transition: background-color 0.2s ease;
}
.folder-dropdown-menu button:hover {
    background-color: #f2f2f2;
}
.hidden {
    display: none;
}

/*페이징 스타일*/
.paging-number a{
    color: #c2c2c2; /* 나머지 페이지 번호 색상 */
    font-size: 16px;
    cursor: pointer;
}

.paging-number.active a {
    color: #030303; /* 현재 페이지 번호 색상 */
    font-size: 16px;
    font-weight: bold; /* 강조 효과 추가 */
}
```

### `main/contents/contents_create.css`

```css
.contents-container{
    padding: 0 20px;
    display: flex;
}

.left-area, .right-area {
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 10px;
}
.right-area {
    display: flex;
    justify-content: center;
    align-items: center;
    height: calc(100vh - 115px);
    /*공용*/
    margin: 0 10px;
    flex: 1;
    flex-direction: column;
    background-color: rgb(242, 242, 242);
    border-radius: 10px;
}

/*등록 버튼 영역*/
.regi-button {
    width: 50px;
    height: 30px;
    border: 1px solid rgb(0, 112, 74);
    border-radius: 6px;
}
.regi-button {
    background-color: rgb(0, 112, 74);
    color: white;
}

/*버튼 영역*/
/*.left-area*/
.item-button {
    text-align: right;
    padding-right: 235px;
}

input:focus, textarea:focus {
    /*입력창 테두리 유지*/
    outline: none;
}

/*컨텐츠명*/
.item-text,
.item-input {
    display: block;
}
.input-title {
    margin: 10px 0 0 0;
}
.item-text {
    font-weight: bold;
    font-size: medium;
    margin: 5px 0
}
.item-input {
    border: 1px solid #c2c2c2;
    height: 30px; /* input 창의 높이를 조정합니다. */
    padding-right: 40px; /* clear 버튼을 위한 공간을 확보합니다. */
    box-sizing: border-box; /* padding이 요소의 총 너비에 포함되도록 합니다. */
}
.item-input, .item-select-channel {
    width: 500px;
    height: 30px;
    padding-left: 10px;
    border-radius: 25px;
    margin: 5px 10px;
}
.input-contents {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}
#textarea-clear-button {
    padding: 0;  /* 기존의 패딩 값을 제거 */
    border: none;  /* 기존의 테두리를 제거 */
    background: none;
    transform: translate(-5px, -95px);
    /*transform: translateX(7px);*/
}


/*채널 선택 영역*/
/*.channel-container*/
.item-select-channel {
    display: flex;
    justify-content: start;
    align-items: center;
    flex-direction: row;
    gap: 10px;
}

/*채널 내용 폼*/
.input-container {
    height: 59vh;
}
.form-container {
    display: none;
    flex-direction: column;
    align-items: flex-start; /* 상단 정렬 */
}
.contents-button-container {
    display: flex;
    align-items: center;
}
.ai-button {
    padding: 0 13px;
    margin: 0 10px;
    border: none;
    border-radius: 15px;
    color: white;
    background-color: rgb(233, 30, 99);
}
.input-content {
    width: 100%;
}
.item-text-title {
    font-weight: lighter;
    font-size: medium;
    margin: 5px;
}
.title-input {
    width: 100%;
    margin-top: 5px;
}
.contents-container {
    position: relative;
}
.item-text-contents {
    font-weight: lighter;
    font-size: medium;
    margin: 5px;
}
#contents::placeholder {
    font-size: 13px;
}
#contents {
    position: relative;
    overflow-wrap: break-word;
    word-wrap: break-word;
    resize: none;
}
#contents-text-placeholder {
    position: absolute;
    width: 100%;
    pointer-events: none;
    color: rgba(0,0,0,.3);
    transition: 0.3s;
    display: flex;
    align-items: center;
    padding-left: 20px;
    margin-top: 10px;
}
#contents:not(:placeholder-shown) + #contents-label,
#contents:focus + #contents-label {
    opacity: 0;
}
.item-input-contents {
    width: 780px;
    min-height: 20vh;
    padding: 10px 20px 10px 10px;
    border: 1px solid #c2c2c2;
    border-radius: 5px;
    margin: 5px 10px;
}
.byteInfo-container {
    display: flex;
    justify-content: flex-end;
    margin-right: 250px;
    height: 20px;
}
#byteInfo {
    font-size: 0.8em;
}
/*이미지 등록*/
.img-container {
    margin: 20px 0;
}
.item-text-img {
    font-weight: bold;
    font-size: medium;
    margin: 15px 0;
}
.upload-container {
    display: flex;
    height: 30px;
    margin-top: 10px;
    /*display: none;*/
}
.upload-img {
    display: none;
}
.upload-file {
    width: 100px;
    height: 30px;
    margin-left: 7px;
    border: 1px solid #c2c2c2;
}
.file-button {
    width: 100px;
    height: 30px;
    border: none;
    font-weight: lighter;
    color: gray;
    background-color: #f2f2f2;
}

.file {
    border: 1px solid #c2c2c2;
    height: 30px;
    width: 660px;
}
.preview-container {
    /*display: flex;*/
    display: none;
    margin: 5px 10px;
    border: 1px solid gray;
    height: auto;
    width: 88%;
}
#preview {
    width: auto;
    height: 70px;
    border: 1px solid gray;
}
.file-detail {
    display: flex;
    flex-direction: column;
}
.file-name,
.file-size {
    display: block;
    padding-left: 10px;
    font-size: 12px;
}
.item-text-ref {
    font-weight: lighter;
    font-size: small;
    margin: 3px 10px;
    color: #c2c2c2;
}
.hidden {
    display: none;
}
```

### `main/contents/contents_update.css`

```css
/*콘텐츠 상세 최상위*/
.contents-update-container {
    padding: 0 20px;
    position: relative;
    display: flex;
    flex-direction: column;
}

/*연결된 캠페인 정보*/
.linked-campaign-container {
    display: flex;
    height: 24px;
    margin: 10px 0;
}
.update-button {
    margin-left: auto;
    height: 24px;
}

/*복사, 수정, 삭제 버튼*/
.cancel-button {
    width: 50px;
    height: 30px;
    background-color: rgb(255, 255, 255);
    color: black;
    border: 1px solid #c2c2c2;
    border-radius: 5px;
    padding: 5px 10px;
}
.regi-button {
    width: 50px;
    height: 30px;
    border: 1px solid rgb(0, 112, 74);
    background-color: rgb(0, 112, 74);
    color: white;
    border-radius: 6px;
}
.label-camp-code {
    font-size: 15px;
    font-weight: bold;
}
.left-area, .right-area {
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 10px;
}
.right-area {
    display: flex;
    justify-content: center;
    align-items: center;
    height: calc(100vh - 115px);
    /*공용*/
    margin: 0 10px;
    flex: 1;
    flex-direction: column;
    background-color: rgb(242, 242, 242);
    border-radius: 10px;
}
/*.left-area {
    display: flex;
    flex-direction: column;
    width: 50%;
}*/

/*저장 버튼 영역*/
/*버튼 영역*/
/*.left-area*/
.item-button {
    text-align: right;
    padding-right: 235px;
}

input:focus, textarea:focus {
    /*입력창 테두리 유지*/
    outline: none;
}

/*컨텐츠명*/
.item-text,
.item-input {
    display: block;
}
.input-title {
    margin: 10px 0 0 0;
}
.item-text {
    font-weight: bold;
    font-size: medium;
    margin: 5px 0
}
.item-input {
    border: 1px solid #c2c2c2;
    height: 30px; /* input 창의 높이를 조정합니다. */
    padding-right: 40px; /* clear 버튼을 위한 공간을 확보합니다. */
    box-sizing: border-box; /* padding이 요소의 총 너비에 포함되도록 합니다. */
}
.item-input, .item-select-channel {
    width: 500px;
    height: 30px;
    padding-left: 10px;
    border-radius: 25px;
    margin: 5px 10px;
}
.input-contents {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}
#textarea-clear-button {
    padding: 0;  /* 기존의 패딩 값을 제거 */
    border: none;  /* 기존의 테두리를 제거 */
    background: none;
    transform: translate(-5px, -95px);
    /*transform: translateX(7px);*/
}


/*채널 선택 영역*/
/*.channel-container*/
.item-select-channel {
    display: flex;
    justify-content: start;
    align-items: center;
    flex-direction: row;
    gap: 10px;
}

/*채널 내용 폼*/
.input-container {
    height: 59vh;
}
.form-container {
    display: none;
    flex-direction: column;
    align-items: flex-start; /* 상단 정렬 */
}
.contents-button-container {
    display: flex;
    align-items: center;
}
.ai-button {
    padding: 0 13px;
    margin: 0 10px;
    border: none;
    border-radius: 15px;
    color: white;
    background-color: rgb(233, 30, 99);
}
.input-content {
    width: 100%;
}
.item-text-title {
    font-weight: lighter;
    font-size: medium;
    margin: 5px;
}
.title-input {
    width: 100%;
    margin-top: 5px;
}
.contents-container {
    position: relative;
}
.item-text-contents {
    font-weight: lighter;
    font-size: medium;
    margin: 5px;
}
#contents::placeholder {
    font-size: 13px;
}
#contents {
    position: relative;
    overflow-wrap: break-word;
    word-wrap: break-word;
    resize: none;
}
#contents-text-placeholder {
    position: absolute;
    width: 100%;
    pointer-events: none;
    color: rgba(0,0,0,.3);
    transition: 0.3s;
    display: flex;
    align-items: center;
    padding-left: 20px;
    margin-top: 10px;
}
#contents:not(:placeholder-shown) + #contents-label,
#contents:focus + #contents-label {
    opacity: 0;
}
.item-input-contents {
    width: 780px;
    min-height: 20vh;
    padding: 10px 20px 10px 10px;
    border: 1px solid #c2c2c2;
    border-radius: 5px;
    margin: 5px 10px;
}
.byteInfo-container {
    display: flex;
    justify-content: flex-end;
    margin-right: 250px;
    height: 20px;
}
#byteInfo {
    font-size: 0.8em;
}
/*이미지 등록*/
.img-container {
    margin: 20px 0;
}
.item-text-img {
    font-weight: bold;
    font-size: medium;
    margin: 15px 0;
}
.upload-container {
    display: flex;
    height: 30px;
    margin-top: 10px;
    /*display: none;*/
}
.upload-img {
    display: none;
}
.upload-file {
    width: 100px;
    height: 30px;
    margin-left: 7px;
    border: 1px solid #c2c2c2;
}
.file-button {
    width: 100px;
    height: 30px;
    border: none;
    font-weight: lighter;
    color: gray;
    background-color: #f2f2f2;
}

.file {
    border: 1px solid #c2c2c2;
    height: 30px;
    width: 660px;
}
.preview-container {
    display: flex;
    margin: 5px 10px;
    border: 1px solid gray;
    height: auto;
    width: 88%;
}
#preview {
    width: auto;
    height: 70px;
    border: 1px solid gray;
}
.file-detail {
    display: flex;
    flex-direction: column;
}
.file-name,
.file-size {
    display: block;
    padding-left: 10px;
    font-size: 12px;
}
.item-text-ref {
    font-weight: lighter;
    font-size: small;
    margin: 3px 10px;
    color: #c2c2c2;
}
.hidden {
    display: none;
}
```

### `main/contents/contents_detail.css`

```css
.hidden {
    display: none;
}

/*콘텐츠 상세 최상위*/
.contents-detail-container {
    padding: 0 20px;
    position: relative;
    display: flex;
    flex-direction: column;
}

/*연결된 캠페인 정보*/
.linked-campaign-container {
    display: flex;
    height: 24px;
    margin: 10px 0;
}
.detail-modify-button {
    margin-left: auto;
    height: 24px;
}
/*.detail-button-container {
    display: block;
    height: 24px;
    width: 200px;
    margin: 10px 0 10px 10px;
}*/
/*복사, 수정, 삭제 버튼*/
.contents-copy-button, .update-button {
    background-color: rgb(255, 255, 255);
    color: black;
    border: 1px solid #c2c2c2;
    border-radius: 5px;
    padding: 5px 10px;
}
.delete-button {
    background-color: rgb(255, 255, 255);
    color: #FE5655;
    border: 1px solid #FE5655;
    border-radius: 5px;
    padding: 5px 10px;
}

.label-camp-code {
    font-size: 15px;
    font-weight: bold;
}
.left-area, .right-area {
    width: 50%;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 10px;
}
.right-area {
    display: flex;
    justify-content: center;
    align-items: center;
    height: calc(100vh - 115px);
    /*공용*/
    margin: 0 10px;
    flex: 1;
    flex-direction: column;
    background-color: rgb(242, 242, 242);
    border-radius: 10px;
}
/*.left-area {
    display: flex;
    flex-direction: column;
    width: 50%;
}*/

/*저장 버튼 영역*/
/*버튼 영역*/
/*.left-area*/
.item-button {
    text-align: right;
    padding-right: 235px;
}

input:focus, textarea:focus {
    /*입력창 테두리 유지*/
    outline: none;
}

/*컨텐츠명*/
.item-text,
.item-input {
    display: block;
}
.input-title {
    margin: 10px 0 0 0;
}
.item-text {
    font-weight: bold;
    font-size: medium;
    margin: 5px 0
}
.item-input {
    border: 1px solid #c2c2c2;
    height: 30px; /* input 창의 높이를 조정합니다. */
    padding-right: 40px; /* clear 버튼을 위한 공간을 확보합니다. */
    box-sizing: border-box; /* padding이 요소의 총 너비에 포함되도록 합니다. */
}
.item-input, .item-select-channel {
    width: 500px;
    height: 30px;
    padding-left: 10px;
    border-radius: 25px;
    margin: 5px 10px;
}
.input-contents {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
}
#textarea-clear-button {
    padding: 0;  /* 기존의 패딩 값을 제거 */
    border: none;  /* 기존의 테두리를 제거 */
    background: none;
    transform: translate(-5px, -95px);
    /*transform: translateX(7px);*/
}


/*채널 선택 영역*/
/*.channel-container*/
.item-select-channel {
    display: flex;
    justify-content: start;
    align-items: center;
    flex-direction: row;
    gap: 10px;
}

/*채널 내용 폼*/
.input-container {
    height: 59vh;
}
.form-container {
    display: none;
    flex-direction: column;
    align-items: flex-start; /* 상단 정렬 */
}
.contents-button-container {
    display: flex;
    align-items: center;
}
.ai-button {
    padding: 0 13px;
    margin: 0 10px;
    border: none;
    border-radius: 15px;
    color: white;
    background-color: rgb(233, 30, 99);
}
.input-content {
    width: 100%;
}
.item-text-title {
    font-weight: lighter;
    font-size: medium;
    margin: 5px;
}
.title-input {
    width: 100%;
    margin-top: 5px;
}
.contents-container {
    position: relative;
}
.item-text-contents {
    font-weight: lighter;
    font-size: medium;
    margin: 5px;
}
#contents::placeholder {
    font-size: 13px;
}
#contents {
    position: relative;
    overflow-wrap: break-word;
    word-wrap: break-word;
    resize: none;
}
#contents-text-placeholder {
    position: absolute;
    width: 100%;
    pointer-events: none;
    color: rgba(0,0,0,.3);
    transition: 0.3s;
    display: flex;
    align-items: center;
    padding-left: 20px;
    margin-top: 10px;
}
#contents:not(:placeholder-shown) + #contents-label,
#contents:focus + #contents-label {
    opacity: 0;
}
.item-input-contents {
    width: 780px;
    min-height: 20vh;
    padding: 10px 20px 10px 10px;
    border: 1px solid #c2c2c2;
    border-radius: 5px;
    margin: 5px 10px;
}
.byteInfo-container {
    display: flex;
    justify-content: flex-end;
    margin-right: 250px;
    height: 20px;
}
#byteInfo {
    font-size: 0.8em;
}
/*이미지 등록*/
.img-container {
    margin: 20px 0;
}
.item-text-img {
    font-weight: bold;
    font-size: medium;
    margin: 15px 0;
}
.upload-container {
    display: flex;
    height: 30px;
    margin-top: 10px;
    /*display: none;*/
}
.upload-img {
    display: none;
}
.upload-file {
    width: 100px;
    height: 30px;
    margin-left: 7px;
    border: 1px solid #c2c2c2;
}
.file-button {
    width: 100px;
    height: 30px;
    border: none;
    font-weight: lighter;
    color: gray;
    background-color: #f2f2f2;
}

.file {
    border: 1px solid #c2c2c2;
    height: 30px;
    width: 660px;
}
.preview-container {
    display: flex;
    margin: 5px 10px;
    border: 1px solid gray;
    height: auto;
    width: 88%;
}
#preview {
    width: auto;
    height: 70px;
    border: 1px solid gray;
}
.file-detail {
    display: flex;
    flex-direction: column;
}
.file-name,
.file-size {
    display: block;
    padding-left: 10px;
    font-size: 12px;
}
.item-text-ref {
    font-weight: lighter;
    font-size: small;
    margin: 3px 10px;
    color: #c2c2c2;
}
```

