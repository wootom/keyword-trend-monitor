const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, Timestamp } = require('firebase/firestore');

// Firebase 설정
const firebaseConfig = {
    apiKey: "AIzaSyBQnDMvtDnQDd9p4clijvVZsZcspRtiFIk",
    authDomain: "keyword-trend-monitor.firebaseapp.com",
    projectId: "keyword-trend-monitor",
    storageBucket: "keyword-trend-monitor.firebasestorage.app",
    messagingSenderId: "476155824835",
    appId: "1:476155824835:web:ff9e01a10ca6eb1119d02a"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// 샘플 트렌드 데이터
const sampleData = [
    // ChatGPT 데이터 (최근 7일)
    {
        keyword: "ChatGPT",
        source: "구글 뉴스",
        count: 145,
        sentiment: "positive",
        date: new Date("2025-12-12T10:00:00"),
        url: "https://news.google.com/search?q=ChatGPT"
    },
    {
        keyword: "ChatGPT",
        source: "네이버 뉴스",
        count: 132,
        sentiment: "positive",
        date: new Date("2025-12-13T10:00:00"),
        url: "https://search.naver.com/search.naver?query=ChatGPT"
    },
    {
        keyword: "ChatGPT",
        source: "구글 뉴스",
        count: 178,
        sentiment: "neutral",
        date: new Date("2025-12-14T10:00:00"),
        url: "https://news.google.com/search?q=ChatGPT"
    },
    {
        keyword: "ChatGPT",
        source: "네이버 뉴스",
        count: 156,
        sentiment: "positive",
        date: new Date("2025-12-15T10:00:00"),
        url: "https://search.naver.com/search.naver?query=ChatGPT"
    },
    {
        keyword: "ChatGPT",
        source: "구글 뉴스",
        count: 189,
        sentiment: "positive",
        date: new Date("2025-12-16T10:00:00"),
        url: "https://news.google.com/search?q=ChatGPT"
    },
    {
        keyword: "ChatGPT",
        source: "네이버 뉴스",
        count: 201,
        sentiment: "neutral",
        date: new Date("2025-12-17T10:00:00"),
        url: "https://search.naver.com/search.naver?query=ChatGPT"
    },
    {
        keyword: "ChatGPT",
        source: "구글 뉴스",
        count: 195,
        sentiment: "positive",
        date: new Date("2025-12-18T10:00:00"),
        url: "https://news.google.com/search?q=ChatGPT"
    },

    // 메타버스 데이터 (최근 7일)
    {
        keyword: "메타버스",
        source: "구글 뉴스",
        count: 87,
        sentiment: "neutral",
        date: new Date("2025-12-12T10:00:00"),
        url: "https://news.google.com/search?q=메타버스"
    },
    {
        keyword: "메타버스",
        source: "네이버 뉴스",
        count: 92,
        sentiment: "positive",
        date: new Date("2025-12-13T10:00:00"),
        url: "https://search.naver.com/search.naver?query=메타버스"
    },
    {
        keyword: "메타버스",
        source: "구글 뉴스",
        count: 76,
        sentiment: "neutral",
        date: new Date("2025-12-14T10:00:00"),
        url: "https://news.google.com/search?q=메타버스"
    },
    {
        keyword: "메타버스",
        source: "네이버 뉴스",
        count: 104,
        sentiment: "positive",
        date: new Date("2025-12-15T10:00:00"),
        url: "https://search.naver.com/search.naver?query=메타버스"
    },
    {
        keyword: "메타버스",
        source: "구글 뉴스",
        count: 98,
        sentiment: "negative",
        date: new Date("2025-12-16T10:00:00"),
        url: "https://news.google.com/search?q=메타버스"
    },
    {
        keyword: "메타버스",
        source: "네이버 뉴스",
        count: 115,
        sentiment: "neutral",
        date: new Date("2025-12-17T10:00:00"),
        url: "https://search.naver.com/search.naver?query=메타버스"
    },
    {
        keyword: "메타버스",
        source: "구글 뉴스",
        count: 109,
        sentiment: "positive",
        date: new Date("2025-12-18T10:00:00"),
        url: "https://news.google.com/search?q=메타버스"
    }
];

async function addSampleData() {
    console.log('🔄 샘플 트렌드 데이터 추가 시작...\n');

    let successCount = 0;
    let errorCount = 0;

    for (const item of sampleData) {
        try {
            // Firestore Timestamp로 변환
            const dataToAdd = {
                ...item,
                date: Timestamp.fromDate(item.date)
            };

            const docRef = await addDoc(collection(db, 'data'), dataToAdd);
            console.log(`✅ 추가됨: ${item.keyword} - ${item.source} (${item.date.toLocaleDateString()}) - ID: ${docRef.id}`);
            successCount++;
        } catch (error) {
            console.error(`❌ 실패: ${item.keyword} - ${error.message}`);
            errorCount++;
        }
    }

    console.log(`\n📊 완료: ${successCount}개 성공, ${errorCount}개 실패`);
    console.log('✨ 샘플 데이터 추가 완료!\n');

    process.exit(0);
}

addSampleData().catch(console.error);
