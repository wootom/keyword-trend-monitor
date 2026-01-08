/**
 * IXIO 언급량 트렌드 페이지
 * 2025.12.01부터 현재까지 일별 데이터 수집 및 표시
 */

const KEYWORDS = ['ixio', 'ixi-o', '익시오'];
const START_DATE = new Date('2025-12-01T00:00:00+09:00');
let trendChart = null;
let dailyData = {};

// ==================== 초기화 ====================
document.addEventListener('DOMContentLoaded', () => {
    loadAllData();
});

// ==================== 전체 데이터 로드 ====================
async function loadAllData() {
    const btn = document.getElementById('refresh-btn');
    const icon = document.getElementById('refresh-icon');

    btn.disabled = true;
    icon.innerHTML = '<span class="loading"></span> 로딩 중...';

    try {
        // Firestore에서 기존 데이터 로드
        await loadExistingData();

        // 데이터 시각화
        updateStatistics();
        renderChart();
        renderTable();

        // 누락된 날짜 백필 (백그라운드)
        setTimeout(() => backfillMissingDates(), 1000);

    } catch (error) {
        console.error('데이터 로드 오류:', error);
        alert('데이터 로드 중 오류가 발생했습니다.');
    } finally {
        btn.disabled = false;
        icon.textContent = '🔄 새로고침';
    }
}

// ==================== Firestore에서 데이터 로드 ====================
async function loadExistingData() {
    try {
        // ixio 관련 데이터 조회
        const snapshot = await db.collection('ixioData')
            .where('date', '>=', firebase.firestore.Timestamp.fromDate(START_DATE))
            .orderBy('date', 'asc')
            .get();

        dailyData = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            const dateKey = data.dateKey; // YYYY-MM-DD

            if (!dailyData[dateKey]) {
                dailyData[dateKey] = {
                    date: data.date.toDate(),
                    google: 0,
                    naver: 0,
                    total: 0,
                    articles: [] // 모든 기사 저장
                };
            }

            if (data.source === 'Google News') {
                dailyData[dateKey].google += data.count;
                if (data.articles) {
                    dailyData[dateKey].articles = dailyData[dateKey].articles.concat(
                        data.articles.map(art => ({ ...art, source: 'G' }))
                    );
                }
            } else if (data.source === 'Naver News') {
                dailyData[dateKey].naver += data.count;
                if (data.articles) {
                    dailyData[dateKey].articles = dailyData[dateKey].articles.concat(
                        data.articles.map(art => ({ ...art, source: 'N' }))
                    );
                }
            }

            dailyData[dateKey].total = dailyData[dateKey].google + dailyData[dateKey].naver;
        });

        // 🆕 START_DATE부터 오늘까지 모든 날짜 채우기 (0건인 날짜도 표시)
        fillMissingDates();

        console.log(`${Object.keys(dailyData).length}일치 데이터 로드됨`);
    } catch (error) {
        console.error('Firestore 데이터 로드 오류:', error);
        dailyData = {};
    }
}

// 🆕 누락된 날짜를 0으로 채우는 함수
function fillMissingDates() {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    for (let d = new Date(START_DATE); d <= today; d.setDate(d.getDate() + 1)) {
        const dateKey = formatDateKey(d);
        if (!dailyData[dateKey]) {
            dailyData[dateKey] = {
                date: new Date(d),
                google: 0,
                naver: 0,
                total: 0,
                articles: []
            };
        }
    }
}

// ==================== 누락된 날짜 백필 ====================
let backfillInProgress = false; // 백필 중복 실행 방지

async function backfillMissingDates() {
    if (backfillInProgress) {
        console.log('백필이 이미 진행 중입니다.');
        return;
    }

    backfillInProgress = true;

    const today = new Date();
    today.setHours(0, 0, 0, 0); // 오늘 자정

    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1); // 어제까지만

    const missingDates = [];

    // 2025.12.01부터 어제까지만 확인 (오늘 제외!)
    for (let d = new Date(START_DATE); d <= yesterday; d.setDate(d.getDate() + 1)) {
        const dateKey = formatDateKey(d);
        if (!dailyData[dateKey]) {
            missingDates.push(new Date(d));
        }
    }

    if (missingDates.length === 0) {
        console.log('모든 과거 데이터가 최신 상태입니다.');
        backfillInProgress = false;
        return;
    }

    console.log(`${missingDates.length}일치 과거 데이터 백필 시작...`);

    // 각 날짜별로 데이터 수집
    for (const date of missingDates) {
        await collectDailyData(date);
        // API 호출 제한 방지
        await sleep(2000); // 2초로 증가
    }

    console.log('백필 완료!');
    backfillInProgress = false;

    // 데이터만 다시 로드 (백필 재실행 방지)
    await loadExistingData();
    updateStatistics();
    renderChart();
    renderTable();
}

