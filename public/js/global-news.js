/**
 * 글로벌 뉴스 모니터링 - Task 목록 페이지
 */

const CORRECT_PASSWORD = 'ixioglobal2026';
const SESSION_KEY = 'globalNewsAuth';

// 언어 설정
const LANGUAGE_OPTIONS = {
    en: { name: 'English', flag: '🇺🇸' },
    ms: { name: 'Malay', flag: '🇲🇾' },
    id: { name: 'Indonesian', flag: '🇮🇩' },
    'pt-BR': { name: 'Portuguese (Brazil)', flag: '🇧🇷' },
    ja: { name: 'Japanese', flag: '🇯🇵' },
    ar: { name: 'Arabic', flag: '🇸🇦' }
};

// ==================== 인증 ====================
document.addEventListener('DOMContentLoaded', () => {
    // 세션 체크
    if (sessionStorage.getItem(SESSION_KEY) === 'authenticated') {
        showMainContent();
    }

    // 인증 폼 이벤트
    const authForm = document.getElementById('auth-form');
    if (authForm) {
        authForm.addEventListener('submit', handleAuth);
    }

    // Task 폼 이벤트
    const taskForm = document.getElementById('task-form');
    if (taskForm) {
        taskForm.addEventListener('submit', handleTaskSubmit);
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
    loadTasks();
}

// ==================== Task CRUD ====================
async function loadTasks() {
    const container = document.getElementById('task-list');

    try {
        const snapshot = await db.collection('globalTasks')
            .orderBy('createdAt', 'desc')
            .get();

        if (snapshot.empty) {
            container.innerHTML = `
                <div class="card">
                    <div class="card-body text-center text-muted">
                        <p style="font-size: 1.2em; margin-bottom: 1rem;">아직 생성된 Task가 없습니다.</p>
                        <button class="btn btn-primary" onclick="showCreateModal()">+ 첫 번째 Task 생성</button>
                    </div>
                </div>
            `;
            return;
        }

        let html = '<div style="display: grid; gap: 1rem;">';

        snapshot.forEach(doc => {
            const task = doc.data();
            const taskId = doc.id;
            // 다중 언어 지원
            const languages = Array.isArray(task.languages) ? task.languages : (task.language ? [task.language] : ['en']);
            const langDisplay = languages.map(lang => {
                const info = LANGUAGE_OPTIONS[lang] || { name: lang, flag: '' };
                return info.flag ? `${info.flag} ` : '';
            }).join('');
            const keywords = (task.keywords || []).slice(0, 5).join(', ');
            const moreKeywords = (task.keywords || []).length > 5 ? ` +${task.keywords.length - 5}개` : '';
            const status = task.isActive ?
                '<span style="color: var(--accent-green);">[활성]</span>' :
                '<span style="color: var(--text-secondary);">[비활성]</span>';
            const createdAt = task.createdAt?.toDate?.() ?
                formatDateTime(task.createdAt.toDate()) : '-';

            html += `
                <div class="card">
                    <div class="card-body">
                        <div class="d-flex justify-between align-center" style="margin-bottom: 0.75rem;">
                            <h3 style="margin: 0; font-size: 1.2em;">
                                <a href="global-news-task.html?task=${taskId}" style="color: var(--primary-color); text-decoration: none;">
                                    ${task.name || 'Unnamed Task'}
                                </a>
                            </h3>
                            <div class="d-flex gap-sm align-center">
                                ${status}
                                <button class="btn btn-outline btn-sm" onclick="editTask('${taskId}')">Edit</button>
                                <button class="btn btn-outline btn-sm" onclick="deleteTask('${taskId}')">Del</button>
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.5rem; font-size: 0.9em; color: var(--text-secondary);">
                            <div><strong>언어:</strong> ${langDisplay}(${languages.length}개)</div>
                            <div><strong>키워드:</strong> ${keywords}${moreKeywords}</div>
                            <div><strong>생성일:</strong> ${createdAt}</div>
                        </div>
                        <div style="margin-top: 1rem;">
                            <a href="global-news-task.html?task=${taskId}" class="btn btn-primary btn-sm">대시보드 보기</a>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;

    } catch (error) {
        console.error('Task 로드 오류:', error);
        container.innerHTML = `
            <div class="card">
                <div class="card-body text-center" style="color: var(--accent-red);">
                    데이터 로드 중 오류가 발생했습니다: ${error.message}
                </div>
            </div>
        `;
    }
}

// ==================== 모달 ====================
function showCreateModal() {
    document.getElementById('modal-title').textContent = '새 Task 생성';
    document.getElementById('task-id').value = '';
    document.getElementById('task-name').value = '';
    document.getElementById('task-keywords').value = '';
    // 모든 언어 체크박스 초기화 (영어만 선택)
    document.querySelectorAll('input[name="task-language"]').forEach(cb => {
        cb.checked = cb.value === 'en';
    });
    document.getElementById('task-filters').value = 'spam, scam, prepaid, mobile plan, phone deal, fraud, phishing';
    document.getElementById('task-active').checked = true;

    document.getElementById('create-modal').style.display = 'flex';
}

async function editTask(taskId) {
    try {
        const doc = await db.collection('globalTasks').doc(taskId).get();
        if (!doc.exists) {
            alert('Task를 찾을 수 없습니다.');
            return;
        }

        const task = doc.data();

        document.getElementById('modal-title').textContent = 'Task 수정';
        document.getElementById('task-id').value = taskId;
        document.getElementById('task-name').value = task.name || '';
        document.getElementById('task-keywords').value = (task.keywords || []).join(', ');
        // 다중 언어 체크박스 설정
        const savedLanguages = Array.isArray(task.languages) ? task.languages : (task.language ? [task.language] : ['en']);
        document.querySelectorAll('input[name="task-language"]').forEach(cb => {
            cb.checked = savedLanguages.includes(cb.value);
        });
        document.getElementById('task-filters').value = (task.filterKeywords || []).join(', ');
        document.getElementById('task-excludes').value = (task.excludeKeywords || []).join(', ');
        document.getElementById('task-active').checked = task.isActive !== false;

        document.getElementById('create-modal').style.display = 'flex';

    } catch (error) {
        console.error('Task 로드 오류:', error);
        alert('Task 정보를 불러오는 중 오류가 발생했습니다.');
    }
}

function closeModal() {
    document.getElementById('create-modal').style.display = 'none';
}

async function handleTaskSubmit(event) {
    event.preventDefault();

    const taskId = document.getElementById('task-id').value;
    const name = document.getElementById('task-name').value.trim();
    const keywordsRaw = document.getElementById('task-keywords').value;
    // 다중 언어 선택 가져오기
    const selectedLanguages = Array.from(document.querySelectorAll('input[name="task-language"]:checked')).map(cb => cb.value);
    const filtersRaw = document.getElementById('task-filters').value;
    const excludesRaw = document.getElementById('task-excludes').value;
    const isActive = document.getElementById('task-active').checked;

    // 파싱
    const keywords = keywordsRaw.split(',').map(k => k.trim()).filter(k => k);
    const filterKeywords = filtersRaw.split(',').map(k => k.trim()).filter(k => k);
    const excludeKeywords = excludesRaw.split(',').map(k => k.trim()).filter(k => k);

    if (!name || keywords.length === 0) {
        alert('Task 이름과 최소 1개의 키워드를 입력하세요.');
        return;
    }

    if (selectedLanguages.length === 0) {
        alert('최소 1개의 언어를 선택하세요.');
        return;
    }

    try {
        const taskData = {
            name: name,
            keywords: keywords,
            languages: selectedLanguages,
            filterKeywords: filterKeywords,
            excludeKeywords: excludeKeywords,
            isActive: isActive,
            updatedAt: firebase.firestore.Timestamp.now()
        };

        if (taskId) {
            // 수정
            await db.collection('globalTasks').doc(taskId).update(taskData);
            alert('Task가 수정되었습니다.');
        } else {
            // 생성
            taskData.createdAt = firebase.firestore.Timestamp.now();
            await db.collection('globalTasks').add(taskData);
            alert('Task가 생성되었습니다.');
        }

        closeModal();
        loadTasks();

    } catch (error) {
        console.error('Task 저장 오류:', error);
        alert('저장 중 오류가 발생했습니다: ' + error.message);
    }
}

async function deleteTask(taskId) {
    if (!confirm('정말로 이 Task를 삭제하시겠습니까?\n\n관련된 모든 뉴스 데이터도 함께 삭제됩니다.')) {
        return;
    }

    try {
        // Task 삭제
        await db.collection('globalTasks').doc(taskId).delete();

        // 관련 데이터 삭제 (globalNewsData)
        const dataSnapshot = await db.collection('globalNewsData')
            .where('taskId', '==', taskId)
            .get();

        const batch = db.batch();
        dataSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });
        await batch.commit();

        alert('Task가 삭제되었습니다.');
        loadTasks();

    } catch (error) {
        console.error('Task 삭제 오류:', error);
        alert('삭제 중 오류가 발생했습니다: ' + error.message);
    }
}

// ==================== 유틸리티 ====================
function formatDateTime(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
}

// ESC 키로 모달 닫기
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeModal();
    }
});

// 모달 외부 클릭으로 닫기
document.getElementById('create-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'create-modal') {
        closeModal();
    }
});
