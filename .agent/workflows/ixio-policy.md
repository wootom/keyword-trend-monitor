# IXIO 뉴스 모니터링 정책 문서

> **최종 업데이트:** 2025-12-28 23:15 KST  
> **적용 대상:** `functions/index.js`, `public/js/ixio.js`, `public/ixio.html`  
> **Firebase Functions:** `ixioAutoCollection`, `collectIxioData`

---

## 1. 개요

### 1.1 목적
LG유플러스의 AI 통화 서비스 **익시오(IXIO)**에 대한 **55개 주요 언론사**의 뉴스 언급량을 실시간으로 모니터링하고 트렌드를 분석하는 시스템입니다.

### 1.2 핵심 특징
| 항목 | 내용 |
|------|------|
| **수집 주기** | 2시간마다 자동 수집 (하루 12회) |
| **대상 언론사** | 55개 주요 언론사 (종합일간지, 경제지, 방송사, IT/기술, 온라인) |
| **데이터 정책** | 병합 정책 (기존 데이터 보존, 새 기사만 추가) |
| **시각화** | 급증 시 키워드 자동 추출 및 차트 표시 |

---

## 2. 수집 (Collection)

### 2.1 검색 키워드
```javascript
const keywords = ['ixio', 'ixi-o', '익시오'];
```
- **조건**: 기사 제목 또는 본문에 키워드 포함 (OR 검색)
- **대소문자**: 구분 없음

### 2.2 데이터 소스

| 소스 | API 유형 | 엔드포인트 | 인증 |
|------|----------|-----------|------|
| Google News | RSS Feed | `news.google.com/rss/search` | 불필요 |
| Naver News | REST API | `openapi.naver.com/v1/search/news.json` | client_id + client_secret |

#### Google News 수집 파라미터
```
hl=ko (언어: 한국어)
gl=KR (지역: 한국)
ceid=KR:ko (국가/언어)
```

#### Naver News 수집 파라미터
```
display=100 (최대 100건)
sort=date (최신순)
```

### 2.3 수집 일정

#### 자동 수집 (ixioAutoCollection)
| 시간 (KST) | cron 표현식 | 동작 |
|------------|-------------|------|
| 0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22시 | `0 */2 * * *` | 오늘 날짜 기사 수집 및 병합 |
| 0시 (자정) | 위와 동일 | 추가로 어제 날짜 최종 확정 |

#### 수동 수집 (collectIxioData)
- **UI**: 대시보드 "현재기준 데이터수집" 버튼
- **API**: Firebase Functions HTTPS Callable
- **용도**: 즉시 데이터 갱신이 필요할 때

### 2.4 수집 기간
- **시작일**: 2025-12-01
- **종료일**: 현재 (무기한)
- **과거 수집 제한**: Google/Naver API는 24-48시간 이후 기사 조회가 제한될 수 있음

---

## 3. 필터링 (Filtering)

### 3.1 주요 언론사 목록 (MAJOR_OUTLETS)

> **총 55개 언론사**만 카운트됩니다. 그 외 언론사는 수집되지 않습니다.

#### 📰 종합일간지 (10개)
| 언론사 | 도메인 |
|--------|--------|
| 조선일보 | chosun.com |
| 중앙일보 | joongang.co.kr |
| 동아일보 | donga.com |
| 한겨레 | hani.co.kr |
| 경향신문 | khan.co.kr |
| 한국일보 | hankookilbo.com |
| 서울신문 | seoul.co.kr |
| 세계일보 | segye.com |
| 국민일보 | kmib.co.kr |
| 문화일보 | munhwa.com |

#### 💰 경제지 (10개)
| 언론사 | 도메인 |
|--------|--------|
| 매일경제 | mk.co.kr |
| 한국경제 | hankyung.com |
| 서울경제 | sedaily.com |
| 파이낸셜뉴스 | fnnews.com |
| 머니투데이 | mt.co.kr |
| 이데일리 | edaily.co.kr |
| 아시아경제 | asiae.co.kr |
| 헤럴드경제 | heraldcorp.com |
| 뉴스1 | news1.kr |
| 뉴시스 | newsis.com |

#### 📺 방송사 (11개)
| 언론사 | 도메인 |
|--------|--------|
| KBS | kbs.co.kr |
| MBC | imnews.imbc.com |
| SBS | sbs.co.kr |
| JTBC | jtbc.co.kr |
| MBN | mbn.co.kr |
| YTN | ytn.co.kr |
| 연합뉴스TV | yonhapnewstv.co.kr |
| TV조선 | tvchosun.com |
| 채널A | ichannela.com |
| CBS | cbs.co.kr |
| 연합뉴스 | yna.co.kr |

#### 💻 IT/기술 전문지 (10개)
| 언론사 | 도메인 |
|--------|--------|
| 전자신문 | etnews.com |
| 디지털타임스 | dt.co.kr |
| 디지털데일리 | ddaily.co.kr |
| 지디넷코리아 | zdnet.co.kr |
| 블로터 | bloter.net |
| 아이뉴스24 | inews24.com |
| IT동아 | it.donga.com |
| 테크월드 | epnc.co.kr |
| 바이라인네트워크 | byline.network |
| AI타임스 | aitimes.com |

