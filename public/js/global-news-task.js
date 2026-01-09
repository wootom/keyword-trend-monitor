/**
 * 글로벌 뉴스 모니터링 - Task 대시보드
 * Toss 스타일 UI 버전
 */

// ==================== 설정 ====================
const CONFIG = {
    password: 'ixioglobal2026',
    sessionKey: 'globalNewsAuth',
    functionsUrl: 'https://asia-northeast3-keyword-trend-monitor.cloudfunctions.net',
    timezones: {
        en: { tz: 'America/New_York', name: 'EST' },
        ms: { tz: 'Asia/Kuala_Lumpur', name: 'MYT' },
        id: { tz: 'Asia/Jakarta', name: 'WIB' },
        'pt-BR': { tz: 'America/Sao_Paulo', name: 'BRT' },
        ja: { tz: 'Asia/Tokyo', name: 'JST' },
        ar: { tz: 'Asia/Riyadh', name: 'AST' }
    },
    languages: {
        en: '🇺🇸 English',
        ms: '🇲🇾 Malay',
        id: '🇮🇩 Indonesian',
        'pt-BR': '🇧🇷 Portuguese',
        ja: '🇯🇵 Japanese',
        ar: '🇸🇦 Arabic'
    }
};

// ==================== 상태 ====================
let state = {
    taskId: null,
    taskData: null,
    dailyData: {},
    trendChart: null
};

// ==================== 유틸리티 ====================
const utils = {
    formatDateKey(date) {
        const d = new Date(date);
        const kst = new Date(d.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        return `${kst.getFullYear()}-${String(kst.getMonth() + 1).padStart(2, '0')}-${String(kst.getDate()).padStart(2, '0')}`;
    },

    formatDateDisplay(dateKey) {
        const [, month, day] = dateKey.split('-');
        const date = new Date(dateKey + 'T00:00:00+09:00');
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        return `${month}.${day}(${days[date.getDay()]})`;
    },

    formatTime(date) {
        if (!date) return '';
        const d = new Date(date);
        return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
    },

    isWeekend(dateKey) {
        const date = new Date(dateKey + 'T00:00:00+09:00');
        const day = date.getDay();
        return day === 0 || day === 6;
    },

    showError(message) {
        console.error(message);
        // 토스트 알림 대신 간단한 alert 사용
        alert(message);
    },

    showSuccess(message) {
        alert(message);
    }
};

// ==================== 초기화 ====================
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    state.taskId = urlParams.get('task');

    if (!state.taskId) {
        utils.showError('Task ID가 없습니다.');
        window.location.href = 'global-news.html';
        return;
    }

    // 세션 체크
    if (sessionStorage.getItem(CONFIG.sessionKey) === 'authenticated') {
        showMainContent();
    }

    // 인증 폼
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', handleAuth);
    }
});

function handleAuth(e) {
    e.preventDefault();
    const password = document.getElementById('password').value;

    if (password === CONFIG.password) {
        sessionStorage.setItem(CONFIG.sessionKey, 'authenticated');
        showMainContent();
    } else {
        document.getElementById('auth-error').classList.remove('hidden');
    }
}

function showMainContent() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-content').classList.remove('hidden');
    loadTaskInfo();
    loadTaskData();
}

// ==================== Task 정보 로드 ====================
async function loadTaskInfo() {
    try {
        const doc = await db.collection('globalTasks').doc(state.taskId).get();

        if (!doc.exists) {
            utils.showError('Task를 찾을 수 없습니다.');
            window.location.href = 'global-news.html';
            return;
        }

        state.taskData = doc.data();
        const data = state.taskData;

        // 페이지 제목
        document.getElementById('page-title').textContent = `${data.name || 'Task'} 대시보드`;
        document.title = `${data.name || 'Task'} - 글로벌 뉴스`;

        // 언어
        const languages = Array.isArray(data.languages) ? data.languages : [data.language || 'en'];
        const langDisplay = languages.map(l => CONFIG.languages[l] || l).join(', ');

        // Task 정보 렌더링
        const keywords = (data.keywords || []).join(', ');
        const filters = (data.filterKeywords || []).join(', ') || '없음';
        const excludes = (data.excludeKeywords || []).join(', ') || '없음';
        const statusBadge = data.isActive
            ? '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">활성</span>'
            : '<span class="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">비활성</span>';

        document.getElementById('task-info-body').innerHTML = `
            <div class="bg-gray-50 rounded-xl p-4">
                <p class="text-xs text-gray-500 mb-1">이름</p>
                <p class="font-semibold text-gray-900">${data.name || '-'}</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-4">
                <p class="text-xs text-gray-500 mb-1">상태</p>
                <p>${statusBadge}</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-4">
                <p class="text-xs text-gray-500 mb-1">언어</p>
                <p class="font-medium text-gray-900">${langDisplay}</p>
            </div>
            <div class="bg-gray-50 rounded-xl p-4">
                <p class="text-xs text-gray-500 mb-1">키워드</p>
                <p class="font-semibold text-blue-600">${keywords || '-'}</p>
            </div>
        `;

    } catch (error) {
        console.error('Task 정보 로드 오류:', error);
        document.getElementById('task-info-body').innerHTML = `
            <div class="col-span-4 text-center py-8 text-red-500">
                Task 정보를 불러올 수 없습니다.
            </div>
        `;
    }
}

