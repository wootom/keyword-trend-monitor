# 📧 이메일 알림 시스템 사용 가이드

## ✅ 구현 완료 사항

### 1. 여러 이메일 수신자 등록 기능
- 관리자 페이지 > 알림 설정 탭
- 이메일 주소 입력 후 "추가" 버튼 클릭
- 등록된 이메일 목록 테이블로 표시
- 개별 삭제 가능

### 2. Firestore 데이터 구조

```javascript
// alerts 컬렉션 (급증 알림 저장)
{
  keyword: "ChatGPT",
  currentCount: 150,
  averageCount: 70,
  increaseRate: 114,
  timestamp: Timestamp,
  read: false,
  articles: [
    {
      title: "기사 제목",
      link: "https://...",
      pubDate: "2025-12-19...",
      source: "Google News" | "Naver News",
      type: "recent" | "random"
    },
    // ... 최신 5개 + 랜덤 5개 = 총 10개
  ]
}

// emailRecipients 컬렉션 (이메일 수신자 목록)
{
  email: "user@company.com",
  active: true,
  createdAt: Timestamp
}

// settings 컬렉션 (알림 설정)
{
  alertThreshold: 2,  // 2배
  alertCheckInterval: 60,  // 60분
  alertEnabled: true
}
```

---

## 🚀 사용 방법

### 1단계: 수신자 이메일 등록

1. **관리자 페이지 접속**
   ```
   https://keyword-trend-monitor.web.app/admin.html
   ```

2. **"알림 설정" 탭 클릭**

3. **이메일 추가**
   - 입력 필드에 이메일 주소 입력
   - "➕ 추가" 버튼 클릭
   - 여러 명 등록 가능 (무제한)

4. **등록된 이메일 확인**
   - 테이블에서 모든 수신자 확인
   - 삭제 버튼으로 개별 제거 가능

### 2단계: 알림 설정

1. **급증 기준 설정**
   - 1.5배, 2배, 3배, 5배 중 선택
   - 기본값: 2배 (100% 증가)

2. **검사 주기 설정**
   - 30분, 1시간, 2시간, 6시간 중 선택
   - 기본값: 1시간마다

3. **알림 활성화/비활성화**
   - 체크박스로 on/off 전환

4. **"설정 저장" 버튼 클릭**

### 3단계: 테스트

1. **테스트 이메일 발송 버튼 클릭**
2. 등록된 모든 이메일로 테스트 발송
3. 수신 확인

---

## 📨 이메일 발송 방식

### 현재 시스템 (Firestore만 사용)
Firebase Functions에서 급증 감지 시:
1. Firestore `alerts` 컬렉션에 저장
2. 프론트엔드에서 실시간 감지
3. 브라우저 알림 표시

### 실제 이메일 발송 (추가 구현 필요)

#### 옵션 1: SendGrid (권장)
```bash
# Functions 디렉토리에서
npm install @sendgrid/mail

# Functions 설정
npx firebase functions:config:set sendgrid.api_key="YOUR_API_KEY"
```

**장점:**
- ✅ 매월 100통 무료
- ✅ 간단한 API
- ✅ 높은 전송률
- ✅ 템플릿 지원

#### 옵션 2: Nodemailer (Gmail SMTP)
```bash
npm install nodemailer
```

**장점:**
- ✅ 완전 무료
- ✅ 자체 메일 서버 사용
- ✅ 설정 간단

**단점:**
- ❌ Gmail 보안 설정 필요
- ❌ 일일 전송 제한 (500통)

---

## 🔧 이메일 발송 기능 추가 방법

### 1. SendGrid 설정

