# Firebase Functions 사용 가이드

## 📋 구현된 기능

### 1. 자동 뉴스 수집 (`collectNewsData`)
- **실행 주기**: 매 1시간마다 자동 실행
- **기능**: 
  - Firestore의 keywords 컬렉션에서 활성화된 키워드 조회
  - Google News RSS에서 뉴스 검색
  - Naver News에서 뉴스 검색 (데모용 mock 데이터)
  - 수집한 데이터를 Firestore data 컬렉션에 저장
- **감정 분석**: 간단한 키워드 기반 positive/negative/neutral 분류

### 2. 수동 뉴스 수집 (`collectNewsManual`)
- **실행 방법**: HTTP 요청으로 수동 트리거
- **용도**: 테스트 및 즉시 데이터 수집이 필요할 때

### 3. 오래된 데이터 정리 (`cleanOldData`)
- **실행 주기**: 매 24시간마다 자동 실행
- **기능**: 30일 이상 된 데이터 자동 삭제

---

## 🚀 배포 방법

### 사전 준비

1. **Firebase CLI 로그인** (아직 안 했다면):
   ```bash
   npx firebase login
   ```

2. **Firebase Blaze 플랜 필요**:
   - Firebase Functions는 Blaze (종량제) 플랜에서만 사용 가능
   - 무료 할당량이 충분하므로 실제 비용은 거의 없음

### 배포 명령

```bash
# Functions만 배포
npx firebase deploy --only functions

# 또는 전체 배포 (Hosting + Functions)
npx firebase deploy
```

### 배포 후 확인

1. Firebase Console에서 Functions 페이지 확인:
   ```
   https://console.firebase.google.com/project/keyword-trend-monitor/functions
   ```

2. 배포된 Functions 목록:
   - `collectNewsData` - 스케줄러로 자동 실행
   - `collectNewsManual` - HTTP 트리거
   - `cleanOldData` - 스케줄러로 자동 실행

---

## 🧪 테스트 방법

### 로컬 테스트 (Firebase Emulator)

```bash
# Functions 디렉토리로 이동
cd functions

# Firebase Emulator 시작
npx firebase emulators:start --only functions
```

### 수동 트리거로 테스트

배포 후 HTTP 함수 URL로 수동 실행:

```bash
# 배포된 함수의 URL 확인
npx firebase functions:list

# curl로 수동 트리거
curl https://asia-northeast3-keyword-trend-monitor.cloudfunctions.net/collectNewsManual
```

### 로그 확인

```bash
# 실시간 로그 확인
npx firebase functions:log

# 특정 함수의 로그만 확인
npx firebase functions:log --only collectNewsData
```

---

## 🔧 설정 커스터마이즈

### 스케줄 변경

`functions/index.js`에서 cron 표현식 수정:

```javascript
// 현재: 매 1시간마다
.pubsub.schedule('every 1 hours')

// 예시:
.pubsub.schedule('every 30 minutes')  // 30분마다
.pubsub.schedule('0 */2 * * *')       // 2시간마다
.pubsub.schedule('0 9 * * *')         // 매일 오전 9시
```

### Naver API 연동

실제 Naver Open API를 사용하려면:

1. **Naver Developers**에서 API 키 발급:
   ```
   https://developers.naver.com/apps/#/register
   ```

2. **Firebase Functions Config 설정**:
   ```bash
   npx firebase functions:config:set naver.client_id="YOUR_CLIENT_ID"
   npx firebase functions:config:set naver.client_secret="YOUR_CLIENT_SECRET"
   ```

3. `functions/index.js`의 `searchNaverNews` 함수에서 주석 처리된 실제 API 코드 사용

---

## 📊 데이터 구조

### Firestore `data` 컬렉션

수집된 데이터는 다음 형식으로 저장됩니다:

```javascript
{
  keyword: "ChatGPT",           // 키워드명
  source: "구글 뉴스",          // 뉴스 소스
  count: 8,                     // 수집된 뉴스 개수
  sentiment: "positive",        // 감정 분석 결과
  date: Timestamp,              // 수집 시간
  url: "https://..."            // 검색 URL
}
```

---

## 💡 주의사항

### 1. 비용 관리
- Firebase Blaze 플랜 필요
- 무료 할당량:
  - Functions 호출: 2백만 회/월
  - 실행 시간: 40만 GB-초/월
- 현재 설정 (매 시간 실행)으로는 무료 할당량 내

### 2. Rate Limiting
- Google News RSS: 제한 없음 (공식 RSS 사용)
- Naver API: 하루 25,000회 제한

### 3. 데이터 품질
- 현재 Naver News는 mock 데이터
- 실제 운영 시 Naver API 연동 필요

---

## 🔄 다음 단계

Functions가 정상 작동하면:

1. **알림 기능 추가**:
   - 특정 키워드 급증 시 이메일/Slack 알림
   
2. **고급 분석**:
   - 자연어 처리 (NLP) 라이브러리 사용
   - 더 정교한 감정 분석

3. **더 많은 소스**:
   - 유튜브 API
   - Reddit API
   - Twitter API

---

## 📚 참고 자료

- [Firebase Functions 공식 문서](https://firebase.google.com/docs/functions)
- [Cron 표현식 가이드](https://cloud.google.com/scheduler/docs/configuring/cron-job-schedules)
- [Naver Open API](https://developers.naver.com/docs/serviceapi/search/news/news.md)
