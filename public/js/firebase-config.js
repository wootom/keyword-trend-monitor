// Firebase 설정
// TODO: Firebase 프로젝트 생성 후 실제 설정값으로 교체하세요

const firebaseConfig = {
  apiKey: "AIzaSyDlNSuohFV2aR2FwUN0_UQwB49qrn9C518",
  authDomain: "keyword-trend-monitor.firebaseapp.com",
  projectId: "keyword-trend-monitor",
  storageBucket: "keyword-trend-monitor.firebasestorage.app",
  messagingSenderId: "1073581033210",
  appId: "1:1073581033210:web:95463b0a14ccb0edc4ab43"
};

// Firebase 초기화
firebase.initializeApp(firebaseConfig);

// Firestore 및 Auth 인스턴스
const db = firebase.firestore();
const auth = firebase.auth ? firebase.auth() : null; // Auth SDK가 있을 때만

// 컬렉션 참조
const keywordsRef = db.collection('keywords');
const sourcesRef = db.collection('sources');
const dataRef = db.collection('data');
const settingsRef = db.collection('settings');

console.log('Firebase initialized successfully');