#### 🌐 주요 온라인 (14개)
| 언론사 | 도메인 |
|--------|--------|
| 오마이뉴스 | ohmynews.com |
| 프레시안 | pressian.com |
| 미디어오늘 | mediatoday.co.kr |
| 더팩트 | tf.co.kr |
| 스포츠조선 | sportschosun.com |
| 스포츠동아 | sports.donga.com |
| 일간스포츠 | isplus.com |
| 데일리안 | dailian.co.kr |
| SBS Biz | biz.sbs.co.kr |
| 비즈워치 | bizwatch.co.kr |
| 이투데이 | etoday.co.kr |
| 조선비즈 | biz.chosun.com |
| 한경비즈니스 | hankyungbusiness.com |
| 뉴스웨이 | newsway.co.kr |
| 노컷뉴스 | nocutnews.co.kr |

### 3.2 도메인 매핑 (extractOutletFromUrl)

URL에서 언론사명을 추출하기 위한 도메인 매핑입니다.

```javascript
const domainMap = {
    'chosun.com': '조선일보',
    'joongang.co.kr': '중앙일보',
    'donga.com': '동아일보',
    'hani.co.kr': '한겨레',
    'khan.co.kr': '경향신문',
    // ... (총 42개)
};
```

> [!IMPORTANT]
> **MAJOR_OUTLETS 목록과 domainMap은 반드시 동기화되어야 합니다.**  
> 새 언론사 추가 시 두 곳 모두 업데이트 필요.

### 3.3 필터링 로직

```javascript
// searchNaverNews, searchGoogleNews 내부
const outlet = extractOutletFromUrl(item.originallink || item.link);
const isMajor = isMajorOutlet(outlet);

if (articleDateStr === targetDateStr && isMajor) {
    // ✅ 카운트에 포함
}
```

| 조건 | 설명 |
|------|------|
| 날짜 필터 | 지정된 날짜(한국 시간 기준)의 기사만 포함 |
| 언론사 필터 | MAJOR_OUTLETS 목록에 있는 언론사만 포함 |
| 네이버 제휴 | ❌ **무시** (news.naver.com 링크 여부와 무관) |

---

## 4. 저장 (Storage)

### 4.1 Firestore 컬렉션

- **컬렉션명**: `ixioData`
- **리전**: asia-northeast3 (서울)

### 4.2 문서 구조

```javascript
{
  // 기본 필드
  dateKey: "2025-12-28",            // YYYY-MM-DD (문서 식별자)
  date: Timestamp,                   // Firestore Timestamp
  source: "Naver News",              // 통합 저장 (실제로는 Google+Naver 병합)
  count: 5,                          // 기사 개수 (중복 제거 후)
  
  // 기사 상세 배열
  articles: [
    {
      title: "LG유플러스 익시오, AI 통화 서비스 확대",
      link: "https://news.naver.com/...",
      originallink: "https://www.etnews.com/...",
      pubDate: "Sat, 28 Dec 2025 10:30:00 +0900",
      outlet: "전자신문"
    },
    // ...
  ],
  
  // 메타데이터
  metadata: {
    originalGoogleCount: 2,          // 수집 시 Google 기사 수
    originalNaverCount: 4,           // 수집 시 Naver 기사 수
    originalCount: 3,                // 병합 전 기존 기사 수
    newArticlesAdded: 2,             // 새로 추가된 기사 수
    lastUpdated: Timestamp,          // 마지막 업데이트 시각
    updateHour: 14                   // 업데이트 시각 (0-23)
  },
  
  // 시스템 필드
  timestamp: Timestamp,              // 최초 수집 시각
  auto: true                         // 자동 수집 여부
}
```

### 4.3 병합 정책 (Merge Policy)

> **핵심 원칙**: 한번 수집된 기사는 삭제되지 않습니다.

```
수집 요청 → 기존 데이터 로드 → URL 기준 중복 확인 → 새 기사만 추가 → 저장
```

| 상황 | 동작 |
|------|------|
| 신규 기사 발견 | 기존 articles 배열에 추가 |
| 중복 기사 (URL 동일) | 스킵 (추가하지 않음) |
| 기존보다 적은 기사 | 기존 데이터 유지 (업데이트하지 않음) |

#### URL 정규화
```javascript
// 쿼리 파라미터 제거
normalizedUrl = url.split('?')[0];

// 네이버 뉴스 링크 → 원본 링크 사용
if (link.includes('news.naver.com') && originallink) {
    normalizedUrl = originallink.split('?')[0];
}
```

---

## 5. 표출 (Display)

### 5.1 대시보드 정보

| 항목 | 내용 |
|------|------|
| **URL** | https://keyword-trend-monitor.web.app/ixio.html |
| **파일** | `public/ixio.html`, `public/js/ixio.js`, `public/js/ixio-modal.js` |
| **차트 라이브러리** | Chart.js + chartjs-plugin-annotation |

### 5.2 요약 통계

