# 🌐 Global News Keyword Monitor

글로벌 뉴스 키워드 모니터링 시스템 - 여러 언어권의 뉴스를 실시간으로 수집하고 분석합니다.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Firebase](https://img.shields.io/badge/Firebase-Cloud%20Functions-orange)
![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.x-06B6D4)

## 📖 개요

이 시스템은 Google News RSS 피드를 통해 전 세계 뉴스를 수집하고, AI(Gemini)를 활용하여 한국어로 번역하는 키워드 모니터링 솔루션입니다.

### 주요 기능

- 🔍 **다국어 뉴스 수집**: 영어, 포르투갈어, 말레이어, 인도네시아어, 일본어, 아랍어 지원
- 🤖 **AI 번역**: Google Gemini API를 활용한 자동 번역
- 📊 **트렌드 분석**: 일별 키워드 언급량 차트
- ⏰ **자동 수집**: Cloud Scheduler를 통한 2시간 주기 자동 수집
- 📱 **반응형 UI**: Toss 스타일의 모던한 인터페이스

## 🛠 기술 스택

### Frontend
- HTML5, Tailwind CSS
- Chart.js
- Firebase SDK

### Backend
- Firebase Cloud Functions (Node.js 20)
- Firestore Database
- Google Gemini API

## 📁 프로젝트 구조

```
keyword-trend-monitor/
├── public/                     # 프론트엔드 파일
│   ├── css/style.css          # 스타일시트
│   ├── js/                    # JavaScript 모듈
│   │   ├── firebase-config.js
│   │   └── global-news-task.js
│   ├── global-news.html       # Task 목록 페이지
│   └── global-news-task.html  # Task 상세 대시보드
├── functions/                  # Firebase Cloud Functions
│   ├── index.js               # 메인 함수
│   └── newsTranslator.js      # 번역 모듈
└── firebase.json              # Firebase 설정
```

## 🚀 배포

### Firebase 배포

```bash
# 전체 배포
firebase deploy

# Functions만 배포
firebase deploy --only functions

# Hosting만 배포
firebase deploy --only hosting
```

### 라이브 URL
- **웹사이트**: https://keyword-trend-monitor.web.app
- **Functions**: https://asia-northeast3-keyword-trend-monitor.cloudfunctions.net

## 📡 API 엔드포인트

| 함수명 | 설명 |
|--------|------|
| `collectGlobalNews` | 특정 Task의 뉴스 수집 |
| `backfillGlobalNews` | 30일치 데이터 백필 |
| `translateGlobalNews` | 뉴스 제목 한국어 번역 |
| `debugGlobalNewsData` | 데이터 디버깅/삭제 |

## 📊 데이터 구조

### globalTasks (Task 설정)
```json
{
  "name": "Task 이름",
  "keywords": ["keyword1", "keyword2"],
  "languages": ["en", "pt-BR"],
  "isActive": true
}
```

### globalNewsData (수집된 데이터)
```json
{
  "taskId": "task_id",
  "dateKey": "2026-01-09",
  "count": 10,
  "articles": [
    {
      "title": "Original Title",
      "translatedTitle": "번역된 제목",
      "link": "https://...",
      "language": "en"
    }
  ]
}
```

## 🎨 UI 특징

- **Toss 스타일 디자인**: 깔끔하고 모던한 인터페이스
- **Tailwind CSS**: 유틸리티 기반 스타일링
- **반응형 레이아웃**: 모바일/데스크톱 최적화
- **다크 모드 지원 예정**

## 📝 라이선스

MIT License

## 👨‍💻 개발

© 2025 fovea. All rights reserved.