// ==================== 특정 날짜 데이터 수집 ====================
async function collectDailyData(targetDate) {
    const dateKey = formatDateKey(targetDate);
    console.log(`${dateKey} 데이터 수집 중...`);

    try {
        // Firebase Functions API 호출하여 과거 데이터 수집
        const response = await fetch(
            `https://asia-northeast3-keyword-trend-monitor.cloudfunctions.net/collectIxioData?date=${dateKey}`
        );

        if (!response.ok) {
            console.error(`${dateKey} 수집 실패:`, response.statusText);
            return;
        }

        const result = await response.json();
        console.log(`${dateKey}: Google ${result.google}개, Naver ${result.naver}개`);

    } catch (error) {
        console.error(`${dateKey} 수집 오류:`, error);
    }
}

// ==================== 통계 업데이트 ====================
function updateStatistics() {
    const dates = Object.keys(dailyData).sort();

    if (dates.length === 0) {
        return;
    }

    // 총 언급량
    const totalMentions = Object.values(dailyData).reduce((sum, day) => sum + day.total, 0);
    document.getElementById('total-mentions').textContent = totalMentions.toLocaleString();

    // 오늘 언급량
    const today = formatDateKey(new Date());
    const todayData = dailyData[today];
    if (todayData) {
        document.getElementById('today-mentions').textContent = todayData.total.toLocaleString();
        document.getElementById('today-date').textContent = formatDateDisplay(today);
    } else {
        document.getElementById('today-mentions').textContent = '0';
        document.getElementById('today-date').textContent = formatDateDisplay(today);
    }

    // 일평균
    const avgMentions = Math.round(totalMentions / dates.length);
    document.getElementById('avg-mentions').textContent = avgMentions.toLocaleString();

    // 최고 언급량
    const sortedByTotal = dates.sort((a, b) => dailyData[b].total - dailyData[a].total);
    const peakDate = sortedByTotal[0];
    if (peakDate) {
        document.getElementById('peak-mentions').textContent = dailyData[peakDate].total.toLocaleString();
        document.getElementById('peak-date').textContent = formatDateDisplay(peakDate);
    }
}

// ==================== 차트 렌더링 ====================
// 2025년 12월 한국 공휴일
const koreanHolidays = [
    '2025-12-25' // 크리스마스
];

// 공휴일/주말 체크
function isHolidayOrWeekend(dateStr) {
    const date = new Date(dateStr + 'T00:00:00+09:00');
    const day = date.getDay(); // 0=일요일, 6=토요일

    // 주말 체크
    if (day === 0 || day === 6) return true;

    // 공휴일 체크
    if (koreanHolidays.includes(dateStr)) return true;

    return false;
}

// 🆕 키워드를 문장형으로 변환
function makeSentenceStyle(keyword, count, prevCount) {
    // 부정적 키워드인지 판단
    const negativeWords = ['유출', '사고', '피해', '논란', '문제', '오류', '장애', '해킹', '침해'];
    const isNegative = negativeWords.some(w => keyword.includes(w));

    // 증가폭에 따른 접미어 선택
    const increase = prevCount > 0 ? count / prevCount : count;

    if (isNegative) {
        return keyword + ' 파장';
    } else if (increase >= 3) {
        return keyword + ' 이슈';
    } else {
        return keyword + ' 주목';
    }
}

// 🆕 급증 감지 및 키워드 추출
function detectSpikesAndKeywords() {
    const dates = Object.keys(dailyData).sort();
    const spikes = [];

    for (let i = 1; i < dates.length; i++) {
        const prevDate = dates[i - 1];
        const currDate = dates[i];
        const prevCount = dailyData[prevDate].total;
        const currCount = dailyData[currDate].total;

        // 급증 조건: 전일 대비 2배 이상 AND 최소 5건 이상
        // 또는 전일 0건인 경우 10건 이상이면 급증으로 판단
        const isSpike = (prevCount > 0 && currCount >= prevCount * 2 && currCount >= 5) ||
            (prevCount === 0 && currCount >= 10);

        if (isSpike) {
            const keywords = extractKeywords(dailyData[currDate].articles);
            if (keywords.length > 0) {
                // 상위 2개 키워드 조합 + 문장형 접미어
                const baseKeyword = keywords.slice(0, 2).join(' ');
                const keywordText = makeSentenceStyle(baseKeyword, currCount, prevCount);
                spikes.push({
                    date: currDate,
                    index: i,
                    count: currCount,
                    prevCount: prevCount,
                    keyword: keywordText
                });
            }
        }
    }

    return spikes;
}

