/**
 * 글로벌 뉴스 모니터링 - Task 대시보드 페이지
 */

const CORRECT_PASSWORD = 'ixioglobal2026';
const SESSION_KEY = 'globalNewsAuth';
const FUNCTIONS_BASE_URL = 'https://asia-northeast3-keyword-trend-monitor.cloudfunctions.net';

// 언어별 시간대 설정
const LANGUAGE_TIMEZONES = {
    en: { tz: 'America/New_York', name: 'EST' },
    ms: { tz: 'Asia/Kuala_Lumpur', name: 'MYT' },
    id: { tz: 'Asia/Jakarta', name: 'WIB' },
    'pt-BR': { tz: 'America/Sao_Paulo', name: 'BRT' },
    ja: { tz: 'Asia/Tokyo', name: 'JST' },
    ar: { tz: 'Asia/Riyadh', name: 'AST' }
};

let taskId = null;
let taskData = null;
let dailyData = {};
let trendChart = null;

// ==================== 초기화 ====================
document.addEventListener('DOMContentLoaded', () => {
    // URL에서 taskId 추출
    const urlParams = new URLSearchParams(window.location.search);
    taskId = urlParams.get('task');

    if (!taskId) {
        alert('Task ID가 없습니다.');
        window.location.href = 'global-news.html';
        return;
    }

    // 세션 체크
    if (sessionStorage.getItem(SESSION_KEY) === 'authenticated') {
        showMainContent();
    }

    // 인증 폼 이벤트
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', handleAuth);
    }
});

function handleAuth(event) {
    event.preventDefault();
    const password = document.getElementById('password').value;

    if (password === CORRECT_PASSWORD) {
        sessionStorage.setItem(SESSION_KEY, 'authenticated');
        showMainContent();
    } else {
        document.getElementById('auth-error').style.display = 'block';
    }
}

function showMainContent() {
    document.getElementById('auth-screen').style.display = 'none';
    document.getElementById('main-content').style.display = 'block';
    loadTaskInfo();
    loadTaskData();
}

// ==================== Task 정보 로드 ====================
async function loadTaskInfo() {
    try {
        const doc = await db.collection('globalTasks').doc(taskId).get();
        if (!doc.exists) {
            alert('Task를 찾을 수 없습니다.');
            window.location.href = 'global-news.html';
            return;
        }

        taskData = doc.data();

        // 페이지 제목 업데이트
        document.getElementById('page-title').textContent = `${taskData.name || 'Task'} 대시보드`;
        document.title = `${taskData.name || 'Task'} - 글로벌 뉴스 모니터링`;

        // 다중 언어 지원
        const languages = Array.isArray(taskData.languages) ? taskData.languages : (taskData.language ? [taskData.language] : ['en']);
        const langDisplayArr = languages.map(lang => getLanguageDisplay(lang));
        const langDisplay = langDisplayArr.join(', ');

        // 첫 번째 언어의 시간대
        const firstLang = languages[0] || 'en';
        const langInfo = LANGUAGE_TIMEZONES[firstLang] || { tz: 'UTC', name: 'UTC' };

        const keywords = (taskData.keywords || []).join(', ');
        const filters = (taskData.filterKeywords || []).join(', ');
        const excludes = (taskData.excludeKeywords || []).join(', ');
        const status = taskData.isActive ?
            '<span style="color: var(--accent-green);">[활성]</span>' :
            '<span style="color: var(--text-secondary);">[비활성]</span>';

        document.getElementById('task-info-body').innerHTML = `
            <tr>
                <td><strong>이름</strong></td>
                <td>${taskData.name || '-'}</td>
                <td><strong>상태</strong></td>
                <td>${status}</td>
            </tr>
            <tr>
                <td><strong>언어</strong></td>
                <td colspan="3">${langDisplay}</td>
            </tr>
            <tr>
                <td><strong>키워드</strong></td>
                <td colspan="3" style="color: var(--primary-color); font-weight: 500;">${keywords || '-'}</td>
            </tr>
            <tr>
                <td><strong>필터 (포함)</strong></td>
                <td colspan="3" style="color: var(--accent-green);">${filters || '없음 (모든 기사)'}</td>
            </tr>
            <tr>
                <td><strong>필터 (제외)</strong></td>
                <td colspan="3" style="color: var(--accent-orange);">${excludes || '없음'}</td>
            </tr>
        `;

    } catch (error) {
        console.error('Task 정보 로드 오류:', error);
    }
}

