/**
 * 전체 데이터 재수집 스크립트
 * 2025-12-01부터 현재까지 모든 데이터를 새로운 필터로 재수집
 * 
 * 사용법: node scripts/recollect-all-data.js
 */

const START_DATE = '2025-12-01';

async function recollectAllData() {
    console.log('='.repeat(60));
    console.log('IXIO 전체 데이터 재수집 시작');
    console.log('주요 언론사 필터 적용 (AI타임스 포함)');
    console.log('='.repeat(60));

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // 날짜 목록 생성
    const dates = [];
    for (let d = new Date(START_DATE); d <= today; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split('T')[0];
        dates.push(dateStr);
    }

    console.log(`\n수집 기간: ${START_DATE} ~ ${todayStr}`);
    console.log(`총 ${dates.length}일치 데이터 수집 예정\n`);

    const results = [];

    for (let i = 0; i < dates.length; i++) {
        const dateKey = dates[i];
        console.log(`[${i + 1}/${dates.length}] ${dateKey} 수집 중...`);

        try {
            const response = await fetch(
                `https://asia-northeast3-keyword-trend-monitor.cloudfunctions.net/collectIxioData?date=${dateKey}`
            );

            if (!response.ok) {
                console.error(`  ❌ 실패: ${response.statusText}`);
                continue;
            }

            const result = await response.json();

            if (result.success) {
                const total = result.grandTotal || (result.totalGoogle + result.totalNaver);
                console.log(`  ✅ Google: ${result.totalGoogle}, Naver: ${result.totalNaver}, 합계: ${total}`);
                results.push({
                    date: dateKey,
                    google: result.totalGoogle,
                    naver: result.totalNaver,
                    total: total
                });
            } else {
                console.error(`  ⚠️ 오류: ${result.error}`);
            }

            // API 호출 제한 방지 (2초 대기)
            await new Promise(resolve => setTimeout(resolve, 2000));

        } catch (error) {
            console.error(`  ❌ 오류: ${error.message}`);
        }
    }

    // 결과 요약
    console.log('\n' + '='.repeat(60));
    console.log('수집 완료! 결과 요약:');
    console.log('='.repeat(60));

    let totalGoogle = 0, totalNaver = 0, grandTotal = 0;
    results.forEach(r => {
        totalGoogle += r.google;
        totalNaver += r.naver;
        grandTotal += r.total;
    });

    console.log(`\n성공: ${results.length}/${dates.length}일`);
    console.log(`총 Google News: ${totalGoogle}개`);
    console.log(`총 Naver News: ${totalNaver}개`);
    console.log(`총 합계: ${grandTotal}개`);

    // 일별 상세
    console.log('\n일별 상세:');
    results.forEach(r => {
        console.log(`  ${r.date}: G=${r.google}, N=${r.naver}, 합계=${r.total}`);
    });
}

// Node.js 환경인지 확인
if (typeof window === 'undefined') {
    // Node.js 환경
    recollectAllData()
        .then(() => {
            console.log('\n완료!');
            process.exit(0);
        })
        .catch(err => {
            console.error('오류:', err);
            process.exit(1);
        });
} else {
    // 브라우저 환경
    window.recollectAllData = recollectAllData;
}