// ==================== 데이터 로드 ====================
async function loadTaskData() {
    try {
        // 30일 전부터 조회
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const snapshot = await db.collection('globalNewsData')
            .where('taskId', '==', state.taskId)
            .where('date', '>=', firebase.firestore.Timestamp.fromDate(thirtyDaysAgo))
            .orderBy('date', 'asc')
            .get();

        state.dailyData = {};

        snapshot.forEach(doc => {
            const data = doc.data();
            state.dailyData[data.dateKey] = {
                date: data.date.toDate(),
                count: data.count || 0,
                articles: data.articles || [],
                language: data.language
            };
        });

        // 누락 날짜 채우기
        fillMissingDates();

        // UI 업데이트
        updateStatistics();
        renderChart();
        renderTable();

    } catch (error) {
        console.error('데이터 로드 오류:', error);
        document.getElementById('data-table-body').innerHTML = `
            <tr>
                <td colspan="4" class="px-6 py-8 text-center text-red-500">
                    데이터 로드 중 오류가 발생했습니다.
                </td>
            </tr>
        `;
    }
}

function fillMissingDates() {
    const today = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30);

    for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
        const key = utils.formatDateKey(d);
        if (!state.dailyData[key]) {
            state.dailyData[key] = { date: new Date(d), count: 0, articles: [] };
        }
    }
}

// ==================== 통계 업데이트 ====================
function updateStatistics() {
    const data = state.dailyData;
    const dates = Object.keys(data).sort();

    if (dates.length === 0) return;

    const counts = dates.map(d => data[d].count);
    const total = counts.reduce((a, b) => a + b, 0);
    const avg = (total / counts.length).toFixed(1);
    const max = Math.max(...counts);
    const maxDate = dates[counts.indexOf(max)];
    const todayKey = utils.formatDateKey(new Date());
    const todayCount = data[todayKey]?.count || 0;

    // 애니메이션 효과로 숫자 업데이트
    document.getElementById('total-mentions').textContent = total.toLocaleString();
    document.getElementById('date-range').textContent = `${utils.formatDateDisplay(dates[0])} ~ ${utils.formatDateDisplay(dates[dates.length - 1])}`;
    document.getElementById('today-mentions').textContent = todayCount.toLocaleString();
    document.getElementById('today-date').textContent = utils.formatDateDisplay(todayKey);
    document.getElementById('avg-mentions').textContent = avg;
    document.getElementById('peak-mentions').textContent = max.toLocaleString();
    document.getElementById('peak-date').textContent = utils.formatDateDisplay(maxDate);
}

// ==================== 차트 렌더링 ====================
function renderChart() {
    const ctx = document.getElementById('trend-chart');
    if (!ctx) return;

    const dates = Object.keys(state.dailyData).sort();
    const counts = dates.map(d => state.dailyData[d].count);
    const labels = dates.map(d => utils.formatDateDisplay(d));

    if (state.trendChart) {
        state.trendChart.destroy();
    }

    state.trendChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: '언급량',
                data: counts,
                borderColor: '#3182f6',
                backgroundColor: 'rgba(49, 130, 246, 0.1)',
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 6,
                pointBackgroundColor: '#3182f6',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1f2937',
                    titleFont: { size: 13 },
                    bodyFont: { size: 12 },
                    padding: 12,
                    cornerRadius: 8
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: '#8b95a1', font: { size: 11 } }
                },
                y: {
                    beginAtZero: true,
                    grid: { color: '#f3f4f6' },
                    ticks: { color: '#8b95a1', font: { size: 11 } }
                }
            },
            interaction: { intersect: false, mode: 'index' }
        }
    });
}

