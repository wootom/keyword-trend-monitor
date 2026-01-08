# Firebase Functions 배포 가이드

## 🚀 배포 단계

Firebase Functions를 배포하려면 다음 단계를 따라주세요:

### 1단계: Firebase Blaze 플랜으로 업그레이드

**중요**: Firebase Functions는 Blaze (종량제) 플랜에서만 사용 가능합니다.

1. Firebase Console 접속:
   ```
   https://console.firebase.google.com/project/keyword-trend-monitor/usage
   ```

2. "Upgrade to Blaze plan" 또는 "Blaze 플랜으로 업그레이드" 클릭

3. 결제 정보 입력 (신용카드 필요)

4. **무료 할당량 정보**:
   - Cloud Functions 호출: 매월 200만 회 무료
   - GB-초: 매월 40만 GB-초 무료
   - 아웃바운드 네트워킹: 매월 5GB 무료
   
   현재 설정 (매시간 1회 실행)으로는 무료 할당량 내에서 충분히 사용 가능합니다!

5. 업그레이드 완료 후 다음 단계로 진행

---

### 2단계: Firebase CLI 로그인

터미널에서 다음 명령 실행:

```bash
npx firebase login
```

- 브라우저가 자동으로 열립니다
- Firebase 계정(woojanghoon@gmail.com)으로 로그인
- "Allow Firebase to access your Google account" 허용
- 터미널에 "Success!" 메시지 확인

---

### 3단계: Firebase 프로젝트 초기화 (이미 완료)

프로젝트가 이미 연결되어 있는지 확인:

```bash
npx firebase projects:list
```

현재 프로젝트 확인:
```bash
cat .firebaserc
```

출력: `{"projects": {"default": "keyword-trend-monitor"}}`

---

### 4단계: Functions 배포

#### 방법 1: Functions만 배포 (권장)

```bash
npx firebase deploy --only functions
```

#### 방법 2: 전체 배포 (Hosting + Functions)

```bash
npx firebase deploy
```

#### 배포 과정:
1. Functions 코드 업로드
2. 서버에서 npm install
3. Functions 생성 및 배포
4. 예상 시간: 3-5분

---

### 5단계: 배포 확인

#### Firebase Console에서 확인:
```
https://console.firebase.google.com/project/keyword-trend-monitor/functions
```

배포된 Functions 목록:
- ✅ `collectNewsData` - 스케줄러로 자동 실행
- ✅ `collectNewsManual` - HTTP 트리거
- ✅ `cleanOldData` - 매일 자동 실행

#### 로그 확인:
```bash
npx firebase functions:log
```

#### 수동 테스트:
```bash
# collectNewsManual 함수 URL 확인
npx firebase functions:list

# curl로 테스트
curl https://asia-northeast3-keyword-trend-monitor.cloudfunctions.net/collectNewsManual
```

---

## ⚠️ 문제 해결

### 오류: "Billing account not configured"

- Firebase Console에서 Blaze 플랜으로 업그레이드 필요
- 결제 정보 등록 필요

### 오류: "Insufficient permissions"

- Firebase 프로젝트에 대한 소유자 또는 편집자 권한 확인
- `firebase login` 다시 실행

### 오류: "Functions deployment error"

1. `functions/` 디렉토리로 이동
2. `npm install` 재실행
3. `node_modules` 삭제 후 재설치:
   ```bash
   cd functions
   rm -rf node_modules
   npm install
   cd ..
   ```

---

## 📊 배포 후 모니터링

### 실시간 로그:
```bash
npx firebase functions:log --only collectNewsData
```

### Firestore 데이터 확인:
```
https://console.firebase.google.com/project/keyword-trend-monitor/firestore/data
```

`data` 컬렉션에 새로운 데이터가 매시간 추가되는지 확인!

---

## 💰 비용 관리

### 예상 비용 (현재 설정):

- **collectNewsData**: 매시간 1회 = 하루 24회 = 월 720회
- **cleanOldData**: 매일 1회 = 월 30회
- **총**: 월 약 750회 함수 호출

**예상 비용**: $0 (무료 할당량 200만 회 내)

### 비용 초과 방지:

1. Firebase Console > Usage and billing 페이지에서 알림 설정
2. 예산 알림 설정 (예: $10 초과 시 이메일)

---

## ✅ 배포 체크리스트

- [ ] Blaze 플랜으로 업그레이드
- [ ] `npx firebase login` 실행
- [ ] `.firebaserc` 파일 확인
- [ ] `npx firebase deploy --only functions` 실행
- [ ] Firebase Console에서 Functions 확인
- [ ] 로그에서 정상 실행 확인
- [ ] Firestore data 컬렉션에서 데이터 확인

---

## 🎯 다음 단계

배포 성공 후:

1. **B. Naver API 연동**: 실제 Naver 뉴스 데이터 수집
2. **C. Authentication 완성**: Google 로그인 문제 해결
3. **D. 고급 기능**: 알림, 고급 분석 등

---

**지금 배포를 시작하시려면:**

1. Firebase Console에서 Blaze 플랜으로 업그레이드
2. 터미널에서 `npx firebase login` 실행
3. `npx firebase deploy --only functions` 실행

모든 단계를 완료하시면 알려주세요! 🚀