// 🆕 기사 제목에서 키워드 추출
function extractKeywords(articles) {
    if (!articles || articles.length === 0) return [];

    // 제외할 단어 (불용어)
    const stopWords = ['익시오', 'ixio', 'ixi-o', 'LG유플러스', 'LGU+',
        '기자', '뉴스', '오늘', '내일', '어제', '위해', '통해', '대한', '관련',
        '있다', '했다', '된다', '한다', '것으로', '라며', '이번', '최근',
        '서비스', '등록', '제공', '사용', '이용', '경우', '때문', '하지만'];

    // 모든 제목 합치기
    const titles = articles.map(a => a.title || '').join(' ');

    // 2글자 이상 한글 단어 추출
    const words = titles.match(/[가-힣]{2,}/g) || [];

    // 빈도 계산
    const wordCount = {};
    words.forEach(word => {
        if (!stopWords.includes(word) && word.length >= 2) {
            wordCount[word] = (wordCount[word] || 0) + 1;
        }
    });

    // 빈도순 정렬 - 상위 4개 (조합용)
    const sortedWords = Object.entries(wordCount)
        .filter(([word]) => word.length >= 2) // 최소 2글자
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([word]) => word);

    return sortedWords;
}

function renderChart() {
    const ctx = document.getElementById('trend-chart');
    const chartWrapper = document.getElementById('chart-wrapper');
    const scrollContainer = document.getElementById('chart-scroll-container');

    if (trendChart) {
        trendChart.destroy();
    }

    const dates = Object.keys(dailyData).sort();
    const labels = dates.map(d => d.substring(5)); // MM-DD
    const googleData = dates.map(d => dailyData[d].google);
    const naverData = dates.map(d => dailyData[d].naver);
    const totalData = dates.map(d => dailyData[d].total);

    // 🆕 데이터 개수에 따라 차트 너비 동적 설정 (최소 30일 표시, 이후 확장)
    const minDays = 30;
    const pixelsPerDay = 35; // 하루당 픽셀
    const containerWidth = scrollContainer ? scrollContainer.clientWidth : 800;
    const calculatedWidth = Math.max(containerWidth, dates.length * pixelsPerDay);

    if (chartWrapper && dates.length > minDays) {
        chartWrapper.style.width = calculatedWidth + 'px';
    } else if (chartWrapper) {
        chartWrapper.style.width = '100%';
    }

    // 공휴일/주말 색상 배열
    const labelColors = dates.map(d => isHolidayOrWeekend(d) ? '#ea4335' : '#666');

    // 🆕 급증 감지 및 annotation 생성
    const spikes = detectSpikesAndKeywords();
    const annotations = {};

    spikes.forEach((spike, idx) => {
        const labelIndex = dates.indexOf(spike.date);

        // 키워드 라벨 (각 피크 상단에 위치)
        annotations[`spike${idx}`] = {
            type: 'label',
            xValue: labelIndex,
            yValue: spike.count + 3, // 해당 피크 바로 위
            content: [spike.keyword],
            backgroundColor: 'rgba(234, 67, 53, 0.9)',
            color: '#fff',
            font: {
                size: 11,
                weight: 'bold'
            },
            padding: { top: 4, bottom: 4, left: 8, right: 8 },
            borderRadius: 4
        };

        // 수직 점선
        annotations[`line${idx}`] = {
            type: 'line',
            xMin: labelIndex,
            xMax: labelIndex,
            borderColor: 'rgba(234, 67, 53, 0.5)',
            borderWidth: 2,
            borderDash: [5, 5]
        };
    });

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: '언급량',
                    data: totalData,
                    borderColor: '#1A73E8',
                    backgroundColor: 'rgba(26, 115, 232, 0.1)',
                    borderWidth: 3,
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        // 🆕 툴팁에 키워드 표시
                        afterBody: function (context) {
                            const index = context[0].dataIndex;
                            const dateKey = dates[index];
                            const articles = dailyData[dateKey]?.articles || [];
                            if (articles.length > 0) {
                                const keywords = extractKeywords(articles);
                                if (keywords.length > 0) {
                                    return ['', '주요 키워드: ' + keywords.join(', ')];
                                }
                            }
                            return [];
                        }
                    }
                },
                annotation: {
                    annotations: annotations
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: labelColors
                    }
                },
                y: {
                    beginAtZero: true,
                    max: Math.max(...totalData) + 10, // 🆕 annotation 공간 확보
                    ticks: {
                        stepSize: 2
                    }
                }
            },
            // 🆕 annotation 클리핑 방지
            layout: {
                padding: {
                    top: 30
                }
            }
        }
    });

    // 🆕 차트 렌더링 후 최신 데이터(오른쪽 끝)로 스크롤
    if (scrollContainer && dates.length > minDays) {
        setTimeout(() => {
            scrollContainer.scrollLeft = scrollContainer.scrollWidth;
        }, 100);
    }
}