function getLanguageDisplay(langCode) {
    const langs = {
        en: '🇺🇸 English',
        ms: '🇲🇾 Malay',
        id: '🇮🇩 Indonesian',
        'pt-BR': '🇧🇷 Portuguese (Brazil)',
        ja: '🇯🇵 Japanese',
        ar: '🇸🇦 Arabic'
    };
    return langs[langCode] || langCode;
}

// ==================== 데이터 로드 ====================
async function loadTaskData() {
    const btn = document.getElementById('refresh-btn');
    const icon = document.getElementById('refresh-icon');

    if (btn) btn.disabled = true;
    if (icon) icon.innerHTML = '<span class="loading"></span> 로딩 중...';

    try {
        // 30일 전부터의 데이터 조회
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const snapshot = await db.collection('globalNewsData')
            .where('taskId', '==', taskId)
            .where('date', '>=', firebase.firestore.Timestamp.fromDate(thirtyDaysAgo))
            .orderBy('date', 'asc')
            .get();

        dailyData = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            const dateKey = data.dateKey;

            dailyData[dateKey] = {
                date: data.date.toDate(),
                count: data.count || 0,
                articles: data.articles || [],
                language: data.language
            };
        });

        // 누락 날짜 채우기
        fillMissingDates();

        // 시각화 업데이트
        updateStatistics();
        renderChart();
        renderTable();

    } catch (error) {
        console.error('데이터 로드 오류:', error);
        alert('데이터 로드 중 오류가 발생했습니다.');
    } finally {
        if (btn) btn.disabled = false;
        if (icon) icon.textContent = '새로고침';
    }
}

function fillMissingDates() {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
        const dateKey = formatDateKey(d);
        if (!dailyData[dateKey]) {
            dailyData[dateKey] = {
                date: new Date(d),
                count: 0,
                articles: [],
                language: taskData?.language || 'en'
            };
        }
    }
}

// ==================== 통계 업데이트 ====================
function updateStatistics() {
    const dates = Object.keys(dailyData).sort();

    if (dates.length === 0) return;

    // 총 언급량
    const totalMentions = Object.values(dailyData).reduce((sum, day) => sum + day.count, 0);
    document.getElementById('total-mentions').textContent = totalMentions.toLocaleString();

    // 날짜 범위
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];
    document.getElementById('date-range').textContent = `${formatDateDisplay(firstDate)} ~ ${formatDateDisplay(lastDate)}`;

    // 오늘 언급량
    const today = formatDateKey(new Date());
    const todayData = dailyData[today];
    document.getElementById('today-mentions').textContent = todayData ? todayData.count.toLocaleString() : '0';
    document.getElementById('today-date').textContent = formatDateDisplay(today);

    // 일평균
    const daysWithData = dates.filter(d => dailyData[d].count > 0).length;
    const avgMentions = daysWithData > 0 ? Math.round(totalMentions / daysWithData) : 0;
    document.getElementById('avg-mentions').textContent = avgMentions.toLocaleString();

    // 최고 언급량
    const sortedByTotal = dates.sort((a, b) => dailyData[b].count - dailyData[a].count);
    const peakDate = sortedByTotal[0];
    if (peakDate && dailyData[peakDate].count > 0) {
        document.getElementById('peak-mentions').textContent = dailyData[peakDate].count.toLocaleString();
        document.getElementById('peak-date').textContent = formatDateDisplay(peakDate);
    } else {
        document.getElementById('peak-mentions').textContent = '0';
        document.getElementById('peak-date').textContent = '-';
    }
}

