# Firebase Authentication 수동 설정 가이드

## 현재 상황
Firebase Console에서 Google 로그인 설정이 안 되는 경우의 해결 방법입니다.

## 방법 1: Firebase Console 재시도

### 단계별 안내 (스크린샷 참고)

1. **Authentication 페이지 접속**
   - URL: https://console.firebase.google.com/project/keyword-trend-monitor/authentication
   - 왼쪽 메뉴: "Build" > "Authentication" 클릭

2. **처음 사용하는 경우**
   - "시작하기" 버튼이 보이면 클릭
   - 몇 초 기다리면 Authentication이 활성화됨

3. **Sign-in method 탭**
   - 상단의 "Sign-in method" 또는 "로그인 방법" 탭 클릭
   - 여러 로그인 제공업체 목록이 보여야 함

4. **Google 설정**
   - 목록에서 "Google" 찾기 (맨 위에 있을 것)
   - "Google" 행을 클릭 (아무 곳이나)
   - 우측 패널이 열림

5. **활성화**
   - "Enable" 또는 "사용 설정" 토글을 ON으로 변경
   - "프로젝트 지원 이메일" 드롭다운에서 이메일 선택 (중요!)
   - "저장" 버튼 클릭

6. **확인**
   - Google 행의 "Status" 열에 "Enabled" 표시 확인

## 방법 2: 임시 대안 (로그인 없이 진행)

Google 로그인 설정이 계속 안 되면, 일단 로그인 기능을 건너뛰고 다음 단계로 진행할 수 있습니다:

1. 게스트 모드로 시스템 사용
2. 나중에 Authentication 설정

## 방법 3: 직접 수동 확인

Firebase Console에서 다음을 확인해주세요:

1. **프로젝트 권한**
   - 본인이 프로젝트의 "Owner" 또는 "Editor" 권한이 있는지 확인
   - Settings > Users and permissions에서 확인 가능

2. **Firebase 요금제**
   - Spark (무료) 플랜에서도 Authentication은 사용 가능
   - 하지만 일부 기능은 Blaze 플랜이 필요할 수 있음

3. **브라우저 캐시/쿠키**
   - Firebase Console을 시크릿/프라이빗 모드에서 다시 열어보기
   - 다른 브라우저에서 시도해보기

## 다음 단계

설정이 완료되면:
- http://localhost:8080/login.html 접속
- Google 로그인 테스트

설정이 계속 안 되면:
- 정확히 어느 단계에서 막혔는지 알려주세요
- 에러 메시지가 있다면 그 내용을 알려주세요