// ==================== 테이블 렌더링 ====================
function renderTable() {
    const tbody = document.getElementById('data-table-body');
    tbody.innerHTML = '';

    const dates = Object.keys(dailyData).sort().reverse(); // 최신순

    if (dates.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">데이터가 없습니다.</td></tr>';
        return;
    }

    dates.forEach((dateKey, index) => {
        const data = dailyData[dateKey];
        const row = document.createElement('tr');

        // 전일 대비 계산
        let change = '-';
        if (index < dates.length - 1) {
            const prevDateKey = dates[index + 1];
            const prevTotal = dailyData[prevDateKey].total;
            const diff = data.total - prevTotal;

            if (diff > 0) {
                change = `<span style="color: var(--accent-green);">▲ ${diff}</span>`;
            } else if (diff < 0) {
                change = `<span style="color: var(--accent-red);">▼ ${Math.abs(diff)}</span>`;
            } else {
                change = '<span style="color: var(--text-secondary);">-</span>';
            }
        }

        // 모든 기사를 숫자 링크로 렌더링
        const articles = data.articles || [];
        let articlesHTML = '';
        if (articles.length > 0) {
            // 숫자 링크로 표시: [1] [2] [3] ...
            articlesHTML = articles.map((art, idx) =>
                `<a href="${art.link || art.url}" target="_blank" title="${art.title}" 
                   class="article-num-link">${idx + 1}</a>`
            ).join(' ');
        } else {
            articlesHTML = '<span class="text-muted">-</span>';
        }

        // 랜덤하게 2개의 기사 제목 선택
        let sampleHTML = '<span class="text-muted">-</span>';
        if (articles.length > 0) {
            // Fisher-Yates shuffle로 랜덤 선택
            const shuffled = [...articles].sort(() => 0.5 - Math.random());
            const samples = shuffled.slice(0, Math.min(2, articles.length));

            sampleHTML = samples.map(art => {
                const title = art.title || '';
                const truncated = title.length > 30 ? title.substring(0, 30) + '...' : title;
                return `<div style="margin-bottom: 0.25rem; font-size: 0.9em;">${truncated}</div>`;
            }).join('');
        }

        // 공휴일/주말 빨간색 스타일
        const isHoliday = isHolidayOrWeekend(dateKey);
        const dateStyle = isHoliday ? 'color: #ea4335;' : '';

        row.innerHTML = `
            <td><strong style="${dateStyle}">${formatDateDisplay(dateKey)}</strong></td>
            <td style="max-width: 250px; font-size: 0.85em; color: var(--text-secondary);">${sampleHTML}</td>
            <td><strong>${data.total}</strong></td>
            <td>${change}</td>
            <td class="article-links">${articlesHTML}</td>
        `;

        tbody.appendChild(row);
    });
}

