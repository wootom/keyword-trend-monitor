// Firebase Authentication 헬퍼 모듈
import { getAuth, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

let auth = null;
let db = null;
let currentUser = null;

/**
 * 인증 모듈 초기화
 * @param {Object} app - Firebase 앱 인스턴스
 */
export function initAuth(app) {
    auth = getAuth(app);
    db = getFirestore(app);

    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                currentUser = user;
                // 사용자 정보를 Firestore에 저장/업데이트
                await saveUserInfo(user);
                console.log('사용자 로그인:', user.email);
            } else {
                currentUser = null;
                console.log('사용자 로그아웃');
            }
            resolve(currentUser);
        });
    });
}

/**
 * 현재 로그인한 사용자 가져오기
 * @returns {Object|null} 현재 사용자 객체 또는 null
 */
export function getCurrentUser() {
    return currentUser;
}

/**
 * 사용자가 로그인했는지 확인
 * @returns {boolean} 로그인 여부
 */
export function isLoggedIn() {
    return currentUser !== null;
}

/**
 * 사용자가 관리자인지 확인
 * @returns {Promise<boolean>} 관리자 여부
 */
export async function isAdmin() {
    if (!currentUser) return false;

    try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists()) {
            return userDoc.data().role === 'admin';
        }
        return false;
    } catch (error) {
        console.error('관리자 권한 확인 오류:', error);
        return false;
    }
}

/**
 * 사용자 정보를 Firestore에 저장
 * @param {Object} user - Firebase 사용자 객체
 */
async function saveUserInfo(user) {
    try {
        const userRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userRef);

        const userData = {
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            lastLogin: new Date()
        };

        if (userDoc.exists()) {
            // 기존 사용자 업데이트 (role은 유지)
            await setDoc(userRef, {
                ...userData,
                role: userDoc.data().role || 'user'
            }, { merge: true });
        } else {
            // 새 사용자 생성
            await setDoc(userRef, {
                ...userData,
                role: 'user',
                createdAt: new Date()
            });
        }
    } catch (error) {
        console.error('사용자 정보 저장 오류:', error);
    }
}

/**
 * 로그아웃
 */
export async function logout() {
    try {
        await signOut(auth);
        window.location.href = '/login.html';
    } catch (error) {
        console.error('로그아웃 오류:', error);
        throw error;
    }
}

/**
 * 관리자 페이지 접근 권한 확인
 * 관리자가 아니면 메인 페이지로 리다이렉트
 */
export async function requireAdmin() {
    if (!isLoggedIn()) {
        window.location.href = '/login.html';
        return false;
    }

    const adminStatus = await isAdmin();
    if (!adminStatus) {
        alert('관리자 권한이 필요합니다.');
        window.location.href = '/';
        return false;
    }

    return true;
}

/**
 * 사용자 프로필 UI 렌더링
 * @param {string} containerId - 프로필을 렌더링할 컨테이너 ID
 */
export function renderUserProfile(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!isLoggedIn()) {
        container.innerHTML = `
            <a href="/login.html" class="login-btn">로그인</a>
        `;
        return;
    }

    const user = getCurrentUser();
    container.innerHTML = `
        <div class="user-profile">
            <img src="${user.photoURL || '/images/default-avatar.png'}" 
                 alt="${user.displayName}" 
                 class="user-avatar">
            <div class="user-info">
                <span class="user-name">${user.displayName || user.email}</span>
                <button id="logoutBtn" class="logout-btn">로그아웃</button>
            </div>
        </div>
    `;

    document.getElementById('logoutBtn').addEventListener('click', logout);
}

/**
 * 로그인 필수 페이지 보호
 * @param {boolean} adminOnly - 관리자만 접근 가능한지 여부
 */
export async function protectPage(adminOnly = false) {
    return new Promise((resolve) => {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                window.location.href = '/login.html';
                resolve(false);
                return;
            }

            if (adminOnly) {
                const adminStatus = await isAdmin();
                if (!adminStatus) {
                    alert('관리자 권한이 필요합니다.');
                    window.location.href = '/';
                    resolve(false);
                    return;
                }
            }

            resolve(true);
        });
    });
}