// ==================== 차트 렌더링 ====================
function renderChart() {
    const ctx = document.getElementById('trend-chart');
    const chartWrapper = document.getElementById('chart-wrapper');
    const scrollContainer = document.getElementById('chart-scroll-container');

    if (trendChart) {
        trendChart.destroy();
    }

    const dates = Object.keys(dailyData).sort();
    const labels = dates.map(d => d.substring(5)); // MM-DD
    const counts = dates.map(d => dailyData[d].count);

    // 차트 너비 설정
    const minDays = 30;
    const pixelsPerDay = 35;
    const containerWidth = scrollContainer ? scrollContainer.clientWidth : 800;
    const calculatedWidth = Math.max(containerWidth, dates.length * pixelsPerDay);

    if (chartWrapper && dates.length > minDays) {
        chartWrapper.style.width = calculatedWidth + 'px';
    } else if (chartWrapper) {
        chartWrapper.style.width = '100%';
    }

    // 주말 색상
    const labelColors = dates.map(d => isWeekend(d) ? '#ea4335' : '#666');

    // 차트 제목에 키워드 표시
    const keywordsDisplay = (taskData?.keywords || []).slice(0, 3).join(', ');
    const moreKeywords = (taskData?.keywords || []).length > 3 ? ` +${taskData.keywords.length - 3}` : '';
    const chartTitle = `키워드: ${keywordsDisplay}${moreKeywords}`;

    trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: '언급량',
                data: counts,
                borderColor: '#1A73E8',
                backgroundColor: 'rgba(26, 115, 232, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: chartTitle,
                    font: { size: 14 },
                    color: '#666'
                },
                legend: { display: true, position: 'top' },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        afterBody: function (context) {
                            const index = context[0].dataIndex;
                            const dateKey = dates[index];
                            const articles = dailyData[dateKey]?.articles || [];
                            if (articles.length > 0) {
                                const sample = articles.slice(0, 3).map(a => (a.translatedTitle || a.title || '').substring(0, 30) + '...');
                                return ['', '샘플 기사:', ...sample];
                            }
                            return [];
                        }
                    }
                }
            },
            scales: {
                x: { ticks: { color: labelColors } },
                y: {
                    beginAtZero: true,
                    ticks: { stepSize: 5 }
                }
            },
            layout: { padding: { top: 30 } }
        }
    });

    // 스크롤 최신으로
    if (scrollContainer && dates.length > minDays) {
        setTimeout(() => {
            scrollContainer.scrollLeft = scrollContainer.scrollWidth;
        }, 100);
    }
}

function isWeekend(dateStr) {
    const date = new Date(dateStr + 'T00:00:00+09:00');
    const day = date.getDay();
    return day === 0 || day === 6;
}

// ==================== 테이블 렌더링 ====================
function renderTable() {
    const tbody = document.getElementById('data-table-body');
    tbody.innerHTML = '';

    const dates = Object.keys(dailyData).sort().reverse();

    if (dates.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">데이터가 없습니다.</td></tr>';
        return;
    }

    const langInfo = LANGUAGE_TIMEZONES[taskData?.language] || { tz: 'UTC', name: 'UTC' };

    dates.forEach((dateKey, index) => {
        const data = dailyData[dateKey];
        const row = document.createElement('tr');

        // 전일 대비 계산
        let change = '-';
        if (index < dates.length - 1) {
            const prevDateKey = dates[index + 1];
            const prevCount = dailyData[prevDateKey].count;
            const diff = data.count - prevCount;

            if (diff > 0) {
                change = `<span style="color: var(--accent-green);">+${diff}</span>`;
            } else if (diff < 0) {
                change = `<span style="color: var(--accent-red);">-${Math.abs(diff)}</span>`;
            } else {
                change = '<span style="color: var(--text-secondary);">-</span>';
            }
        }

        // 기사 링크
        const articles = data.articles || [];
        let articlesHTML = '';
        if (articles.length > 0) {
            articlesHTML = articles.slice(0, 20).map((art, idx) =>
                `<a href="${art.link}" target="_blank" title="${(art.translatedTitle || art.title || '').replace(/"/g, '&quot;')}" class="article-num-link">${idx + 1}</a>`
            ).join(' ');
            if (articles.length > 20) {
                articlesHTML += ` <span class="text-muted">+${articles.length - 20}</span>`;
            }
        } else {
            articlesHTML = '<span class="text-muted">-</span>';
        }

        // 샘플
        let sampleHTML = '<span class="text-muted">-</span>';
        if (articles.length > 0) {
            const shuffled = [...articles].sort(() => 0.5 - Math.random());
            const samples = shuffled.slice(0, 2);
            sampleHTML = samples.map(art => {
                const displayTitle = art.translatedTitle || art.title || '제목 없음';
                const originalTitle = art.title || '';
                const tooltipText = art.translatedTitle ? `원문: ${originalTitle}` : displayTitle;

                const truncated = displayTitle.length > 35 ? displayTitle.substring(0, 35) + '...' : displayTitle;

                const kstTime = art.koreaTime ? formatTime(new Date(art.koreaTime)) : '';
                const localTime = art.localTime ? formatTime(new Date(art.localTime)) : '';
                const timeDisplay = kstTime ? `<span class="text-muted" style="font-size: 0.8em;">${kstTime} (${langInfo.name})</span>` : '';

                const titleStyle = art.translatedTitle ? 'color: #2d3436; font-weight: 500;' : '';

                return `<div style="margin-bottom: 0.25rem; font-size: 0.9em;" title="${tooltipText.replace(/"/g, '&quot;')}">
                    <span style="${titleStyle}">${truncated}</span>
                    ${timeDisplay}
                </div>`;
            }).join('');
        }

        // 주말 스타일
        const isHoliday = isWeekend(dateKey);
        const dateStyle = isHoliday ? 'color: #ea4335;' : '';

        row.innerHTML = `
            <td><strong style="${dateStyle}">${formatDateDisplay(dateKey)}</strong></td>
            <td style="max-width: 300px; font-size: 0.85em; color: var(--text-secondary);">${sampleHTML}</td>
            <td><strong>${data.count}</strong></td>
            <td>${change}</td>
            <td class="article-links">${articlesHTML}</td>
        `;

        tbody.appendChild(row);
    });
}

