// 알림 및 고급 기능 모듈
import { db } from './firebase-config.js';
import { collection, query, orderBy, limit, onSnapshot, where } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

/**
 * 실시간 알림 표시
 */
export function initializeAlerts() {
    const alertsContainer = document.getElementById('alerts-container');
    if (!alertsContainer) return;

    // Firestore alerts 컬렉션에서 실시간으로 데이터 가져오기
    const alertsQuery = query(
        collection(db, 'alerts'),
        orderBy('timestamp', 'desc'),
        limit(5)
    );

    onSnapshot(alertsQuery, (snapshot) => {
        if (snapshot.empty) {
            alertsContainer.innerHTML = '<p class="text-muted">알림이 없습니다.</p>';
            return;
        }

        const alerts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        renderAlerts(alerts);
    });
}

/**
 * 알림 렌더링
 */
function renderAlerts(alerts) {
    const alertsContainer = document.getElementById('alerts-container');
    const alertsSection = document.getElementById('alerts-section');

    if (alertsSection) {
        alertsSection.style.display = 'block';
    }

    alertsContainer.innerHTML = alerts.map(alert => {
        // 기사 링크 HTML 생성
        let articlesHTML = '';

        if (alert.articles && alert.articles.length > 0) {
            // 최신 기사 분리
            const recentArticles = alert.articles.filter(a => a.type === 'recent');
            const randomArticles = alert.articles.filter(a => a.type === 'random');

            articlesHTML = `
                <div style="margin-top: var(--spacing-md); padding-top: var(--spacing-md); border-top: 1px solid var(--gray-300);">
                    ${recentArticles.length > 0 ? `
                        <h5 style="font-size: var(--font-size-sm); margin-bottom: var(--spacing-xs); color: var(--text-primary);">
                            📰 최신 기사 (${recentArticles.length}개)
                        </h5>
                        <ul style="margin: 0 0 var(--spacing-sm) 0; padding-left: var(--spacing-lg); font-size: var(--font-size-xs);">
                            ${recentArticles.map(article => `
                                <li style="margin-bottom: var(--spacing-xs);">
                                    <a href="${article.link}" target="_blank" rel="noopener noreferrer" 
                                       style="color: var(--primary-blue); text-decoration: none;">
                                        ${article.title}
                                    </a>
                                    <span style="color: var(--text-disabled); font-size: 10px; margin-left: 4px;">
                                        (${article.source})
                                    </span>
                                </li>
                            `).join('')}
                        </ul>
                    ` : ''}
                    
                    ${randomArticles.length > 0 ? `
                        <h5 style="font-size: var(--font-size-sm); margin-bottom: var(--spacing-xs); color: var(  --text-primary);">
                            🎲 랜덤 샘플 (${randomArticles.length}개)
                        </h5>
                        <ul style="margin: 0; padding-left: var(--spacing-lg); font-size: var(--font-size-xs);">
                            ${randomArticles.map(article => `
                                <li style="margin-bottom: var(--spacing-xs);">
                                    <a href="${article.link}" target="_blank" rel="noopener noreferrer" 
                                       style="color: var(--primary-blue); text-decoration: none;">
                                        ${article.title}
                                    </a>
                                    <span style="color: var(--text-disabled); font-size: 10px; margin-left: 4px;">
                                        (${article.source})
                                    </span>
                                </li>
                            `).join('')}
                        </ul>
                    ` : ''}
                </div>
            `;
        }

        return `
            <div class="alert-card ${alert.read ? 'read' : 'unread'}">
                <div class="alert-icon">🔔</div>
                <div class="alert-content">
                    <h4 class="alert-title">키워드 "${alert.keyword}" 급증 감지!</h4>
                    <p class="alert-message">
                        현재 언급량: <strong>${alert.currentCount}건</strong> 
                        (평균 대비 <strong class="text-danger">+${alert.increaseRate}%</strong>)
                    </p>
                    <p class="alert-time">${formatTime(alert.timestamp)}</p>
                    ${articlesHTML}
                </div>
            </div>
        `;
    }).join('');
}

/**
 * 시간 포맷팅
 */
function formatTime(timestamp) {
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diff = Math.floor((now - date) / 1000); // 초 단위

    if (diff < 60) return '방금 전';
    if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
    return `${Math.floor(diff / 86400)}일 전`;
}

/**
 * 통계 데이터 가져오기 및 표시
 */
export async function loadStatistics(days = 7) {
    try {
        const response = await fetch(
            `https://asia-northeast3-keyword-trend-monitor.cloudfunctions.net/getStatistics?days=${days}`
        );
        const data = await response.json();

        if (data.success) {
            renderStatistics(data.statistics);
        }
    } catch (error) {
        console.error('통계 로드 오류:', error);
    }
}

/**
 * 통계 렌더링
 */
function renderStatistics(statistics) {
    const statsContainer = document.getElementById('statistics-container');
    if (!statsContainer) return;

    statsContainer.innerHTML = statistics.map(stat => `
        <div class="stat-card-advanced">
            <h3>${stat.keyword}</h3>
            <div class="stat-row">
                <span class="stat-label">총 언급량:</span>
                <span class="stat-value">${stat.totalCount}건</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">긍정:</span>
                <span class="stat-value text-success">${stat.sentiments.positive}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">부정:</span>
                <span class="stat-value text-danger">${stat.sentiments.negative}</span>
            </div>
            <div class="stat-row">
                <span class="stat-label">중립:</span>
                <span class="stat-value">${stat.sentiments.neutral}</span>
            </div>
        </div>
    `).join('');
}

/**
 * Excel 다운로드 기능
 */
export async function downloadExcelReport() {
    try {
        // Firestore에서 최근 30일 데이터 가져오기
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const dataQuery = query(
            collection(db, 'data'),
            where('date', '>', thirtyDaysAgo),
            orderBy('date', 'desc')
        );

        return new Promise((resolve, reject) => {
            onSnapshot(dataQuery, (snapshot) => {
                const data = snapshot.docs.map(doc => doc.data());
                const csv = convertToCSV(data);
                downloadCSV(csv, 'keyword-trend-report.csv');
                resolve();
            }, reject);
        });
    } catch (error) {
        console.error('Excel 다운로드 오류:', error);
        alert('데이터 다운로드에 실패했습니다.');
    }
}

/**
 * CSV 변환
 */
function convertToCSV(data) {
    if (data.length === 0) return '';

    const headers = ['날짜', '키워드', '소스', '언급량', '감정'];
    const rows = data.map(item => [
        item.date.toDate().toLocaleString('ko-KR'),
        item.keyword,
        item.source,
        item.count,
        item.sentiment
    ]);

    const csvContent = [
        headers.join(','),
        ...rows.map(row => row.join(','))
    ].join('\n');

    return '\uFEFF' + csvContent; // UTF-8 BOM 추가
}

/**
 * CSV 다운로드
 */
function downloadCSV(csv, filename) {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}