// ==================== 유틸리티 함수 ====================
function formatDateKey(date) {
    // 한국 시간 기준으로 변환
    const d = new Date(date);
    const koreanTime = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const year = koreanTime.getFullYear();
    const month = String(koreanTime.getMonth() + 1).padStart(2, '0');
    const day = String(koreanTime.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatDateDisplay(dateKey) {
    const [year, month, day] = dateKey.split('-');
    const date = new Date(dateKey + 'T00:00:00+09:00');
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = dayNames[date.getDay()];
    return `${month}.${day}(${dayOfWeek})`;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// 전역 함수로 노출
window.loadAllData = loadAllData;

// ==================== 수동 데이터 입력 ====================

// 폼 이벤트 리스너 추가
document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('manual-entry-form');
    if (form) {
        form.addEventListener('submit', handleManualEntry);
    }
});

// 수동 입력 처리
async function handleManualEntry(event) {
    event.preventDefault();

    const dateInput = document.getElementById('entry-date');
    const googleInput = document.getElementById('entry-google');
    const naverInput = document.getElementById('entry-naver');

    const dateKey = dateInput.value; // YYYY-MM-DD
    const googleCount = parseInt(googleInput.value) || 0;
    const naverCount = parseInt(naverInput.value) || 0;

    if (!dateKey) {
        alert('날짜를 선택하세요.');
        return;
    }

    try {
        const targetDate = new Date(dateKey + 'T00:00:00+09:00');
        const batch = db.batch();

        // 기존 데이터 삭제 (중복 방지)
        const existingDocs = await db.collection('ixioData')
            .where('dateKey', '==', dateKey)
            .get();

        existingDocs.forEach(doc => {
            batch.delete(doc.ref);
        });

        // Google 데이터 저장
        if (googleCount > 0) {
            const googleDocRef = db.collection('ixioData').doc();
            batch.set(googleDocRef, {
                dateKey: dateKey,
                date: firebase.firestore.Timestamp.fromDate(targetDate),
                source: 'Google News',
                count: googleCount,
                timestamp: firebase.firestore.Timestamp.now(),
                manual: true // 수동 입력 표시
            });
        }

        // Naver 데이터 저장
        if (naverCount > 0) {
            const naverDocRef = db.collection('ixioData').doc();
            batch.set(naverDocRef, {
                dateKey: dateKey,
                date: firebase.firestore.Timestamp.fromDate(targetDate),
                source: 'Naver News',
                count: naverCount,
                timestamp: firebase.firestore.Timestamp.now(),
                manual: true // 수동 입력 표시
            });
        }

        await batch.commit();

        alert(`${dateKey} 데이터가 저장되었습니다!\n구글: ${googleCount}, 네이버: ${naverCount}`);

        // 폼 초기화
        googleInput.value = '';
        naverInput.value = '';

        // 데이터 새로고침
        loadAllData();

    } catch (error) {
        console.error('수동 입력 오류:', error);
        alert('데이터 저장 중 오류가 발생했습니다: ' + error.message);
    }
}

// 샘플 데이터 채우기 (12/1~12/18)
async function fillSampleData() {
    if (!confirm('12/1~12/18 기간의 샘플 데이터를 생성하시겠습니까?\n\n기존 데이터는 덮어쓰여집니다.')) {
        return;
    }

    try {
        const batch = db.batch();
        const startDate = new Date('2025-12-01');
        const endDate = new Date('2025-12-18');

        // 합리적인 패턴의 랜덤 데이터 생성
        let count = 0;
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            const dateKey = formatDateKey(d);
            const targetDate = new Date(d);

            // 점진적으로 증가하는 패턴 + 랜덤 변동
            const baseGoogleCount = Math.floor(2 + (count * 0.3));
            const baseNaverCount = Math.floor(1 + (count * 0.4));

            const googleCount = Math.max(0, baseGoogleCount + Math.floor(Math.random() * 5 - 2));
            const naverCount = Math.max(0, baseNaverCount + Math.floor(Math.random() * 5 - 2));

            // Google
            if (googleCount > 0) {
                const googleDocRef = db.collection('ixioData').doc();
                batch.set(googleDocRef, {
                    dateKey: dateKey,
                    date: firebase.firestore.Timestamp.fromDate(targetDate),
                    source: 'Google News',
                    count: googleCount,
                    timestamp: firebase.firestore.Timestamp.now(),
                    sample: true // 샘플 데이터 표시
                });
            }

            // Naver
            if (naverCount > 0) {
                const naverDocRef = db.collection('ixioData').doc();
                batch.set(naverDocRef, {
                    dateKey: dateKey,
                    date: firebase.firestore.Timestamp.fromDate(targetDate),
                    source: 'Naver News',
                    count: naverCount,
                    timestamp: firebase.firestore.Timestamp.now(),
                    sample: true // 샘플 데이터 표시
                });
            }

            count++;
        }

        await batch.commit();
        alert('샘플 데이터 생성 완료! (12/1~12/18)');
        loadAllData();

    } catch (error) {
        console.error('샘플 데이터 생성 오류:', error);
        alert('샘플 데이터 생성 중 오류가 발생했습니다: ' + error.message);
    }
}

