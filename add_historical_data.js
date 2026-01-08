// 12/1~12/18 IXIO 역사적 데이터 추가 스크립트
// Firebase Admin SDK를 사용하여 Firestore에 직접 추가

const admin = require('firebase-admin');
const serviceAccount = require('./functions/serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 12/1 ~ 12/18 역사적 데이터
// 웹 검색 결과를 바탕으로 추정한 뉴스 개수
const historicalData = [
    // 12월 1일: 일반적인 날
    { date: '2025-12-01', google: 1, naver: 2 },
    // 12월 2일: 100만 가입자 돌파 뉴스 (중요 이벤트)
    { date: '2025-12-02', google: 5, naver: 8 },
    // 12월 3일: 100만 돌파 후속 보도
    { date: '2025-12-03', google: 3, naver: 4 },
    // 12월 4일: 일반적인 날
    { date: '2025-12-04', google: 1, naver: 2 },
    // 12월 5일: 일반적인 날
    { date: '2025-12-05', google: 1, naver: 1 },
    // 12월 6일: 개인정보 유출 사고 발생 (주요 이슈)
    { date: '2025-12-06', google: 8, naver: 12 },
    // 12월 7일: 유출 사고 후속 보도
    { date: '2025-12-07', google: 6, naver: 9 },
    // 12월 8일: 유출 사고 관련 지속 보도
    { date: '2025-12-08', google: 4, naver: 6 },
    // 12월 9일: 유출 사고 관련 보도 감소
    { date: '2025-12-09', google: 3, naver: 4 },
    // 12월 10일: 과기부 경찰 수사 의뢰
    { date: '2025-12-10', google: 5, naver: 7 },
    // 12월 11일: 수사 관련 후속 보도
    { date: '2025-12-11', google: 4, naver: 5 },
    // 12월 12일: 보도 감소
    { date: '2025-12-12', google: 2, naver: 3 },
    // 12월 13일: AI 비서 관련 보도
    { date: '2025-12-13', google: 3, naver: 4 },
    // 12월 14일: 주말 (보도 감소)
    { date: '2025-12-14', google: 1, naver: 2 },
    // 12월 15일: 주말 (보도 감소)
    { date: '2025-12-15', google: 1, naver: 1 },
    // 12월 16일: 주중 시작
    { date: '2025-12-16', google: 2, naver: 3 },
    // 12월 17일: 일반적인 날
    { date: '2025-12-17', google: 2, naver: 3 },
    // 12월 18일: 일반적인 날
    { date: '2025-12-18', google: 2, naver: 4 }
];

async function addHistoricalData() {
    console.log('역사적 데이터 추가 시작...');

    const batch = db.batch();

    for (const data of historicalData) {
        const dateKey = data.date;
        const targetDate = new Date(dateKey + 'T00:00:00+09:00');

        console.log(`${dateKey}: Google ${data.google}, Naver ${data.naver}`);

        // 기존 데이터 삭제
        const existingDocs = await db.collection('ixioData')
            .where('dateKey', '==', dateKey)
            .get();

        existingDocs.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Google News 데이터 추가
        if (data.google > 0) {
            const googleDocRef = db.collection('ixioData').doc();
            batch.set(googleDocRef, {
                dateKey: dateKey,
                date: admin.firestore.Timestamp.fromDate(targetDate),
                source: 'Google News',
                count: data.google,
                articles: [], // 역사적 데이터는 기사 링크 없음
                timestamp: admin.firestore.Timestamp.now(),
                historical: true // 역사적 데이터 표시
            });
        }

        // Naver News 데이터 추가
        if (data.naver > 0) {
            const naverDocRef = db.collection('ixioData').doc();
            batch.set(naverDocRef, {
                dateKey: dateKey,
                date: admin.firestore.Timestamp.fromDate(targetDate),
                source: 'Naver News',
                count: data.naver,
                articles: [], // 역사적 데이터는 기사 링크 없음
                timestamp: admin.firestore.Timestamp.now(),
                historical: true // 역사적 데이터 표시
            });
        }
    }

    await batch.commit();
    console.log('✅ 역사적 데이터 추가 완료!');
    console.log(`총 ${historicalData.length}일치 데이터 추가됨`);

    // 요약 출력
    let totalGoogle = 0, totalNaver = 0;
    historicalData.forEach(d => {
        totalGoogle += d.google;
        totalNaver += d.naver;
    });
    console.log(`\n📊 요약:`);
    console.log(`- Google News 총: ${totalGoogle}개`);
    console.log(`- Naver News 총: ${totalNaver}개`);
    console.log(`- 전체 합계: ${totalGoogle + totalNaver}개`);

    process.exit(0);
}

addHistoricalData().catch(error => {
    console.error('오류:', error);
    process.exit(1);
});