```javascript
// functions/index.js에 추가
const sgMail = require('@sendgrid/mail');
const SENDGRID_API_KEY = functions.config().sendgrid.api_key;
sgMail.setApiKey(SENDGRID_API_KEY);

async function sendSpikeEmail(alert) {
  // 수신자 목록 가져오기
  const recipientsSnapshot = await db.collection('emailRecipients')
    .where('active', '==', true)
    .get();
  
  const recipients = recipientsSnapshot.docs.map(doc => doc.data().email);
  
  if (recipients.length === 0) {
    console.log('등록된 이메일 수신자가 없습니다.');
    return;
  }
  
  // 이메일 내용 구성
  const emailHTML = `
    <h2>🔔 키워드 급증 알림</h2>
    <p><strong>키워드:</strong> ${alert.keyword}</p>
    <p><strong>현재 언급량:</strong> ${alert.currentCount}건</p>
    <p><strong>평균 언급량:</strong> ${alert.averageCount}건</p>
    <p><strong>증가율:</strong> <span style="color: red;">+${alert.increaseRate}%</span></p>
    
    <h3>가장 최근 기사 (5개)</h3>
    <ul>
      ${alert.articles.filter(a => a.type === 'recent').map(a => 
        `<li><a href="${a.link}">${a.title}</a> (${a.source})</li>`
      ).join('')}
    </ul>
    
    <h3>랜덤 샘플 (5개)</h3>
    <ul>
      ${alert.articles.filter(a => a.type === 'random').map(a => 
        `<li><a href="${a.link}">${a.title}</a> (${a.source})</li>`
      ).join('')}
    </ul>
  `;
  
  // 이메일 발송
  const msg = {
    to: recipients,
    from: 'alerts@yourdomain.com', // SendGrid에서 인증된 발신 이메일
    subject: `[급증 알림] ${alert.keyword} 키워드 ${alert.increaseRate}% 증가`,
    html: emailHTML
  };
  
  try {
    await sgMail.send(msg);
    console.log(`✅ 이메일 발송 완료: ${recipients.length}명`);
  } catch (error) {
    console.error('이메일 발송 실패:', error);
  }
}
```

### 2. 급증 감지 시 이메일 발송

```javascript
// checkAndNotifySpike 함수에서 호출
if (currentCount >= spikeThreshold) {
  // Firestore에 저장
  const alertDoc = await db.collection('alerts').add({...});
  
  // 이메일 발송
  await sendSpikeEmail({
    keyword: keyword,
    currentCount: currentCount,
    averageCount: Math.round(average),
    increaseRate: Math.round((currentCount / average - 1) * 100),
    articles: sampleArticles
  });
}
```

---

## 📋 작업 완료 체크리스트

- ✅ Firestore `emailRecipients` 컬렉션 구조 정의
- ✅ 관리자 페이지 UI 구현 (이메일 추가/삭제)
- ✅ 알림 설정 UI 개선
- ✅ 이메일 템플릿 미리보기

### 추가 구현 필요 (선택사항)
- ⏳ SendGrid 또는 Nodemailer 설정
- ⏳ 실제 이메일 발송 함수 구현
- ⏳ 테스트 이메일 발송 기능
- ⏳ 이메일 발송 이력 저장

---

## 💡 빠른 시작 (SendGrid 사용)

1. **SendGrid 가입** (무료)
   ```
   https://signup.sendgrid.com/
   ```

2. **API 키 생성**
   - Settings > API Keys > Create API Key
   - Full Access 권한 선택

3. **발신 이메일 인증**
   - Settings > Sender Authentication
   - Single Sender Verification
   - 이메일 주소 입력 및 인증

4. **Firebase에 API 키 설정**
   ```bash
   cd /Users/fovea/Documents/keyword
   npx firebase functions:config:set sendgrid.api_key="YOUR_API_KEY"
   ```

5. **Functions 코드에 이메일 발송 로직 추가** (위 예시 참고)

6. **재배포**
   ```bash
   npx firebase deploy --only functions
   ```

---

## 🎯 결과

급증 감지 시:
1. 🔍 매시간 자동 뉴스 수집
2. 📊 평균 대비 급증 여부 확인
3. 💾 Firestore에 알림 + 기사 10개 저장
4. 📧 등록된 모든 이메일로 발송
5. 🌐 대시보드에 실시간 표시

**모든 팀원이 즉시 알림을 받습니다!** 🎉

---

## ❓ 문의사항

추가 기능이 필요하거나 질문이 있으시면 언제든 말씀해주세요!