// 전체 데이터 삭제
async function clearAllData() {
    if (!confirm('모든 IXIO 데이터를 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없습니다!')) {
        return;
    }

    const confirmation = prompt('정말로 삭제하시겠습니까? "삭제"를 입력하세요:');
    if (confirmation !== '삭제') {
        alert('취소되었습니다.');
        return;
    }

    try {
        const snapshot = await db.collection('ixioData').get();
        const batch = db.batch();

        snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        alert(`${snapshot.size}개의 데이터가 삭제되었습니다.`);
        loadAllData();

    } catch (error) {
        console.error('데이터 삭제 오류:', error);
        alert('데이터 삭제 중 오류가 발생했습니다: ' + error.message);
    }
}

// 전역 함수로 노출
window.fillSampleData = fillSampleData;
window.clearAllData = clearAllData;

// ==================== 오늘 데이터 수집 ====================
async function collectTodayData() {
    // 버튼을 ID로 직접 찾기
    const btn = document.getElementById('btn-collect-today');
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ 수집 중...';
    }

    try {
        const today = new Date();
        const dateKey = formatDateKey(today);

        console.log(`오늘(${dateKey}) 데이터 수집 시작...`);

        // Firebase Functions API 호출
        const response = await fetch(
            `https://asia-northeast3-keyword-trend-monitor.cloudfunctions.net/collectIxioData?date=${dateKey}`
        );

        if (!response.ok) {
            throw new Error(`수집 실패: ${response.statusText}`);
        }

        const result = await response.json();

        if (result.success) {
            const dateDisplay = result.dates && result.dates.length > 0
                ? result.dates.map(d => d.date).join(', ')
                : dateKey;

            // 모달 형태로 결과 표시 (사용자가 확인 버튼을 눌러야 닫힘)
            showCollectionResultModal({
                dateDisplay,
                google: result.totalGoogle,
                naver: result.totalNaver,
                total: result.grandTotal
            });

        } else {
            throw new Error(result.error || '알 수 없는 오류');
        }

    } catch (error) {
        console.error('오늘 데이터 수집 오류:', error);
        alert('데이터 수집 중 오류가 발생했습니다:\n' + error.message);

        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '📅 현재기준 데이터수집';
        }
    }
}

// 수집 결과 모달 표시
function showCollectionResultModal(result) {
    const modalHTML = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;">
            <div style="background: white; padding: 2rem; border-radius: 8px; max-width: 500px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" onclick="event.stopPropagation()">
                <h2 style="margin-top: 0; color: var(--primary-color);">✅ 데이터 수집 완료</h2>
                
                <div style="margin: 1.5rem 0; line-height: 1.8;">
                    <p><strong>📅 날짜:</strong> ${result.dateDisplay}</p>
                    <p><strong>📊 구글:</strong> ${result.google}개</p>
                    <p><strong>📊 네이버:</strong> ${result.naver}개</p>
                    <p><strong>📈 합계:</strong> <span style="color: var(--primary-color); font-size: 1.2em; font-weight: bold;">${result.total}개</span></p>
                </div>
                
                <div style="background: #f0f7ff; padding: 1rem; border-left: 4px solid var(--primary-color); border-radius: 4px; margin: 1rem 0;">
                    <p style="margin: 0; font-size: 0.9em;"><strong>💡 안내:</strong> 오늘 자정에 완전한 데이터로 자동 업데이트됩니다.</p>
                </div>
                
                <div style="text-align: center; margin-top: 2rem;">
                    <button class="btn btn-primary" onclick="closeCollectionModal()">
                        확인
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

// 수집 결과 모달 닫기 및 데이터 새로고침
async function closeCollectionModal() {
    // 모달 제거
    const modal = document.querySelector('div[style*="rgba(0,0,0,0.5)"]');
    if (modal) modal.remove();

    // 버튼 복원
    const btn = document.getElementById('btn-collect-today');
    if (btn) {
        btn.disabled = false;
        btn.innerHTML = '📅 현재기준 데이터수집';
    }

    // 데이터 새로고침
    await loadExistingData();
    updateStatistics();
    renderChart();
    renderTable();
}

// 전역 함수로 노출
window.collectTodayData = collectTodayData;
window.closeCollectionModal = closeCollectionModal;
