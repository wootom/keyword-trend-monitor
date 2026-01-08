# 🚀 빠른 시작 가이드

이 가이드는 키워드 트렌드 모니터링 시스템을 빠르게 실행하고 배포하는 방법을 안내합니다.

## 📋 사전 준비

### 필수 도구 설치

1. **Node.js 18 이상** - [다운로드](https://nodejs.org/)
2. **Git** - [다운로드](https://git-scm.com/)
3. **Firebase CLI**
   ```powershell
   # PowerShell을 관리자 권한으로 실행 후:
   Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
   npm install -g firebase-tools
   ```

---

## 🧪 로컬 테스트 (Firebase 없이)

Firebase 설정 전에 로컬에서 UI를 먼저 확인할 수 있습니다:

### 방법 1: http-server 사용 (권장)

```powershell
# 프로젝트 디렉토리에서
cd c:\Users\mrbadguy\Documents\keyword

# http-server 설치 (처음 한 번만)
npm install

# 로컬 서버 실행
npm start
```

브라우저가 자동으로 열립니다: `http://localhost:8080`

### 방법 2: Live Server (VS Code)

1. VS Code에서 `public/index.html` 파일 열기
2. 우클릭 → "Open with Live Server"

---

## 🔥 Firebase 설정 및 배포

### 1단계: Firebase 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com/) 접속
2. "프로젝트 추가" 클릭
3. 프로젝트 이름 입력: `keyword-trend-monitor` (또는 원하는 이름)
4. Google Analytics: **활성화 안 함** (선택사항)
5. 프로젝트 생성 완료 대기

### 2단계: Firestore Database 설정

1. Firebase Console → **Build** → **Firestore Database**
2. "데이터베이스 만들기" 클릭
3. 보안 규칙:
   - **프로덕션 모드**로 시작 (규칙은 나중에 배포됨)
4. 위치: **asia-northeast3 (Seoul)** 선택
5. "사용 설정" 클릭

### 3단계: Firebase Authentication 설정 (선택사항)

1. Firebase Console → **Build** → **Authentication**
2. "시작하기" 클릭
3. **이메일/비밀번호** 공급자 활성화
4. 첫 번째 관리자 계정 생성:
   - "사용자" 탭 → "사용자 추가"
   - 이메일과 비밀번호 입력

### 4단계: Firebase 웹 앱 추가

1. Firebase Console → 프로젝트 설정 (⚙️)
2. "내 앱" 섹션에서 **웹 아이콘 (</>)** 클릭
3. 앱 닉네임: `Keyword Trend Web`
4. Firebase Hosting: **체크하지 않음** (나중에 설정)
5. "앱 등록" 클릭
6. **Firebase SDK 구성 코드 복사** (다음 단계에서 사용)

### 5단계: Firebase Config 업데이트

복사한 Firebase 설정을 `public/js/firebase-config.js` 파일에 붙여넣기:

```javascript
// public/js/firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSy...",              // ← 복사한 값
  authDomain: "your-app.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-app.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abcdef..."
};

// 나머지 코드는 그대로 유지
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
// ...
```

### 6단계: Firebase 로그인 및 초기화

```powershell
# Firebase 로그인
firebase login

# 프로젝트 초기화 (이미 firebase.json이 있으므로 건너뛰어도 됨)
# firebase init

# 프로젝트 연결
firebase use --add
# → 방금 생성한 프로젝트 선택
# → Alias: default (엔터)
```

### 7단계: Functions 의존성 설치

```powershell
cd functions
npm install
cd ..
```

### 8단계: Firestore 규칙 및 인덱스 배포

```powershell
firebase deploy --only firestore
```

### 9단계: Firebase Functions 배포

```powershell
firebase deploy --only functions
```

**참고**: 
- Cloud Functions 배포 시 **Blaze 요금제** (종량제)로 업그레이드 필요
- 무료 할당량이 충분하므로 소규모 사용 시 비용 거의 없음
- YouTube API는 선택사항 (환경 변수 설정 필요)

### 10단계: Firebase Hosting 배포 (선택사항)

```powershell
firebase deploy --only hosting
```

배포 완료 후 URL: `https://your-project-id.web.app`

---

## 🌐 GitHub Pages 배포 (대안)

Firebase Hosting 대신 GitHub Pages를 사용할 수도 있습니다:

### 1단계: GitHub 저장소 생성

1. GitHub에 로그인
2. 새 저장소: `ixio-global/keyword`
3. Public으로 설정

### 2단계: 코드 푸시

```powershell
git add .
git commit -m "Deploy: Initial release"
git push origin master
```

### 3단계: GitHub Pages 활성화

1. GitHub 저장소 → **Settings**
2. 왼쪽 메뉴 → **Pages**
3. Source:
   - Branch: `master`
   - Folder: `/public` (또는 `/root`)
4. **Save** 클릭
5. 5-10분 후 배포 완료

배포 URL: `https://ixio-global.github.io/keyword/`

---

## 🎯 초기 데이터 설정

대시보드에서 데이터를 보려면 Firestore에 초기 데이터를 추가해야 합니다:

### 방법 1: 관리자 페이지 사용 (권장)

1. `https://your-project.web.app/admin.html` 접속
2. 키워드 추가:
   - 예: "ChatGPT", "AI", "메타버스"
3. 매체 추가:
   - **뉴스**: 구글 뉴스, 네이버 뉴스
   - **커뮤니티**: 디시인사이드, 뽐뿌, 루리웹
   - **YouTube**: 잇섭, 슈카월드

### 방법 2: Firestore Console에서 수동 추가

Firebase Console → Firestore Database에서 직접 문서 생성:

**keywords 컬렉션**:
```json
{
  "name": "ChatGPT",
  "active": true,
  "createdAt": "2025-12-18T00:00:00Z"
}
```

**sources 컬렉션**:
```json
{
  "name": "구글 뉴스",
  "type": "news",
  "url": "",
  "active": true
}
```

---

## 🧪 수동 데이터 수집 테스트

Functions 배포 후 수동으로 데이터 수집을 트리거할 수 있습니다:

```powershell
# Functions URL 확인
firebase functions:config:get

# HTTP 트리거 호출 (Postman, curl 또는 브라우저)
# URL: https://asia-northeast3-YOUR_PROJECT.cloudfunctions.net/manualCollect
```

또는 관리자 페이지에서 "수동 수집" 버튼 클릭

---

## ⏰ 스케줄러 설정 확인

Functions가 정상 배포되면 자동으로 2시간마다 실행됩니다:

1. Firebase Console → **Functions**
2. `scheduledDataCollection` 함수 확인
3. 로그에서 실행 내역 확인:
   ```powershell
   firebase functions:log --only scheduledDataCollection
   ```

---

## 🐛 문제 해결

### PowerShell 실행 정책 오류

```powershell
# PowerShell을 관리자 권한으로 실행:
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### Firebase Functions 배포 오류

```powershell
# 로그 확인
firebase functions:log

# Functions 프로젝트 재설정
cd functions
npm install
cd ..
firebase deploy --only functions --force
```

### Firestore 권한 오류

- Firebase Console → Firestore → **Rules** 탭에서 규칙 확인
- `firestore.rules` 파일이 올바르게 배포되었는지 확인:
  ```powershell
  firebase deploy --only firestore:rules
  ```

### YouTube API 할당량 초과

- YouTube 수집기는 API 키가 없으면 자동으로 건너뜁니다
- API 키 설정:
  ```powershell
  firebase functions:config:set youtube.api_key="YOUR_API_KEY"
  firebase deploy --only functions
  ```

---

## 📊 비용 안내

**Firebase 무료 할당량 (Spark 플랜)**:
- ❌ Cloud Functions 사용 불가

**Blaze 요금제 (종량제)** 필요:
- ✅ Functions: 200만 호출/월 무료
- ✅ Firestore: 50,000 읽기/일 무료
- ✅ Hosting: 10GB 전송/월 무료

**예상 비용** (소규모):
- 키워드 5개 × 매체 10개 × 2시간 주기 = **월 $0~5**

---

## ✅ 최종 체크리스트

배포 완료 후 다음 항목들을 확인하세요:

- [ ] Firebase 프로젝트 생성 완료
- [ ] Firestore Database 활성화
- [ ] Firebase Config 업데이트 (`firebase-config.js`)
- [ ] Firestore 규칙 배포
- [ ] Firebase Functions 배포
- [ ] Firebase Hosting 또는 GitHub Pages 배포
- [ ] 관리자 페이지에서 키워드 추가
- [ ] 관리자 페이지에서 매체 추가
- [ ] 수동 수집 테스트
- [ ] 대시보드에서 데이터 확인
- [ ] 스케줄러 로그 확인 (2시간 후)

---

## 🎉 완료!

배포가 완료되었습니다! 이제 다음을 확인하세요:

1. **대시보드**: 키워드 트렌드 확인
2. **관리자 페이지**: 키워드/매체 관리
3. **Firebase Console**: Functions 로그 모니터링

문제가 발생하면 `DEPLOYMENT.md`를 참고하거나 Firebase 로그를 확인하세요.

---

**Happy Monitoring! 📊✨**