// ==================== 테이블 렌더링 ====================
function renderTable() {
    const tbody = document.getElementById('data-table-body');
    if (!tbody) return;

    const dates = Object.keys(state.dailyData).sort().reverse();

    if (dates.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="4" class="px-6 py-8 text-center text-toss-lightGray">
                    데이터가 없습니다.
                </td>
            </tr>
        `;
        return;
    }

    const langInfo = CONFIG.timezones[state.taskData?.language] || { tz: 'UTC', name: 'UTC' };

    tbody.innerHTML = dates.map((dateKey, index) => {
        const data = state.dailyData[dateKey];
        const articles = data.articles || [];

        // 전일 대비
        let change = '-';
        if (index < dates.length - 1) {
            const prev = state.dailyData[dates[index + 1]]?.count || 0;
            const diff = data.count - prev;
            if (diff > 0) {
                change = `<span class="text-green-600 font-medium">+${diff}</span>`;
            } else if (diff < 0) {
                change = `<span class="text-red-500 font-medium">${diff}</span>`;
            }
        }

        // 기사 목록 (최대 5개)
        const articlesHtml = articles.slice(0, 5).map(art => {
            const title = art.translatedTitle || art.title || '제목 없음';
            const time = art.koreaTime ? utils.formatTime(new Date(art.koreaTime)) : '';
            return `
                <a href="${art.link}" target="_blank" 
                   class="block text-sm text-gray-700 hover:text-blue-600 hover:underline truncate mb-1" 
                   title="${title}">
                    ${title}
                    ${time ? `<span class="text-xs text-gray-400 ml-1">${time}</span>` : ''}
                </a>
            `;
        }).join('');

        const moreCount = articles.length > 5 ? `<span class="text-xs text-gray-400">+${articles.length - 5} more</span>` : '';

        const isWeekend = utils.isWeekend(dateKey);
        const dateClass = isWeekend ? 'text-red-500' : 'text-gray-900';

        return `
            <tr class="hover:bg-gray-50 transition-colors border-b border-gray-200">
                <td class="px-6 py-4 whitespace-nowrap border-r border-gray-100">
                    <span class="font-semibold ${dateClass}">${utils.formatDateDisplay(dateKey)}</span>
                </td>
                <td class="px-6 py-4 max-w-md border-r border-gray-100">
                    ${articlesHtml || '<span class="text-gray-400">-</span>'}
                    ${moreCount}
                </td>
                <td class="px-6 py-4 text-center border-r border-gray-100">
                    <span class="inline-flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 text-blue-700 font-bold">
                        ${data.count}
                    </span>
                </td>
                <td class="px-6 py-4 text-center">${change}</td>
            </tr>
        `;
    }).join('');
}

// ==================== 액션 함수들 ====================
async function collectNow() {
    if (!confirm('현재 시점 기준으로 데이터를 수집하시겠습니까?')) return;

    try {
        const response = await fetch(`${CONFIG.functionsUrl}/collectGlobalNews?taskId=${state.taskId}`);
        const result = await response.json();

        if (result.success) {
            utils.showSuccess(`수집 완료!\n기존: ${result.existing}건\n신규: ${result.new}건\n최종: ${result.total}건`);
            loadTaskData();
        } else {
            throw new Error(result.error || '수집 실패');
        }
    } catch (error) {
        utils.showError('수집 중 오류: ' + error.message);
    }
}

async function backfill30Days() {
    if (!confirm('최근 30일간의 데이터를 백필하시겠습니까?\n시간이 수 분 정도 소요될 수 있습니다.')) return;

    try {
        const response = await fetch(`${CONFIG.functionsUrl}/backfillGlobalNews?taskId=${state.taskId}`);
        const result = await response.json();

        if (result.success) {
            utils.showSuccess(`백필 완료!\n처리된 날짜: ${result.daysProcessed}일\n총 기사: ${result.totalArticles}건`);
            loadTaskData();
        } else {
            throw new Error(result.error || '백필 실패');
        }
    } catch (error) {
        utils.showError('백필 중 오류: ' + error.message);
    }
}

async function translateGemini() {
    const btn = event?.target;
    if (btn) {
        btn.disabled = true;
        btn.textContent = '⏳ 번역 중...';
    }

    let totalTranslated = 0;
    let batchCount = 0;
    let errorCount = 0;

    try {
        while (true) {
            batchCount++;
            if (btn) btn.textContent = `⏳ 번역 중... (${batchCount})`;

            try {
                const response = await fetch(`${CONFIG.functionsUrl}/translateGlobalNews`);

                if (!response.ok) {
                    if (errorCount++ < 3) {
                        await new Promise(r => setTimeout(r, 2000));
                        continue;
                    }
                    break;
                }

                const result = await response.json();

                if (result.success) {
                    errorCount = 0;
                    totalTranslated += result.count || 0;

                    if (result.count === 0 && !result.hasMore) break;
                } else {
                    if (errorCount++ < 3) {
                        await new Promise(r => setTimeout(r, 2000));
                        continue;
                    }
                    break;
                }

            } catch (err) {
                if (errorCount++ < 3) {
                    await new Promise(r => setTimeout(r, 2000));
                    continue;
                }
                break;
            }

            await new Promise(r => setTimeout(r, 500));
        }

        utils.showSuccess(`번역 완료!\n번역된 기사: ${totalTranslated}건`);
        loadTaskData();

    } catch (error) {
        utils.showError('번역 중 오류: ' + error.message);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = '🌐 번역';
        }
    }
}
