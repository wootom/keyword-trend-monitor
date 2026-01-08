# Naver API 환경 변수 설정 가이드

## Firebase Functions에 Naver API 키 설정하기

### 방법 1: Firebase CLI 사용 (권장)

터미널에서 다음 명령 실행:

```bash
cd /Users/fovea/Documents/keyword

# Naver API Client ID 설정
npx firebase functions:config:set naver.client_id="YOUR_CLIENT_ID_HERE"

# Naver API Client Secret 설정
npx firebase functions:config:set naver.client_secret="YOUR_CLIENT_SECRET_HERE"
```

**중요**: `YOUR_CLIENT_ID_HERE`와 `YOUR_CLIENT_SECRET_HERE`를 
Naver Developers에서 발급받은 실제 값으로 교체하세요!

예시:
```bash
npx firebase functions:config:set naver.client_id="abc123def456ghi789jk"
npx firebase functions:config:set naver.client_secret="xyz987wvu654tsr321qp"
```

### 설정 확인

```bash
npx firebase functions:config:get
```

출력 예시:
```json
{
  "naver": {
    "client_id": "abc123def456ghi789jk",
    "client_secret": "xyz987wvu654tsr321qp"
  }
}
```

### 재배포 필요

환경 변수를 설정한 후 Functions를 다시 배포해야 적용됩니다:

```bash
npx firebase deploy --only functions
```

---

## 방법 2: .env 파일 사용 (로컬 테스트용)

로컬 에뮬레이터에서 테스트할 때는 `.env` 파일을 사용할 수 있습니다:

1. `functions/.env` 파일 생성:
```bash
NAVER_CLIENT_ID=abc123def456ghi789jk
NAVER_CLIENT_SECRET=xyz987wvu654tsr321qp
```

2. **주의**: `.env` 파일은 절대 Git에 커밋하지 마세요!
   `.gitignore`에 추가:
```
functions/.env
```

---

## 다음 단계

환경 변수 설정 후:
1. Functions 코드에서 실제 Naver API 호출 활성화
2. Functions 재배포
3. 실제 뉴스 데이터 수집 테스트

---

## Naver Developers 등록이 완료되었나요?

완료하셨으면 발급받은 Client ID와 Client Secret을 알려주시면,
위 명령어로 설정을 진행하겠습니다!

또는 직접 설정하시려면:
1. Naver Developers에서 Client ID, Secret 복사
2. 위의 명령어에 붙여넣기
3. 실행

어느 쪽으로 하시겠습니까?