// ==================== 수집 기능 ====================
async function collectNow() {
    if (!confirm('현재 시점 기준으로 데이터를 수집하시겠습니까?')) return;

    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '⏳ 수집 중...';

    try {
        const response = await fetch(`${FUNCTIONS_BASE_URL}/collectGlobalNews?taskId=${taskId}`);
        const result = await response.json();

        if (result.success) {
            alert(`수집 완료!\n기존: ${result.existing}건\n신규: ${result.new}건\n필터링: ${result.filtered}건\n최종: ${result.total}건`);
            loadTaskData();
        } else {
            alert('수집 실패: ' + result.error);
        }
    } catch (error) {
        console.error('수집 오류:', error);
        alert('수집 중 오류가 발생했습니다: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '수집 실행';
    }
}

async function backfill30Days() {
    if (!confirm('30일 과거 데이터를 백필하시겠습니까?\n\n이 작업은 약 10~20초가 소요됩니다.\n서버에서 한 번에 30일치를 처리합니다.')) return;

    const btn = event.target;
    btn.disabled = true;
    btn.textContent = '⏳ 백필 중...';

    try {
        // 벌크 백필: 한 번의 요청으로 30일치 처리
        const response = await fetch(`${FUNCTIONS_BASE_URL}/backfillGlobalNews?taskId=${taskId}`);

        if (response.ok) {
            const result = await response.json();
            alert(`백필 완료!\n- 총 수집: ${result.totalArticles || 0}건\n- 처리 기간: ${result.days || 30}일`);
        } else {
            const errorText = await response.text();
            console.error('백필 실패:', errorText);
            alert('백필 중 오류가 발생했습니다: ' + errorText);
        }

        loadTaskData();

    } catch (error) {
        console.error('백필 전체 오류:', error);
        alert('백필 프로세스 중 오류가 발생했습니다: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = '30일 백필';
    }
}

async function translateGemini() {
    if (!confirm('수집된 기사 제목을 한국어로 일괄 번역하시겠습니까?\n\n- 최근 30일치 데이터를 순차적으로 스캔합니다.\n- 창을 닫지 말고 기다려주세요.')) return;

    const btn = event.target;
    btn.disabled = true;

    let totalTranslated = 0;
    let daysChecked = 0;

    try {
        const today = new Date();
        const days = 30;

        for (let i = 0; i < days; i++) {
            // UI 업데이트
            btn.textContent = `⏳ 번역 스캔 중... (${i + 1}/${days})`;

            const targetDate = new Date(today);
            targetDate.setDate(today.getDate() - i); // 오늘부터 과거로
            const dateStr = formatDateKey(targetDate);

            try {
                const response = await fetch(`${FUNCTIONS_BASE_URL}/translateGlobalNews?targetDate=${dateStr}`);
                if (!response.ok) {
                    console.error(`번역 요청 실패 (${dateStr}):`, await response.text());
                    continue;
                }

                const result = await response.json();
                if (result.success && result.count > 0) {
                    totalTranslated += result.count;
                    daysChecked++;
                }
            } catch (err) {
                console.error(`번역 에러 (${dateStr}):`, err);
            }

            // 딜레이
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        alert(`번역 작업 완료!\n- 총 번역된 기사 수: ${totalTranslated}건`);
        loadTaskData();

    } catch (error) {
        console.error('번역 전체 오류:', error);
        alert('번역 중 오류가 발생했습니다: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Gemini 번역';
    }
}

// ==================== 유틸리티 ====================
function formatDateKey(date) {
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

function formatTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
}