| 지표 | 계산 방식 |
|------|----------|
| 총 언급량 | START_DATE(2025-12-01)부터 현재까지 모든 기사 합계 |
| 오늘 언급량 | 오늘 날짜(dateKey = today) 기사 수 |
| 일평균 언급량 | 총 언급량 / 데이터가 있는 일수 |
| 최고 언급량 | 가장 많은 기사가 나온 날의 count |

### 5.3 차트 기능

#### 급증 감지 (Spike Detection)
```javascript
// 급증 조건
const isSpike = 
    (prevCount > 0 && currCount >= prevCount * 2 && currCount >= 5) ||
    (prevCount === 0 && currCount >= 10);
```

| 조건 | 설명 |
|------|------|
| 전일 대비 2배 이상 + 5건 이상 | 일반적인 급증 |
| 전일 0건 → 10건 이상 | 0에서 급성장 |

#### 키워드 추출 (extractKeywords)
- **대상**: 급증일 기사 제목
- **방식**: 2글자 이상 한글 명사 빈도 분석
- **표시**: 상위 2개 키워드 조합 + 문장형 접미어

```javascript
// 문장형 변환 (makeSentenceStyle)
"개인정보 유출" → "개인정보 유출 파장"  // 부정적 키워드
"온디바이스 AI" → "온디바이스 AI 이슈"  // 3배 이상 급증
"제미나이 탑재" → "제미나이 탑재 주목"  // 일반 급증
```

#### 스크롤 기능
- **조건**: 30일 이상 데이터 시 활성화
- **동작**: 차트 좌우 스크롤, 최신 데이터로 자동 스크롤

#### 주말/공휴일 표시
```javascript
const koreanHolidays = ['2025-12-25']; // 성탄절
// 주말(토,일) 및 공휴일은 빨간색으로 표시
```

### 5.4 상세 테이블

| 컬럼 | 내용 |
|------|------|
| 날짜 | YYYY-MM-DD |
| 샘플 | 랜덤 기사 제목 2개 |
| 뉴스합계 | 해당 날짜 기사 수 |
| 전일 대비 | ▲N / ▼N / - |
| 관련 기사 링크 | Google News 검색 링크 |

---

## 6. 변경 이력

| 날짜 | 시간 | 변경 내용 |
|------|------|----------|
| 2025-12-28 | 13:00 | 네이버 제휴 자동 포함 조건 제거 (hasNaverNewsLink) |
| 2025-12-28 | 13:05 | 도메인 매핑 19개 추가 (더팩트, 세계일보, MBN 등) |
| 2025-12-28 | 13:10 | 병합 정책 도입 (기존 데이터 삭제 방지) |
| 2025-12-28 | 13:15 | 비주요 언론사 기사 25건 정리 (cleanup_outlets.html) |
| 2025-12-28 | 22:30 | 2시간마다 자동 수집으로 변경 (dailyIxioCollection → ixioAutoCollection) |
| 2025-12-28 | 22:40 | 급증 시 키워드 차트 표시 기능 추가 |
| 2025-12-28 | 22:55 | 키워드 문장형 변환 (파장/화제/주목) |
| 2025-12-28 | 23:00 | 차트 스크롤 기능 추가 (30일 이상 시) |
| 2025-12-28 | 23:15 | 전체 데이터 삭제 버튼 제거, UI 안내 업데이트 |

---

## 7. 주의사항

> [!IMPORTANT]
> **MAJOR_OUTLETS 목록과 domainMap 동기화 필수**  
> 새 언론사 추가 시 `functions/index.js`의 두 곳 모두 업데이트해야 합니다.

> [!WARNING]
> **과거 데이터 재수집 제한**  
> Google/Naver API는 24-48시간 이후 기사 조회가 제한될 수 있습니다.
> 과거 데이터 복구가 필요한 경우 수동 입력을 고려하세요.

> [!CAUTION]
> **병합 정책 주의**  
> 잘못된 기사가 수집된 경우 Firestore Console에서 직접 삭제해야 합니다.
> cleanup_outlets.html 도구를 사용할 수 있습니다.

---

## 8. 관련 파일

| 파일 | 역할 | 위치 |
|------|------|------|
| `functions/index.js` | 수집/필터링/저장 로직, Firebase Functions | [링크](file:///Users/fovea/Documents/keyword/functions/index.js) |
| `public/js/ixio.js` | 표출/시각화/차트 로직 | [링크](file:///Users/fovea/Documents/keyword/public/js/ixio.js) |
| `public/js/ixio-modal.js` | 수집 로직 안내 모달 | [링크](file:///Users/fovea/Documents/keyword/public/js/ixio-modal.js) |
| `public/ixio.html` | 대시보드 UI | [링크](file:///Users/fovea/Documents/keyword/public/ixio.html) |
| `public/cleanup_outlets.html` | 데이터 정리 도구 | [링크](file:///Users/fovea/Documents/keyword/public/cleanup_outlets.html) |

---

## 9. 향후 개선 과제

- [ ] 월별/주별 트렌드 분석 추가
- [ ] 언론사별 분포 차트
- [ ] 키워드 워드클라우드
- [ ] 알림 기능 (급증 시 Slack/Email)
- [ ] 경쟁사 비교 분석
