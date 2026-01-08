/**
 * 관리자 페이지 로직
 * - 키워드 관리
 * - 매체 관리
 * - 알림 설정
 */

// ==================== 크롤링 로그 관리 (유틸리티) ====================

// 로그 추가 함수
function addCrawlingLog(message, type = 'info') {
    const logsContainer = document.getElementById('crawling-logs');
    if (!logsContainer) return;

    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const timeStr = now.toLocaleTimeString('ko-KR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    const timestamp = `${month}/${day} ${timeStr}`;

    const colors = {
        'info': '#0f0',      // 초록
        'success': '#0ff',   // 청록
        'warning': '#ff0',   // 노랑
        'error': '#f00',     // 빨강
        'debug': '#888'      // 회색
    };

    const color = colors[type] || colors.info;

    const logEntry = document.createElement('div');
    logEntry.style.color = color;
    logEntry.textContent = `[${timestamp}] ${message}`;

    // 첫 번째 대기 메시지 제거
    const firstChild = logsContainer.firstElementChild;
    if (firstChild && firstChild.textContent.includes('대기')) {
        firstChild.remove();
    }

    logsContainer.appendChild(logEntry);

    // 자동 스크롤 (맨 아래로)
    logsContainer.scrollTop = logsContainer.scrollHeight;

    // 최대 100개 로그만 유지
    while (logsContainer.children.length > 100) {
        logsContainer.removeChild(logsContainer.firstChild);
    }
}

// 로그 지우기
function clearCrawlingLogs() {
    const logsContainer = document.getElementById('crawling-logs');
    if (logsContainer) {
        logsContainer.innerHTML = '<div style="color: #888;">[대기] 로그가 지워졌습니다.</div>';
    }
}

// 현재 시간 업데이트 (매초)
setInterval(() => {
    const currentTimeEl = document.getElementById('current-time');
    if (currentTimeEl) {
        const now = new Date();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const timeStr = now.toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        currentTimeEl.textContent = `(${month}/${day} ${timeStr})`;
    }
}, 1000);

// ==================== 초기화 ====================
document.addEventListener('DOMContentLoaded', () => {
    loadKeywords();
    loadAlertSettings();
    loadAccountSettings(); // 계정 정보 로드 추가
    loadCrawlingStatus(); // 크롤링 상태 로드 추가
    loadEmailRecipients(); // 이메일 수신자 로드
    loadWebhookRecipients(); // Webhook 수신자 로드
    loadDataStats(); // 데이터 통계 로드
    setupFormHandlers();
    setupNotificationHandlers(); // 알림 수신자 핸들러 추가
    setupAccountHandlers(); // 계정 폼 핸들러 추가
    setupCrawlingHandlers(); // 크롤링 제어 핸들러 추가
});

// ==================== 키워드 관리 ====================

// 키워드 목록 로드
async function loadKeywords() {
    try {
        const snapshot = await keywordsRef.orderBy('createdAt', 'desc').get();
        const tbody = document.getElementById('keywords-table-body');
        tbody.innerHTML = '';

        if (snapshot.empty) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center text-muted">등록된 키워드가 없습니다.</td></tr>';
            return;
        }

        snapshot.forEach(doc => {
            const keyword = doc.data();
            const row = document.createElement('tr');

            // 카테고리 이름 변환
            const categoryNames = {
                'product': '상품명',
                'company': '회사명',
                'trend': '트렌드명',
                'other': '기타'
            };

            row.innerHTML = `
        <td><strong>${keyword.name}</strong></td>
        <td><span class="badge badge-primary">${categoryNames[keyword.category] || '기타'}</span></td>
        <td>${keyword.description || '-'}</td>
        <td>${formatDate(keyword.createdAt)}</td>
        <td>
          <button class="btn btn-danger" onclick="deleteKeyword('${doc.id}', '${keyword.name}')">삭제</button>
        </td>
      `;

            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('키워드 로드 오류:', error);
        showAlert('키워드를 불러오는 중 오류가 발생했습니다.', 'danger');
    }
}

// 키워드 추가
async function addKeyword(event) {
    event.preventDefault();

    const name = document.getElementById('keyword-name').value.trim();
    const category = document.getElementById('keyword-category').value;
    const description = document.getElementById('keyword-description').value.trim();

    if (!name) {
        showAlert('키워드를 입력해주세요.', 'danger');
        return;
    }

    try {
        // 중복 확인
        const existing = await keywordsRef.where('name', '==', name).get();
        if (!existing.empty) {
            showAlert('이미 등록된 키워드입니다.', 'warning');
            return;
        }

        // 추가
        await keywordsRef.add({
            name: name,
            category: category,
            description: description,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            active: true
        });

        showAlert('키워드가 추가되었습니다.', 'success');
        document.getElementById('keyword-form').reset();
        loadKeywords();
    } catch (error) {
        console.error('키워드 추가 오류:', error);
        showAlert('키워드 추가 중 오류가 발생했습니다.', 'danger');
    }
}

// 키워드 삭제
async function deleteKeyword(id, name) {
    if (!confirm(`'${name}' 키워드를 삭제하시겠습니까?`)) {
        return;
    }

    try {
        await keywordsRef.doc(id).delete();
        showAlert('키워드가 삭제되었습니다.', 'success');
        loadKeywords();
    } catch (error) {
        console.error('키워드 삭제 오류:', error);
        showAlert('키워드 삭제 중 오류가 발생했습니다.', 'danger');
    }
}

// ==================== 매체 관리 ====================

// 매체 추가
async function addSource(event) {
    event.preventDefault();

    const name = document.getElementById('source-name').value.trim();
    const type = document.getElementById('source-type').value;
    const url = document.getElementById('source-url').value.trim();
    const notes = document.getElementById('source-notes').value.trim();

    if (!name || !type || !url) {
        showAlert('모든 필수 항목을 입력해주세요.', 'danger');
        return;
    }

    try {
        // 중복 확인
        const existing = await sourcesRef.where('url', '==', url).get();
        if (!existing.empty) {
            showAlert('이미 등록된 URL입니다.', 'warning');
            return;
        }

        // 추가
        await sourcesRef.add({
            name: name,
            type: type,
            url: url,
            notes: notes,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            active: true
        });

        showAlert('매체가 추가되었습니다.', 'success');
        document.getElementById('source-form').reset();

        // 페이지 새로고침 (실제로는 동적으로 테이블 업데이트)
        setTimeout(() => location.reload(), 1000);
    } catch (error) {
        console.error('매체 추가 오류:', error);
        showAlert('매체 추가 중 오류가 발생했습니다.', 'danger');
    }
}

// ==================== 알림 설정 ====================

// 알림 설정 로드
async function loadAlertSettings() {
    try {
        const doc = await settingsRef.doc('alerts').get();

        if (doc.exists) {
            const settings = doc.data();
            document.getElementById('alert-threshold').value = settings.threshold || 50;
            document.getElementById('alert-email').value = settings.email || '';
            document.getElementById('alert-webhook').value = settings.webhook || '';
            document.getElementById('alert-enabled').checked = settings.enabled !== false;
        }
    } catch (error) {
        console.error('알림 설정 로드 오류:', error);
    }
}

// 알림 설정 저장
async function saveAlertSettings(event) {
    event.preventDefault();

    const threshold = parseInt(document.getElementById('alert-threshold').value);
    const email = document.getElementById('alert-email').value.trim();
    const webhook = document.getElementById('alert-webhook').value.trim();
    const enabled = document.getElementById('alert-enabled').checked;

    if (threshold < 10 || threshold > 500) {
        showAlert('급증 기준은 10% ~ 500% 사이여야 합니다.', 'danger');
        return;
    }

    try {
        await settingsRef.doc('alerts').set({
            threshold: threshold,
            email: email,
            webhook: webhook,
            enabled: enabled,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        showAlert('알림 설정이 저장되었습니다.', 'success');
    } catch (error) {
        console.error('알림 설정 저장 오류:', error);
        showAlert('설정 저장 중 오류가 발생했습니다.', 'danger');
    }
}

// ==================== 폼 핸들러 설정 ====================
function setupFormHandlers() {
    document.getElementById('keyword-form').addEventListener('submit', addKeyword);
    document.getElementById('source-form').addEventListener('submit', addSource);
    document.getElementById('alert-settings-form').addEventListener('submit', saveAlertSettings);
}

// ==================== 유틸리티 함수 ====================

function formatDate(timestamp) {
    if (!timestamp) return '-';

    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

function showAlert(message, type = 'success') {
    const container = document.getElementById('alert-container');

    const alert = document.createElement('div');
    alert.className = `alert alert-${type}`;
    alert.textContent = message;

    container.appendChild(alert);

    // 3초 후 자동 제거
    setTimeout(() => {
        alert.remove();
    }, 3000);
}

// ==================== 계정 관리 ====================

// 계정 정보 컬렉션 참조
const accountsRef = db.collection('accounts');

// 계정 정보 로드
async function loadAccountSettings() {
    try {
        // 네이버 계정 로드
        const naverDoc = await accountsRef.doc('naver').get();
        if (naverDoc.exists) {
            const naverData = naverDoc.data();
            document.getElementById('naver-id').value = decodeCredential(naverData.id || '');
            // 비밀번호는 보안상 표시하지 않음
            document.getElementById('naver-enabled').checked = naverData.enabled || false;

            updateAccountStatus('naver', naverData.enabled ? '계정 연결됨 ✓' : '비활성화');
        }

        // 블라인드 계정 로드
        const blindDoc = await accountsRef.doc('blind').get();
        if (blindDoc.exists) {
            const blindData = blindDoc.data();
            document.getElementById('blind-email').value = decodeCredential(blindData.email || '');
            // 비밀번호는 보안상 표시하지 않음
            document.getElementById('blind-enabled').checked = blindData.enabled || false;

            updateAccountStatus('blind', blindData.enabled ? '계정 연결됨 ✓' : '비활성화');
        }
    } catch (error) {
        console.error('계정 정보 로드 오류:', error);
    }
}

// 네이버 계정 저장
async function saveNaverAccount(event) {
    event.preventDefault();

    const id = document.getElementById('naver-id').value.trim();
    const password = document.getElementById('naver-password').value;
    const enabled = document.getElementById('naver-enabled').checked;

    if (!id || !password) {
        showAlert('네이버 ID와 비밀번호를 모두 입력해주세요.', 'danger');
        return;
    }

    try {
        // 간단한 Base64 인코딩 (실제 환경에서는 더 강력한 암호화 필요)
        await accountsRef.doc('naver').set({
            id: encodeCredential(id),
            password: encodeCredential(password),
            enabled: enabled,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        showAlert('네이버 계정이 저장되었습니다.', 'success');
        updateAccountStatus('naver', enabled ? '계정 연결됨 ✓' : '저장됨 (비활성화)');

        // 비밀번호 필드 초기화
        document.getElementById('naver-password').value = '';
    } catch (error) {
        console.error('네이버 계정 저장 오류:', error);
        showAlert('계정 저장 중 오류가 발생했습니다.', 'danger');
    }
}

// 블라인드 계정 저장
async function saveBlindAccount(event) {
    event.preventDefault();

    const email = document.getElementById('blind-email').value.trim();
    const password = document.getElementById('blind-password').value;
    const enabled = document.getElementById('blind-enabled').checked;

    if (!email || !password) {
        showAlert('이메일과 비밀번호를 모두 입력해주세요.', 'danger');
        return;
    }

    try {
        // 간단한 Base64 인코딩 (실제 환경에서는 더 강력한 암호화 필요)
        await accountsRef.doc('blind').set({
            email: encodeCredential(email),
            password: encodeCredential(password),
            enabled: enabled,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        showAlert('블라인드 계정이 저장되었습니다.', 'success');
        updateAccountStatus('blind', enabled ? '계정 연결됨 ✓' : '저장됨 (비활성화)');

        // 비밀번호 필드 초기화
        document.getElementById('blind-password').value = '';
    } catch (error) {
        console.error('블라인드 계정 저장 오류:', error);
        showAlert('계정 저장 중 오류가 발생했습니다.', 'danger');
    }
}

// 네이버 계정 테스트
async function testNaverAccount() {
    const id = document.getElementById('naver-id').value.trim();

    if (!id) {
        showAlert('먼저 네이버 ID를 입력해주세요.', 'warning');
        return;
    }

    showAlert('연결 테스트 중...', 'warning');

    // 실제 테스트는 Firebase Functions에서 구현
    // 현재는 입력값 검증만 수행
    setTimeout(() => {
        showAlert('네이버 계정 정보가 저장되었습니다. 실제 연결 테스트는 Firebase Functions에서 구현 예정입니다.', 'success');
    }, 1000);
}

// 블라인드 계정 테스트
async function testBlindAccount() {
    const email = document.getElementById('blind-email').value.trim();

    if (!email) {
        showAlert('먼저 이메일을 입력해주세요.', 'warning');
        return;
    }

    showAlert('연결 테스트 중...', 'warning');

    // 실제 테스트는 Firebase Functions에서 구현
    // 현재는 입력값 검증만 수행
    setTimeout(() => {
        showAlert('블라인드 계정 정보가 저장되었습니다. 실제 연결 테스트는 Firebase Functions에서 구현 예정입니다.', 'success');
    }, 1000);
}

// 네이버 계정 삭제
async function deleteNaverAccount() {
    if (!confirm('네이버 계정 정보를 삭제하시겠습니까?')) {
        return;
    }

    try {
        await accountsRef.doc('naver').delete();
        document.getElementById('naver-id').value = '';
        document.getElementById('naver-password').value = '';
        document.getElementById('naver-enabled').checked = false;
        updateAccountStatus('naver', '');
        showAlert('네이버 계정이 삭제되었습니다.', 'success');
    } catch (error) {
        console.error('계정 삭제 오류:', error);
        showAlert('계정 삭제 중 오류가 발생했습니다.', 'danger');
    }
}

// 블라인드 계정 삭제
async function deleteBlindAccount() {
    if (!confirm('블라인드 계정 정보를 삭제하시겠습니까?')) {
        return;
    }

    try {
        await accountsRef.doc('blind').delete();
        document.getElementById('blind-email').value = '';
        document.getElementById('blind-password').value = '';
        document.getElementById('blind-enabled').checked = false;
        updateAccountStatus('blind', '');
        showAlert('블라인드 계정이 삭제되었습니다.', 'success');
    } catch (error) {
        console.error('계정 삭제 오류:', error);
        showAlert('계정 삭제 중 오류가 발생했습니다.', 'danger');
    }
}

// 계정 폼 핸들러 설정
function setupAccountHandlers() {
    document.getElementById('naver-account-form').addEventListener('submit', saveNaverAccount);
    document.getElementById('blind-account-form').addEventListener('submit', saveBlindAccount);
}

// 계정 상태 업데이트
function updateAccountStatus(platform, message) {
    const statusDiv = document.getElementById(`${platform}-status`);
    const statusText = document.getElementById(`${platform}-status-text`);

    if (message) {
        statusDiv.style.display = 'block';
        statusText.textContent = message;
    } else {
        statusDiv.style.display = 'none';
    }
}

// 간단한 Base64 인코딩 (보안 강화 필요)
function encodeCredential(text) {
    return btoa(unescape(encodeURIComponent(text)));
}

// Base64 디코딩
function decodeCredential(encoded) {
    try {
        return decodeURIComponent(escape(atob(encoded)));
    } catch {
        return '';
    }
}

// 전역 함수로 노출 (HTML에서 호출)
window.deleteKeyword = deleteKeyword;
window.testNaverAccount = testNaverAccount;
window.testBlindAccount = testBlindAccount;
window.deleteNaverAccount = deleteNaverAccount;
window.deleteBlindAccount = deleteBlindAccount;

// ==================== 크롤링 상태 관리 ====================

// 크롤링 상태 로드 (실시간)
function loadCrawlingStatus() {
    // Firestore에서 실시간으로 크롤링 상태 감지
    db.collection('settings').doc('crawling')
        .onSnapshot((doc) => {
            if (doc.exists) {
                const status = doc.data();
                updateCrawlingUI(status);
            } else {
                // 초기 상태 설정
                updateCrawlingUI({
                    enabled: false,
                    status: 'idle',
                    lastRunTime: null,
                    nextRunTime: null
                });
            }
        }, (error) => {
            console.error('크롤링 상태 로드 오류:', error);
        });
}

// 크롤링 UI 업데이트
function updateCrawlingUI(status) {
    const statusText = document.getElementById('crawling-status-text');
    const statusBadge = document.getElementById('crawling-status-badge');
    const lastCrawlTime = document.getElementById('last-crawl-time');
    const nextCrawlTime = document.getElementById('next-crawl-time');
    const startBtn = document.getElementById('start-crawling-btn');
    const stopBtn = document.getElementById('stop-crawling-btn');

    // 상태 텍스트 업데이트 (enabled 상태에 따라 다르게 표시)
    let displayMessage = '상태 확인 중...';

    if (status.enabled) {
        // 활성화 상태일 때
        const activeMessages = {
            'idle': '다음 실행 대기 중',
            'running': '크롤링 실행 중...',
            'analyzing': '데이터 분석 중...',
            'completed': '크롤링 완료 (다음 실행 대기)'
        };
        displayMessage = activeMessages[status.status] || '다음 실행 대기 중';
    } else {
        // 비활성화 상태일 때
        const inactiveMessages = {
            'idle': '대기 중 (중단됨)',
            'running': '크롤링 실행 중... (곧 중단됨)',
            'analyzing': '분석 중... (곧 중단됨)',
            'completed': '중단됨'
        };
        displayMessage = inactiveMessages[status.status] || '중단됨';
    }

    if (statusText) {
        statusText.textContent = displayMessage;
    }

    // 상태 배지 업데이트
    if (statusBadge) {
        const badgeClass = status.enabled ? 'badge-success' : 'badge-danger';
        const badgeText = status.enabled ? '활성' : '중단';
        statusBadge.innerHTML = `
            <span class="badge ${badgeClass}" style="font-size: var(--font-size-base); padding: var(--spacing-sm) var(--spacing-md);">
                ${badgeText}
            </span>
        `;
    }

    // 마지막 실행 시간
    if (lastCrawlTime && status.lastRunTime) {
        const lastTime = status.lastRunTime.toDate ? status.lastRunTime.toDate() : new Date(status.lastRunTime);
        lastCrawlTime.textContent = formatDateTime(lastTime);
    } else if (lastCrawlTime) {
        lastCrawlTime.textContent = '-';
    }

    // 다음 예정 시간
    if (nextCrawlTime && status.nextRunTime) {
        const nextTime = status.nextRunTime.toDate ? status.nextRunTime.toDate() : new Date(status.nextRunTime);
        nextCrawlTime.textContent = formatDateTime(nextTime);
    } else if (nextCrawlTime) {
        nextCrawlTime.textContent = status.enabled ? '1시간 후' : '-';
    }

    // 버튼 상태
    if (startBtn && stopBtn) {
        if (status.enabled) {
            startBtn.disabled = true;
            startBtn.style.opacity = '0.5';
            stopBtn.disabled = false;
            stopBtn.style.opacity = '1';
        } else {
            startBtn.disabled = false;
            startBtn.style.opacity = '1';
            stopBtn.disabled = true;
            stopBtn.style.opacity = '0.5';
        }
    }
}

// 날짜/시간 포맷팅
function formatDateTime(date) {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${month}월 ${day}일 ${hours}:${minutes}`;
}

// 크롤링 시작
async function startCrawling() {
    try {
        addCrawlingLog('⏳ 크롤링 시작 요청...', 'info');
        await db.collection('settings').doc('crawling').set({
            enabled: true,
            status: 'idle',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        showAlert('크롤링이 시작되었습니다. 매시간 자동으로 실행됩니다.', 'success');
        addCrawlingLog('✅ 크롤링이 시작되었습니다. 매시간 자동으로 실행됩니다.', 'success');
    } catch (error) {
        console.error('크롤링 시작 오류:', error);
        addCrawlingLog(`❌ 시작 오류: ${error.message}`, 'error');
        showAlert('크롤링 시작 중 오류가 발생했습니다.', 'danger');
    }
}

// 크롤링 중단
async function stopCrawling() {
    if (!confirm('크롤링을 중단하시겠습니까?')) {
        return;
    }

    try {
        await db.collection('settings').doc('crawling').set({
            enabled: false,
            status: 'idle',
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        showAlert('크롤링이 중단되었습니다.', 'success');
    } catch (error) {
        console.error('크롤링 중단 오류:', error);
        showAlert('크롤링 중단 중 오류가 발생했습니다.', 'danger');
    }
}

// 즉시 실행
async function runCrawlingNow() {
    try {
        addCrawlingLog('⚡ 즉시 실행 시작...', 'info');
        addCrawlingLog('🌐 Firebase Functions 호출 중...', 'info');
        showAlert('크롤링을 시작합니다...', 'warning');

        // Firebase Functions의 수동 트리거 호출
        const response = await fetch(
            'https://asia-northeast3-keyword-trend-monitor.cloudfunctions.net/collectNewsManual'
        );

        const result = await response.json();

        if (result.success) {
            showAlert(`크롤링 완료! ${result.keywordCount}개 키워드, ${result.totalCount}개 데이터 수집`, 'success');
            addCrawlingLog(`✅ 크롤링 완료! ${result.keywordCount}개 키워드, ${result.totalCount}개 데이터 수집`, 'success');
        } else {
            showAlert('크롤링 실패: ' + (result.error || '알 수 없는 오류'), 'danger');
            addCrawlingLog(`❌ 크롤링 실패: ${result.error || '알 수 없는 오류'}`, 'error');
        }
    } catch (error) {
        console.error('즉시 실행 오류:', error);
        showAlert('크롤링 실행 중 오류가 발생했습니다.', 'danger');
        addCrawlingLog(`❌ 실행 오류: ${error.message}`, 'error');
    }
}

// 크롤링 제어 핸들러 설정
function setupCrawlingHandlers() {
    // 버튼은 HTML에서 onclick으로 이미 연결됨
}

// 전역 함수로 노출
window.startCrawling = startCrawling;
window.stopCrawling = stopCrawling;
window.runCrawlingNow = runCrawlingNow;

// ==================== 이메일 수신자 관리 ====================

// 이메일 수신자 목록 로드
async function loadEmailRecipients() {
    try {
        const snapshot = await db.collection('emailRecipients')
            .orderBy('createdAt', 'desc')
            .get();

        const tbody = document.getElementById('email-recipients-list');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (snapshot.empty) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="4" class="text-center text-muted">
                        등록된 이메일이 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        snapshot.forEach(doc => {
            const recipient = doc.data();
            const row = document.createElement('tr');

            row.innerHTML = `
                <td><strong>${recipient.email}</strong></td>
                <td>${formatDate(recipient.createdAt)}</td>
                <td>
                    <span class="badge ${recipient.active ? 'badge-success' : 'badge-danger'}">
                        ${recipient.active ? '활성' : '비활성'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-danger" onclick="deleteEmailRecipient('${doc.id}', '${recipient.email}')" style="font-size: var(--font-size-xs); padding: 4px 8px;">
                        삭제
                    </button>
                </td>
            `;

            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('이메일 수신자 로드 오류:', error);
        showAlert('이메일 목록을 불러오는 중 오류가 발생했습니다.', 'danger');
    }
}

// 이메일 수신자 추가
async function addEmailRecipient(event) {
    event.preventDefault();

    const emailInput = document.getElementById('new-email');
    const email = emailInput.value.trim();

    if (!email) {
        showAlert('이메일 주소를 입력해주세요.', 'danger');
        return;
    }

    // 이메일 형식 검증
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showAlert('올바른 이메일 형식이 아닙니다.', 'danger');
        return;
    }

    try {
        // 중복 확인
        const existing = await db.collection('emailRecipients')
            .where('email', '==', email)
            .get();

        if (!existing.empty) {
            showAlert('이미 등록된 이메일입니다.', 'warning');
            return;
        }

        // 추가
        await db.collection('emailRecipients').add({
            email: email,
            active: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showAlert('이메일이 추가되었습니다.', 'success');
        emailInput.value = '';
        loadEmailRecipients();
    } catch (error) {
        console.error('이메일 추가 오류:', error);
        showAlert('이메일 추가 중 오류가 발생했습니다.', 'danger');
    }
}

// 이메일 수신자 삭제
async function deleteEmailRecipient(id, email) {
    if (!confirm(`'${email}' 을(를) 삭제하시겠습니까?`)) {
        return;
    }

    try {
        await db.collection('emailRecipients').doc(id).delete();
        showAlert('이메일이 삭제되었습니다.', 'success');
        loadEmailRecipients();
    } catch (error) {
        console.error('이메일 삭제 오류:', error);
        showAlert('이메일 삭제 중 오류가 발생했습니다.', 'danger');
    }
}

// ==================== Webhook 수신자 관리 ====================

// Webhook 수신자 목록 로드
async function loadWebhookRecipients() {
    try {
        const snapshot = await db.collection('webhookRecipients')
            .orderBy('createdAt', 'desc')
            .get();

        const tbody = document.getElementById('webhook-recipients-list');
        if (!tbody) return;

        tbody.innerHTML = '';

        if (snapshot.empty) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-muted">
                        등록된 Webhook이 없습니다.
                    </td>
                </tr>
            `;
            return;
        }

        const typeLabels = {
            'slack': 'Slack',
            'discord': 'Discord',
            'teams': 'MS Teams',
            'custom': '기타'
        };

        snapshot.forEach(doc => {
            const webhook = doc.data();
            const row = document.createElement('tr');

            // URL 축약 표시
            const shortUrl = webhook.url.length > 40
                ? webhook.url.substring(0, 40) + '...'
                : webhook.url;

            row.innerHTML = `
                <td>${webhook.name || '-'}</td>
                <td><span class="badge badge-primary">${typeLabels[webhook.type] || webhook.type}</span></td>
                <td><small>${shortUrl}</small></td>
                <td>${formatDate(webhook.createdAt)}</td>
                <td>
                    <span class="badge ${webhook.active ? 'badge-success' : 'badge-danger'}">
                        ${webhook.active ? '활성' : '비활성'}
                    </span>
                </td>
                <td>
                    <button class="btn btn-danger" onclick="deleteWebhookRecipient('${doc.id}')" style="font-size: var(--font-size-xs); padding: 4px 8px;">
                        삭제
                    </button>
                </td>
            `;

            tbody.appendChild(row);
        });
    } catch (error) {
        console.error('Webhook 수신자 로드 오류:', error);
    }
}

// Webhook 수신자 추가
async function addWebhookRecipient(event) {
    event.preventDefault();

    const nameInput = document.getElementById('webhook-name');
    const typeInput = document.getElementById('webhook-type');
    const urlInput = document.getElementById('webhook-url');

    const name = nameInput.value.trim();
    const type = typeInput.value;
    const url = urlInput.value.trim();

    if (!url) {
        showAlert('Webhook URL을 입력해주세요.', 'danger');
        return;
    }

    // URL 형식 검증
    try {
        new URL(url);
    } catch {
        showAlert('올바른 URL 형식이 아닙니다.', 'danger');
        return;
    }

    try {
        // 중복 확인
        const existing = await db.collection('webhookRecipients')
            .where('url', '==', url)
            .get();

        if (!existing.empty) {
            showAlert('이미 등록된 Webhook URL입니다.', 'warning');
            return;
        }

        // 추가
        await db.collection('webhookRecipients').add({
            name: name,
            type: type,
            url: url,
            active: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        showAlert('Webhook이 추가되었습니다.', 'success');
        nameInput.value = '';
        urlInput.value = '';
        loadWebhookRecipients();
    } catch (error) {
        console.error('Webhook 추가 오류:', error);
        showAlert('Webhook 추가 중 오류가 발생했습니다.', 'danger');
    }
}

// Webhook 수신자 삭제
async function deleteWebhookRecipient(id) {
    if (!confirm('이 Webhook을 삭제하시겠습니까?')) {
        return;
    }

    try {
        await db.collection('webhookRecipients').doc(id).delete();
        showAlert('Webhook이 삭제되었습니다.', 'success');
        loadWebhookRecipients();
    } catch (error) {
        console.error('Webhook 삭제 오류:', error);
        showAlert('Webhook 삭제 중 오류가 발생했습니다.', 'danger');
    }
}

// 전역 함수로 노출
window.deleteEmailRecipient = deleteEmailRecipient;
window.deleteWebhookRecipient = deleteWebhookRecipient;

// 알림 수신자 핸들러 설정
function setupNotificationHandlers() {
    const emailForm = document.getElementById('email-add-form');
    const webhookForm = document.getElementById('webhook-add-form');

    if (emailForm) {
        emailForm.addEventListener('submit', addEmailRecipient);
    }

    if (webhookForm) {
        webhookForm.addEventListener('submit', addWebhookRecipient);
    }
}

// ==================== 데이터 관리 ====================

// 데이터 통계 로드
async function loadDataStats() {
    try {
        // 수집 데이터 개수
        const dataSnapshot = await db.collection('data').get();
        document.getElementById('data-count').textContent = dataSnapshot.size.toLocaleString();

        // 알림 개수
        const alertsSnapshot = await db.collection('alerts').get();
        document.getElementById('alerts-count').textContent = alertsSnapshot.size.toLocaleString();

        // 키워드 개수
        const keywordsSnapshot = await db.collection('keywords').get();
        document.getElementById('keywords-count').textContent = keywordsSnapshot.size.toLocaleString();

        // 수신자 개수 (이메일 + Webhook)
        const emailSnapshot = await db.collection('emailRecipients').get();
        const webhookSnapshot = await db.collection('webhookRecipients').get();
        const totalRecipients = emailSnapshot.size + webhookSnapshot.size;
        document.getElementById('recipients-count').textContent = totalRecipients.toLocaleString();

        showAlert('데이터 통계가 업데이트되었습니다.', 'success');
    } catch (error) {
        console.error('데이터 통계 로드 오류:', error);
        showAlert('데이터 통계 로드 중 오류가 발생했습니다.', 'danger');
    }
}

// 전체 데이터 삭제
async function deleteAllData() {
    if (!confirm('모든 수집 데이터를 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다!')) {
        return;
    }

    try {
        showAlert('데이터 삭제 중...', 'warning');

        const snapshot = await db.collection('data').get();
        const batch = db.batch();
        let count = 0;

        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
            count++;
        });

        await batch.commit();
        showAlert(`${count}개의 데이터가 삭제되었습니다.`, 'success');
        loadDataStats();
    } catch (error) {
        console.error('데이터 삭제 오류:', error);
        showAlert('데이터 삭제 중 오류가 발생했습니다.', 'danger');
    }
}

// 전체 알림 삭제
async function deleteAllAlerts() {
    if (!confirm('모든 알림을 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다!')) {
        return;
    }

    try {
        showAlert('알림 삭제 중...', 'warning');

        const snapshot = await db.collection('alerts').get();
        const batch = db.batch();
        let count = 0;

        snapshot.docs.forEach((doc) => {
            batch.delete(doc.ref);
            count++;
        });

        await batch.commit();
        showAlert(`${count}개의 알림이 삭제되었습니다.`, 'success');
        loadDataStats();
    } catch (error) {
        console.error('알림 삭제 오류:', error);
        showAlert('알림 삭제 중 오류가 발생했습니다.', 'danger');
    }
}

// 오래된 데이터 삭제 (30일 이상)
async function deleteOldData() {
    if (!confirm('30일 이상 된 데이터를 삭제하시겠습니까?')) {
        return;
    }

    try {
        showAlert('오래된 데이터 삭제 중...', 'warning');

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        // 오래된 데이터 삭제
        const dataSnapshot = await db.collection('data')
            .where('date', '<', firebase.firestore.Timestamp.fromDate(thirtyDaysAgo))
            .get();

        const dataBatch = db.batch();
        dataSnapshot.docs.forEach((doc) => {
            dataBatch.delete(doc.ref);
        });

        // 오래된 알림 삭제
        const alertsSnapshot = await db.collection('alerts')
            .where('timestamp', '<', firebase.firestore.Timestamp.fromDate(thirtyDaysAgo))
            .get();

        const alertsBatch = db.batch();
        alertsSnapshot.docs.forEach((doc) => {
            alertsBatch.delete(doc.ref);
        });

        await Promise.all([dataBatch.commit(), alertsBatch.commit()]);

        const totalDeleted = dataSnapshot.size + alertsSnapshot.size;
        showAlert(`${totalDeleted}개의 오래된 데이터가 삭제되었습니다.`, 'success');
        loadDataStats();
    } catch (error) {
        console.error('오래된 데이터 삭제 오류:', error);
        showAlert('데이터 삭제 중 오류가 발생했습니다.', 'danger');
    }
}

// 전체 초기화 (데이터 + 알림)
async function resetAllData() {
    const confirmation = prompt(
        '정말로 모든 데이터를 초기화하시겠습니까?\n' +
        '이 작업은 되돌릴 수 없습니다!\n\n' +
        '계속하려면 "초기화"를 입력하세요:'
    );

    if (confirmation !== '초기화') {
        showAlert('초기화가 취소되었습니다.', 'warning');
        return;
    }

    try {
        showAlert('전체 초기화 중...', 'warning');

        // 데이터 삭제
        const dataSnapshot = await db.collection('data').get();
        const dataBatch = db.batch();
        dataSnapshot.docs.forEach((doc) => {
            dataBatch.delete(doc.ref);
        });

        // 알림 삭제
        const alertsSnapshot = await db.collection('alerts').get();
        const alertsBatch = db.batch();
        alertsSnapshot.docs.forEach((doc) => {
            alertsBatch.delete(doc.ref);
        });

        await Promise.all([dataBatch.commit(), alertsBatch.commit()]);

        const totalDeleted = dataSnapshot.size + alertsSnapshot.size;
        showAlert(`전체 초기화 완료! ${totalDeleted}개 항목 삭제됨`, 'success');
        loadDataStats();
    } catch (error) {
        console.error('전체 초기화 오류:', error);
        showAlert('초기화 중 오류가 발생했습니다.', 'danger');
    }
}

// 전역 함수로 노출
window.loadDataStats = loadDataStats;
window.deleteAllData = deleteAllData;
window.deleteAllAlerts = deleteAllAlerts;
window.deleteOldData = deleteOldData;
window.resetAllData = resetAllData;

