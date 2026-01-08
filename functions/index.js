const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const cheerio = require('cheerio');
const Parser = require('rss-parser');
const parser = new Parser({
    headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    }
});

// Firebase Admin 초기화
admin.initializeApp();
const db = admin.firestore();

/**
 * 주요 언론사 목록 (Major News Outlets)
 * 이 목록에 포함된 언론사의 기사만 카운트됩니다.
 * 관리자 페이지에서 수정 가능
 */
const MAJOR_OUTLETS = [
    // 종합일간지 (National Dailies)
    '조선일보', '중앙일보', '동아일보', '한겨레', '경향신문',
    '한국일보', '서울신문', '세계일보', '국민일보', '문화일보',

    // 경제지 (Economic)
    '매일경제', '한국경제', '서울경제', '파이낸셜뉴스', '머니투데이',
    '이데일리', '아시아경제', '헤럴드경제', '뉴스1', '뉴시스',

    // 방송사 (Broadcasting)
    'KBS', 'MBC', 'SBS', 'JTBC', 'MBN', 'YTN', '연합뉴스TV', 'TV조선',
    '채널A', 'CBS', '연합뉴스',

    // IT/기술 전문지 (IT/Tech)
    '전자신문', '디지털타임스', '디지털데일리', '지디넷코리아', '블로터',
    '아이뉴스24', 'IT동아', '테크월드', '바이라인네트워크', 'AI타임스',

    // 주요 온라인 (Major Online)
    '오마이뉴스', '프레시안', '미디어오늘', '더팩트', '스포츠조선',
    '스포츠동아', '일간스포츠', '데일리안', 'SBS Biz', '비즈워치',
    '이투데이', '조선비즈', '한경비즈니스', '뉴스웨이', '노컷뉴스',
    '시사저널'
];

/**
 * 언론사명으로 주요 언론사 여부 확인
 * @param {string} source - 기사 출처 (언론사명)
 * @returns {boolean} - 주요 언론사 여부
 */
function isMajorOutlet(source) {
    if (!source) return false;
    const sourceLower = source.toLowerCase();
    return MAJOR_OUTLETS.some(outlet =>
        sourceLower.includes(outlet.toLowerCase()) ||
        outlet.toLowerCase().includes(sourceLower)
    );
}

/**
 * URL에서 언론사명 추출
 * @param {string} url - 기사 URL
 * @returns {string} - 추출된 언론사명
 */
function extractOutletFromUrl(url) {
    if (!url) return '';
    try {
        const domain = new URL(url).hostname.replace('www.', '');

        // 도메인 -> 언론사명 매핑
        const domainMap = {
            // 종합일간지
            'chosun.com': '조선일보', 'joongang.co.kr': '중앙일보',
            'donga.com': '동아일보', 'hani.co.kr': '한겨레',
            'khan.co.kr': '경향신문', 'hankookilbo.com': '한국일보',
            'segye.com': '세계일보', 'munhwa.com': '문화일보',
            'kmib.co.kr': '국민일보', 'seoul.co.kr': '서울신문',

            // 경제지
            'mk.co.kr': '매일경제', 'hankyung.com': '한국경제',
            'sedaily.com': '서울경제', 'fnnews.com': '파이낸셜뉴스',
            'mt.co.kr': '머니투데이', 'edaily.co.kr': '이데일리',
            'asiae.co.kr': '아시아경제', 'heraldcorp.com': '헤럴드경제',
            'news1.kr': '뉴스1', 'newsis.com': '뉴시스',

            // 방송사
            'yna.co.kr': '연합뉴스', 'kbs.co.kr': 'KBS',
            'imbc.com': 'MBC', 'sbs.co.kr': 'SBS',
            'jtbc.co.kr': 'JTBC', 'mbn.co.kr': 'MBN',
            'ytn.co.kr': 'YTN', 'yonhapnewstv.co.kr': '연합뉴스TV',
            'tvchosun.com': 'TV조선', 'ichannela.com': '채널A',

            // IT/기술 전문지
            'etnews.com': '전자신문', 'dt.co.kr': '디지털타임스',
            'ddaily.co.kr': '디지털데일리', 'zdnet.co.kr': '지디넷코리아',
            'bloter.net': '블로터', 'inews24.com': '아이뉴스24',
            'it.donga.com': 'IT동아', 'aitimes.com': 'AI타임스',
            'byline.network': '바이라인네트워크',

            // 주요 온라인
            'nocutnews.co.kr': '노컷뉴스', 'etoday.co.kr': '이투데이',
            'bizwatch.co.kr': '비즈워치', 'newsway.co.kr': '뉴스웨이',
            'tf.co.kr': '더팩트', 'news.tf.co.kr': '더팩트',
            'ohmynews.com': '오마이뉴스', 'pressian.com': '프레시안',
            'mediatoday.co.kr': '미디어오늘', 'dailian.co.kr': '데일리안',
            'biz.chosun.com': '조선비즈', 'sbiz.heraldcorp.com': '헤럴드경제',

            // 스포츠
            'sportschosun.com': '스포츠조선', 'sports.donga.com': '스포츠동아',
            'isplus.com': '일간스포츠',

            // 시사/종합
            'sisajournal-e.com': '시사저널'
        };

        for (const [d, name] of Object.entries(domainMap)) {
            if (domain.includes(d)) return name;
        }
        return domain;
    } catch (e) {
        return '';
    }
}

/**
 * 뉴스 크롤링 함수
 * 등록된 키워드에 대해 Google News와 Naver News에서 데이터 수집
 */
exports.collectNewsData = functions
    .region('asia-northeast3') // 서울 리전
    .pubsub.schedule('every 1 hours') // 매 시간마다 실행
    .timeZone('Asia/Seoul')
    .onRun(async (context) => {
        console.log('뉴스 수집 시작:', new Date().toISOString());

        try {
            // 1. 활성화된 키워드 가져오기
            const keywordsSnapshot = await db.collection('keywords').get();
            const keywords = keywordsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            console.log(`수집할 키워드 ${keywords.length}개 발견`);

            // 2. 각 키워드에 대해 데이터 수집
            for (const keyword of keywords) {
                await collectKeywordData(keyword);
            }

            console.log('뉴스 수집 완료');
            return null;
        } catch (error) {
            console.error('뉴스 수집 오류:', error);
            throw error;
        }
    });

/**
 * 특정 키워드에 대한 데이터 수집
 */
async function collectKeywordData(keyword) {
    console.log(`키워드 "${keyword.name}" 수집 중...`);

    try {
        // Google News 검색
        const googleResults = await searchGoogleNews(keyword.name);

        // Naver News 검색  
        const naverResults = await searchNaverNews(keyword.name);

        // 결과를 Firestore에 저장
        const batch = db.batch();

        const totalCount = googleResults.length + naverResults.length;

        // Google News 결과 저장
        if (googleResults.length > 0) {
            const googleDocRef = db.collection('data').doc();
            batch.set(googleDocRef, {
                keyword: keyword.name,
                source: '구글 뉴스',
                count: googleResults.length,
                sentiment: analyzeSentiment(googleResults),
                timestamp: admin.firestore.Timestamp.now(),
                url: `https://news.google.com/search?q=${encodeURIComponent(keyword.name)}`
            });
        }

        // Naver News 결과 저장
        if (naverResults.length > 0) {
            const naverDocRef = db.collection('data').doc();
            batch.set(naverDocRef, {
                keyword: keyword.name,
                source: '네이버 뉴스',
                count: naverResults.length,
                sentiment: analyzeSentiment(naverResults),
                timestamp: admin.firestore.Timestamp.now(),
                url: `https://search.naver.com/search.naver?query=${encodeURIComponent(keyword.name)}`
            });
        }

        await batch.commit();
        console.log(`키워드 "${keyword.name}" 수집 완료 (총 ${totalCount}건)`);

        // 🆕 급증 감지 및 알림 (기사 정보도 함께 전달)
        const allArticles = [...googleResults, ...naverResults];
        await checkAndNotifySpike(keyword.name, totalCount, allArticles);

        return totalCount; // 수집된 기사 개수 반환
    } catch (error) {
        console.error(`키워드 "${keyword.name}" 수집 오류:`, error);
        return 0; // 오류 시 0 반환
    }
}

/**
 * 🆕 급증 감지 및 알림 함수 (기사 샘플 포함)
 */
async function checkAndNotifySpike(keyword, currentCount, articles) {
    try {
        // 지난 24시간 평균 구하기
        const yesterday = new Date();
        yesterday.setHours(yesterday.getHours() - 24);

        const recentData = await db.collection('data')
            .where('keyword', '==', keyword)
            .where('date', '>', admin.firestore.Timestamp.fromDate(yesterday))
            .get();

        if (recentData.empty || recentData.size < 3) {
            // 데이터가 충분하지 않으면 알림 안 함
            return;
        }

        const counts = recentData.docs.map(doc => doc.data().count);
        const average = counts.reduce((a, b) => a + b, 0) / counts.length;

        // 평균의 2배 이상이면 급증으로 판단
        const spikeThreshold = average * 2;

        if (currentCount >= spikeThreshold) {
            console.log(`🔔 급증 감지! 키워드: ${keyword}, 현재: ${currentCount}, 평균: ${average.toFixed(1)}`);

            // 최신순 5개
            const recentArticles = getRecentArticles(articles, 5);

            // 랜덤 5개 (최신순과 중복되지 않도록)
            const remainingArticles = articles.filter(
                a => !recentArticles.some(r => r.link === a.link)
            );
            const randomArticles = getRandomArticles(remainingArticles, 5);

            // 합쳐서 총 10개 (최신 5 + 랜덤 5)
            const sampleArticles = [...recentArticles, ...randomArticles].map(article => ({
                title: article.title,
                link: article.link,
                pubDate: article.pubDate,
                source: article.source || 'Unknown',
                type: recentArticles.includes(article) ? 'recent' : 'random'
            }));

            // Firestore에 알림 저장 (기사 샘플 포함)
            await db.collection('alerts').add({
                keyword: keyword,
                currentCount: currentCount,
                averageCount: Math.round(average),
                increaseRate: Math.round((currentCount / average - 1) * 100),
                timestamp: admin.firestore.Timestamp.now(),
                read: false,
                articles: sampleArticles  // 🆕 급증 시점의 기사 10개 (최신 5 + 랜덤 5)
            });

            console.log(`📰 알림에 ${sampleArticles.length}개 기사 저장 (최신 ${recentArticles.length} + 랜덤 ${randomArticles.length})`);

            // TODO: 실제 이메일/Slack 알림 전송
            // await sendEmailNotification(keyword, currentCount, average, sampleArticles);
        }
    } catch (error) {
        console.error('급증 감지 오류:', error);
    }
}

/**
 * 최신 기사 선택 (날짜순 정렬)
 */
function getRecentArticles(articles, count) {
    if (articles.length <= count) return articles;

    // 발행 시간 기준으로 최신순 정렬
    const sorted = [...articles].sort((a, b) => {
        const dateA = new Date(a.pubDate);
        const dateB = new Date(b.pubDate);
        return dateB - dateA; // 최신순
    });

    return sorted.slice(0, count);
}

/**
 * 랜덤 기사 선택
 */
function getRandomArticles(articles, count) {
    if (articles.length <= count) return articles;

    // Fisher-Yates 셔플 알고리즘
    const shuffled = [...articles];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled.slice(0, count);
}

/**
 * Google News 검색 (지난 24시간만)
 */
async function searchGoogleNews(keyword, targetDateStr = null) {
    try {
        // 오늘 날짜 (한국 시간 기준) 또는 지정된 날짜
        let todayDateStr;
        if (targetDateStr) {
            todayDateStr = targetDateStr; // YYYY-MM-DD 형식
        } else {
            const now = new Date();
            const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
            todayDateStr = `${koreaTime.getFullYear()}-${String(koreaTime.getMonth() + 1).padStart(2, '0')}-${String(koreaTime.getDate()).padStart(2, '0')}`;
        }

        const searchUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=ko&gl=KR&ceid=KR:ko`;

        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });

        const $ = cheerio.load(response.data, { xmlMode: true });
        const items = [];
        const keywordLower = keyword.toLowerCase();

        $('item').each((i, elem) => {
            const pubDateStr = $(elem).find('pubDate').text();
            const pubDate = new Date(pubDateStr);
            const title = $(elem).find('title').text();
            const titleLower = title.toLowerCase();

            // Google News RSS에서 source 태그로 언론사명 추출
            const sourceTag = $(elem).find('source').text();

            // 기사 발행일을 한국 시간으로 변환
            const articleKoreaTime = new Date(pubDate.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
            const articleDateStr = `${articleKoreaTime.getFullYear()}-${String(articleKoreaTime.getMonth() + 1).padStart(2, '0')}-${String(articleKoreaTime.getDate()).padStart(2, '0')}`;

            // **해당일 기사만** + **주요 언론사만** (제목 키워드 조건 제거 - 네이버와 동일)
            // Google RSS 자체가 이미 키워드 관련 기사만 반환하므로 제목 체크 불필요
            if (articleDateStr === todayDateStr &&
                isMajorOutlet(sourceTag)) {
                items.push({
                    title: title,
                    link: $(elem).find('link').text(),
                    pubDate: pubDateStr,
                    source: 'Google News',
                    outlet: sourceTag
                });
            }
        });

        console.log(`Google News: ${items.length}개 (오늘 + 주요언론사)`);
        return items;
    } catch (error) {
        console.error('Google News 검색 오류:', error.message);
        return [];
    }
}

/**
 * Naver News 검색 (지난 24시간만)
 */
async function searchNaverNews(keyword, targetDateStr = null) {
    try {
        // 오늘 날짜 (한국 시간 기준) 또는 지정된 날짜
        let todayDateStr;
        if (targetDateStr) {
            todayDateStr = targetDateStr; // YYYY-MM-DD 형식
        } else {
            const now = new Date();
            const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
            todayDateStr = `${koreaTime.getFullYear()}-${String(koreaTime.getMonth() + 1).padStart(2, '0')}-${String(koreaTime.getDate()).padStart(2, '0')}`;
        }

        // Firebase Functions Config에서 API 키 가져오기
        const clientId = functions.config().naver.client_id;
        const clientSecret = functions.config().naver.client_secret;

        const searchUrl = 'https://openapi.naver.com/v1/search/news.json';
        const response = await axios.get(searchUrl, {
            params: {
                query: keyword,
                display: 100, // 더 많이 가져와서 필터링
                sort: 'date'
            },
            headers: {
                'X-Naver-Client-Id': clientId,
                'X-Naver-Client-Secret': clientSecret
            },
            timeout: 10000
        });

        const keywordLower = keyword.toLowerCase();

        // **해당일 기사만** + **주요 언론사만** (MAJOR_OUTLETS 목록 기준)
        const filteredItems = response.data.items.filter(item => {
            // Naver API pubDate 형식: "Thu, 19 Dec 2024 16:30:00 +0900"
            const pubDate = new Date(item.pubDate);
            // 기사 발행일을 한국 시간으로 변환
            const articleKoreaTime = new Date(pubDate.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
            const articleDateStr = `${articleKoreaTime.getFullYear()}-${String(articleKoreaTime.getMonth() + 1).padStart(2, '0')}-${String(articleKoreaTime.getDate()).padStart(2, '0')}`;

            const titleClean = item.title.replace(/<[^>]*>/g, '').toLowerCase();

            // MAJOR_OUTLETS 목록에 있는 언론사만 카운트 (네이버 제휴 여부 무시)
            const outlet = extractOutletFromUrl(item.originallink || item.link);
            const isMajor = isMajorOutlet(outlet);

            // 오늘 날짜 + 주요언론사 (MAJOR_OUTLETS 목록 기준)
            return articleDateStr === todayDateStr && isMajor;
        });

        // Naver API 응답 형식을 Google News와 동일하게 변환
        const results = filteredItems.map(item => {
            const outlet = extractOutletFromUrl(item.originallink || item.link);
            return {
                title: item.title.replace(/<[^>]*>/g, ''), // HTML 태그 제거
                link: item.link,
                pubDate: item.pubDate,
                source: 'Naver News',
                outlet: outlet
            };
        });

        console.log(`Naver News: ${results.length}개 (오늘 + 주요언론사)`);
        return results;

    } catch (error) {
        console.error('Naver News 검색 오류:', error.message);
        console.error('Error details:', error.response?.data || error);
        return [];
    }
}

/**
 * 간단한 감정 분석
 */
function analyzeSentiment(articles) {
    if (articles.length === 0) return 'neutral';

    // 간단한 키워드 기반 감정 분석
    const positiveWords = ['성공', '증가', '상승', '긍정', '호조', '성장'];
    const negativeWords = ['실패', '감소', '하락', '부정', '악화', '위기'];

    let positiveCount = 0;
    let negativeCount = 0;

    articles.forEach(article => {
        const title = article.title.toLowerCase();
        positiveWords.forEach(word => {
            if (title.includes(word)) positiveCount++;
        });
        negativeWords.forEach(word => {
            if (title.includes(word)) negativeCount++;
        });
    });

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
}

/**
 * 수동 트리거 함수 (테스트용)
 */
exports.collectNewsManual = functions
    .region('asia-northeast3')
    .https.onRequest(async (req, res) => {
        // CORS 헤더 추가
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type');

        // OPTIONS 요청 처리 (preflight)
        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }

        console.log('수동 뉴스 수집 시작');

        try {
            const keywordsSnapshot = await db.collection('keywords').get();
            const keywords = keywordsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            let totalCount = 0;
            for (const keyword of keywords) {
                const count = await collectKeywordData(keyword);
                totalCount += count || 0;
            }

            res.json({
                success: true,
                message: `${keywords.length}개 키워드에 대한 데이터 수집 완료`,
                keywordCount: keywords.length,
                totalCount: totalCount,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('수동 수집 오류:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

/**
 * 🆕 알림 목록 조회 API
 */
exports.getAlerts = functions
    .region('asia-northeast3')
    .https.onRequest(async (req, res) => {
        try {
            // CORS 헤더 추가
            res.set('Access-Control-Allow-Origin', '*');

            const alertsSnapshot = await db.collection('alerts')
                .orderBy('timestamp', 'desc')
                .limit(20)
                .get();

            const alerts = alertsSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
                timestamp: doc.data().timestamp.toDate().toISOString()
            }));

            res.json({
                success: true,
                alerts: alerts,
                count: alerts.length
            });
        } catch (error) {
            console.error('알림 조회 오류:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

/**
 * 🆕 통계 데이터 조회 API
 */
exports.getStatistics = functions
    .region('asia-northeast3')
    .https.onRequest(async (req, res) => {
        try {
            // CORS 헤더 추가
            res.set('Access-Control-Allow-Origin', '*');

            const days = parseInt(req.query.days) || 7;
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            const dataSnapshot = await db.collection('data')
                .where('date', '>', admin.firestore.Timestamp.fromDate(startDate))
                .get();

            // 키워드별 통계 집계
            const stats = {};
            dataSnapshot.docs.forEach(doc => {
                const data = doc.data();
                if (!stats[data.keyword]) {
                    stats[data.keyword] = {
                        keyword: data.keyword,
                        totalCount: 0,
                        sources: {},
                        sentiments: { positive: 0, negative: 0, neutral: 0 }
                    };
                }
                stats[data.keyword].totalCount += data.count;
                stats[data.keyword].sources[data.source] =
                    (stats[data.keyword].sources[data.source] || 0) + data.count;
                stats[data.keyword].sentiments[data.sentiment]++;
            });

            res.json({
                success: true,
                period: `${days}일`,
                statistics: Object.values(stats),
                totalDataPoints: dataSnapshot.size
            });
        } catch (error) {
            console.error('통계 조회 오류:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

/**
 * 🆕 급증 키워드의 최신 뉴스 조회 API
 */
exports.getTrendingNews = functions
    .region('asia-northeast3')
    .https.onRequest(async (req, res) => {
        try {
            // CORS 헤더 추가
            res.set('Access-Control-Allow-Origin', '*');

            const keyword = req.query.keyword;

            if (!keyword) {
                return res.status(400).json({
                    success: false,
                    error: '키워드를 지정해주세요 (예: ?keyword=ChatGPT)'
                });
            }

            console.log(`급증 뉴스 조회: ${keyword}`);

            // Google News와 Naver News에서 최신 뉴스 검색
            const [googleNews, naverNews] = await Promise.all([
                searchGoogleNews(keyword),
                searchNaverNews(keyword)
            ]);

            // 모든 뉴스를 합쳐서 날짜순 정렬
            const allNews = [
                ...googleNews.map(item => ({ ...item, source: 'Google News' })),
                ...naverNews.map(item => ({ ...item, source: 'Naver News' }))
            ];

            // 최신순 정렬 (상위 20개)
            const sortedNews = allNews.slice(0, 20);

            res.json({
                success: true,
                keyword: keyword,
                totalCount: allNews.length,
                news: sortedNews,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('급증 뉴스 조회 오류:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

/**
 * 데이터 정리 함수 (30일 이상 된 데이터 삭제)
 */
exports.cleanOldData = functions
    .region('asia-northeast3')
    .pubsub.schedule('every 24 hours')
    .timeZone('Asia/Seoul')
    .onRun(async (context) => {
        console.log('오래된 데이터 정리 시작');

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const oldDataSnapshot = await db.collection('data')
            .where('date', '<', admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
            .get();

        const batch = db.batch();
        oldDataSnapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
        });

        await batch.commit();
        console.log(`${oldDataSnapshot.size}개의 오래된 데이터 삭제 완료`);

        return null;
    });

/**
 * IXIO 전용 데이터 수집 (특정 날짜)
 */
exports.collectIxioData = functions
    .region('asia-northeast3')
    .https.onRequest(async (req, res) => {
        // CORS 헤더
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }

        const dateParam = req.query.date; // YYYY-MM-DD
        const keywords = ['ixio', 'ixi-o', '익시오'];

        try {
            // 한국 시간 기준으로 날짜 계산
            let targetDate;
            let dateKey;

            if (dateParam) {
                // 파라미터로 날짜가 넘어온 경우 (수동 수집)
                dateKey = dateParam; // "2025-12-19" 형식
                targetDate = new Date(dateParam + 'T00:00:00+09:00');
            } else {
                // 파라미터 없으면 오늘 (한국 시간 기준)
                const now = new Date();
                const koreanOffset = 9 * 60; // 한국은 UTC+9
                const koreanTime = new Date(now.getTime() + koreanOffset * 60 * 1000);
                dateKey = formatDateKey(koreanTime);
                targetDate = koreanTime;
            }

            console.log(`IXIO 데이터 수집 시작...`);

            let allGoogleArticles = [];
            let allNaverArticles = [];

            // 각 키워드별로 수집
            for (const keyword of keywords) {
                const googleResults = await searchGoogleNews(keyword, dateKey);
                const naverResults = await searchNaverNews(keyword, dateKey);

                allGoogleArticles = allGoogleArticles.concat(googleResults);
                allNaverArticles = allNaverArticles.concat(naverResults);
            }

            // 기사를 발행일별로 그룹화
            const groupByDate = (articles) => {
                const grouped = {};
                articles.forEach(article => {
                    // 기사 발행일 추출 (한국 시간 기준)
                    const pubDate = new Date(article.pubDate);
                    const koreanTime = new Date(pubDate.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
                    const articleDateKey = `${koreanTime.getFullYear()}-${String(koreanTime.getMonth() + 1).padStart(2, '0')}-${String(koreanTime.getDate()).padStart(2, '0')}`;

                    if (!grouped[articleDateKey]) {
                        grouped[articleDateKey] = [];
                    }
                    grouped[articleDateKey].push(article);
                });
                return grouped;
            };

            const googleByDate = groupByDate(allGoogleArticles);
            const naverByDate = groupByDate(allNaverArticles);

            // 모든 날짜 수집
            const allDates = new Set([...Object.keys(googleByDate), ...Object.keys(naverByDate)]);

            const batch = db.batch();
            let savedDates = [];

            for (const dateKey of allDates) {
                const targetDate = new Date(dateKey + 'T00:00:00+09:00');
                const googleArticles = googleByDate[dateKey] || [];
                const naverArticles = naverByDate[dateKey] || [];

                // 🆕 기존 데이터 먼저 불러오기 (삭제하지 않고 병합)
                const existingDocs = await db.collection('ixioData')
                    .where('dateKey', '==', dateKey)
                    .get();

                // 기존 기사들 URL 맵 생성
                const existingArticlesMap = new Map();
                let existingDocRef = null;
                let existingData = null;

                existingDocs.forEach(doc => {
                    existingDocRef = doc.ref;
                    existingData = doc.data();
                    const existingArticles = existingData.articles || [];

                    existingArticles.forEach(article => {
                        let normalizedUrl = article.link || article.url || '';
                        try {
                            normalizedUrl = normalizedUrl.split('?')[0];
                        } catch (e) { }
                        if (normalizedUrl) {
                            existingArticlesMap.set(normalizedUrl, article);
                        }
                    });
                });

                const existingCount = existingArticlesMap.size;
                console.log(`${dateKey}: 기존 ${existingCount}건 보유`);

                // 새 기사들 URL 정규화 및 병합
                const allNewArticles = [...googleArticles, ...naverArticles];
                let newArticlesAdded = 0;

                allNewArticles.forEach(article => {
                    let normalizedUrl = article.link;
                    try {
                        if (article.link && article.link.includes('news.naver.com') && article.originallink) {
                            normalizedUrl = article.originallink;
                        }
                        normalizedUrl = normalizedUrl.split('?')[0];
                    } catch (e) { }

                    // 기존에 없는 기사만 추가
                    if (!existingArticlesMap.has(normalizedUrl)) {
                        existingArticlesMap.set(normalizedUrl, article);
                        newArticlesAdded++;
                    }
                });

                const mergedArticles = Array.from(existingArticlesMap.values());
                const finalCount = mergedArticles.length;

                console.log(`${dateKey}: 새로 ${newArticlesAdded}건 추가 → 최종 ${finalCount}건`);

                // 기존 문서 업데이트 또는 새 문서 생성 (기사가 늘었을 때만)
                if (finalCount > 0 && (finalCount > existingCount || !existingDocRef)) {
                    if (existingDocRef) {
                        // 기존 문서 업데이트
                        batch.update(existingDocRef, {
                            count: finalCount,
                            articles: mergedArticles,
                            metadata: {
                                originalCount: existingCount,
                                newArticlesAdded: newArticlesAdded,
                                mergedAt: admin.firestore.Timestamp.now()
                            },
                            lastUpdated: admin.firestore.Timestamp.now()
                        });
                    } else {
                        // 새 문서 생성
                        const newDocRef = db.collection('ixioData').doc();
                        batch.set(newDocRef, {
                            dateKey: dateKey,
                            date: admin.firestore.Timestamp.fromDate(targetDate),
                            source: 'Naver News',
                            count: finalCount,
                            articles: mergedArticles,
                            metadata: {
                                originalGoogleCount: googleArticles.length,
                                originalNaverCount: naverArticles.length,
                                mergedAt: admin.firestore.Timestamp.now()
                            },
                            timestamp: admin.firestore.Timestamp.now()
                        });
                    }
                }

                savedDates.push({
                    date: dateKey,
                    google: googleArticles.length,
                    naver: naverArticles.length,
                    existing: existingCount,
                    added: newArticlesAdded,
                    final: finalCount
                });
            }

            await batch.commit();

            // 총계 계산
            let totalGoogle = 0, totalNaver = 0;
            savedDates.forEach(d => {
                totalGoogle += d.google;
                totalNaver += d.naver;
            });

            res.json({
                success: true,
                message: '기사 발행일 기준으로 저장됨',
                dates: savedDates,
                totalGoogle: totalGoogle,
                totalNaver: totalNaver,
                grandTotal: totalGoogle + totalNaver
            });

        } catch (error) {
            console.error('IXIO 데이터 수집 오류:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    });

// 날짜 포맷 함수
function formatDateKey(date) {
    // 한국 시간 기준 (Functions는 UTC로 실행되므로 명시적 변환)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 2시간마다 IXIO 데이터 자동 수집
 * - 짝수 시간(0, 2, 4, ... 22시)에 실행
 * - 오늘 날짜 기사를 수집하여 병합
 * - 자정(0시)에는 어제 데이터도 최종 확정
 */
exports.ixioAutoCollection = functions
    .region('asia-northeast3')
    .pubsub.schedule('0 */2 * * *') // 매 2시간마다 (0, 2, 4, ... 22시)
    .timeZone('Asia/Seoul')
    .onRun(async (context) => {
        const now = new Date();
        const koreanTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const currentHour = koreanTime.getHours();

        console.log(`IXIO 2시간 자동 수집 시작... (${currentHour}시)`);

        try {
            const keywords = ['ixio', 'ixi-o', '익시오'];

            // 오늘 날짜 (한국 시간 기준)
            const todayDateStr = formatDateKey(koreanTime);
            const todayDate = new Date(todayDateStr + 'T00:00:00+09:00');

            let allGoogleArticles = [];
            let allNaverArticles = [];

            // 각 키워드별로 수집
            for (const keyword of keywords) {
                const googleResults = await searchGoogleNews(keyword, todayDateStr);
                const naverResults = await searchNaverNews(keyword, todayDateStr);

                allGoogleArticles = allGoogleArticles.concat(googleResults);
                allNaverArticles = allNaverArticles.concat(naverResults);
            }

            // 🆕 기존 데이터와 병합 (collectIxioData와 동일한 로직)
            const existingDocs = await db.collection('ixioData')
                .where('dateKey', '==', todayDateStr)
                .get();

            const existingArticlesMap = new Map();
            let existingDocRef = null;

            existingDocs.forEach(doc => {
                existingDocRef = doc.ref;
                const existingData = doc.data();
                const existingArticles = existingData.articles || [];

                existingArticles.forEach(article => {
                    let normalizedUrl = article.link || article.url || '';
                    try { normalizedUrl = normalizedUrl.split('?')[0]; } catch (e) { }
                    if (normalizedUrl) {
                        existingArticlesMap.set(normalizedUrl, article);
                    }
                });
            });

            const existingCount = existingArticlesMap.size;

            // 새 기사 병합
            const allNewArticles = [...allGoogleArticles, ...allNaverArticles];
            let newArticlesAdded = 0;

            allNewArticles.forEach(article => {
                let normalizedUrl = article.link;
                try {
                    if (article.link && article.link.includes('news.naver.com') && article.originallink) {
                        normalizedUrl = article.originallink;
                    }
                    normalizedUrl = normalizedUrl.split('?')[0];
                } catch (e) { }

                if (!existingArticlesMap.has(normalizedUrl)) {
                    existingArticlesMap.set(normalizedUrl, article);
                    newArticlesAdded++;
                }
            });

            const mergedArticles = Array.from(existingArticlesMap.values());
            const finalCount = mergedArticles.length;

            console.log(`${todayDateStr}: 기존 ${existingCount} + 신규 ${newArticlesAdded} = 최종 ${finalCount}건`);

            // 데이터 저장/업데이트
            if (finalCount > 0 && (finalCount > existingCount || !existingDocRef)) {
                if (existingDocRef) {
                    await existingDocRef.update({
                        count: finalCount,
                        articles: mergedArticles,
                        metadata: {
                            originalCount: existingCount,
                            newArticlesAdded: newArticlesAdded,
                            lastUpdated: admin.firestore.Timestamp.now(),
                            updateHour: currentHour
                        },
                        lastUpdated: admin.firestore.Timestamp.now()
                    });
                } else {
                    await db.collection('ixioData').add({
                        dateKey: todayDateStr,
                        date: admin.firestore.Timestamp.fromDate(todayDate),
                        source: 'Naver News',
                        count: finalCount,
                        articles: mergedArticles,
                        metadata: {
                            originalGoogleCount: allGoogleArticles.length,
                            originalNaverCount: allNaverArticles.length,
                            createdAt: admin.firestore.Timestamp.now()
                        },
                        timestamp: admin.firestore.Timestamp.now(),
                        auto: true
                    });
                }
            }

            // 자정(0시)에는 어제 데이터도 최종 확정 수집
            if (currentHour === 0) {
                const yesterday = new Date(koreanTime);
                yesterday.setDate(yesterday.getDate() - 1);
                const yesterdayDateStr = formatDateKey(yesterday);

                console.log(`자정 최종 확정: ${yesterdayDateStr}`);

                // 어제 데이터 재수집 (최종)
                for (const keyword of keywords) {
                    await searchGoogleNews(keyword, yesterdayDateStr);
                    await searchNaverNews(keyword, yesterdayDateStr);
                }
            }

            console.log(`IXIO 자동 수집 완료: ${todayDateStr} (${currentHour}시)`);
            return { success: true, date: todayDateStr, count: finalCount };

        } catch (error) {
            console.error('IXIO 자동 수집 오류:', error);
            return { success: false, error: error.message };
        }
    });

/**
 * 랜덤 기사 선택
 */
function selectRandomArticles(articles, count) {
    if (articles.length <= count) {
        return articles;
    }

    const shuffled = [...articles].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

// ==============================================================
// 🌐 GLOBAL NEWS MONITORING - Multi-keyword, Multi-language
// ==============================================================

/**
 * 언어별 Google News 설정
 */
const LANGUAGE_CONFIG = {
    en: { hl: 'en', gl: 'US', ceid: 'US:en', name: 'English', tz: 'America/New_York' },
    ms: { hl: 'ms', gl: 'MY', ceid: 'MY:ms', name: 'Malay', tz: 'Asia/Kuala_Lumpur' },
    id: { hl: 'id', gl: 'ID', ceid: 'ID:id', name: 'Indonesian', tz: 'Asia/Jakarta' },
    'pt-BR': { hl: 'pt-BR', gl: 'BR', ceid: 'BR:pt-BR', name: 'Portuguese (Brazil)', tz: 'America/Sao_Paulo' },
    ja: { hl: 'ja', gl: 'JP', ceid: 'JP:ja', name: 'Japanese', tz: 'Asia/Tokyo' },
    ar: { hl: 'ar', gl: 'SA', ceid: 'SA:ar', name: 'Arabic', tz: 'Asia/Riyadh' }
};

/**
 * 기본 필터 키워드 (포함 대상 - 빈 배열이면 모든 기사 수집)
 */
const DEFAULT_FILTER_KEYWORDS = [];

/**
 * 기본 제외 키워드 (빈 배열이면 제외 없음)
 */
const DEFAULT_EXCLUDE_KEYWORDS = [];

/**
 * 기사 필터링 함수 (포함 필터 - Whitelist / OR 조건)
 * @param {object} article - 기사 객체
 * @param {string[]} filterKeywords - 포함할 키워드 목록
 * @returns {boolean} - true면 포함(키워드 포함됨), false면 제외(키워드 없음)
 */
function shouldIncludeArticle(article, filterKeywords) {
    // 필터 키워드가 없으면 모든 기사 포함
    if (!filterKeywords || filterKeywords.length === 0) return true;
    if (!article.title) return false;
    const titleLower = article.title.toLowerCase();

    // 키워드 중 하나라도 포함되면 포함 (true) - OR 조건
    return filterKeywords.some(keyword => titleLower.includes(keyword.toLowerCase()));
}

/**
 * 기사 제외 필터링 함수 (제외 필터 - Blacklist / OR 조건)
 * @param {object} article - 기사 객체
 * @param {string[]} excludeKeywords - 제외할 키워드 목록
 * @returns {boolean} - true면 제외(키워드 포함됨), false면 유지(키워드 없음)
 */
function shouldExcludeArticle(article, excludeKeywords) {
    // 제외 키워드가 없으면 제외하지 않음
    if (!excludeKeywords || excludeKeywords.length === 0) return false;
    if (!article.title) return false;
    const titleLower = article.title.toLowerCase();

    // 키워드 중 하나라도 포함되면 제외 (true) - OR 조건
    return excludeKeywords.some(keyword => titleLower.includes(keyword.toLowerCase()));
}

/**
 * 통합 필터링 함수 (포함 + 제외)
 * @param {object} article - 기사 객체
 * @param {string[]} filterKeywords - 포함할 키워드 목록
 * @param {string[]} excludeKeywords - 제외할 키워드 목록
 * @returns {boolean} - true면 최종 포함, false면 최종 제외
 */
function filterArticle(article, filterKeywords, excludeKeywords) {
    // 1. 먼저 제외 체크 (제외 대상이면 바로 false)
    if (shouldExcludeArticle(article, excludeKeywords)) return false;

    // 2. 포함 체크
    return shouldIncludeArticle(article, filterKeywords);
}

/**
 * 다국어 Google News 검색
 * @param {string} keyword - 검색 키워드
 * @param {string} langCode - 언어 코드 (en, ms, id, pt-BR, ja, ar)
 * @param {string} targetDateStr - YYYY-MM-DD 형식 (null이면 오늘)
 * @param {boolean} disableLocalFilter - true면 날짜 필터링 없이 모든 기사 반환 (벌크 백필용)
 */
async function searchGlobalGoogleNews(keyword, langCode, targetDateStr = null, disableLocalFilter = false) {
    try {
        const langConfig = LANGUAGE_CONFIG[langCode] || LANGUAGE_CONFIG.en;

        // 날짜 결정
        let todayDateStr;
        const now = new Date();
        const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const currentKoreaDateStr = formatDateKey(koreaTime);

        if (targetDateStr) {
            todayDateStr = targetDateStr;
        } else {
            todayDateStr = currentKoreaDateStr;
        }

        // URL 포맷 변경: 공식 RSS 엔드포인트 사용 (rss/search)
        let queryParams = `q=${encodeURIComponent(keyword)}`;

        // Backfill인 경우 (오늘이 아닌 과거 확인 시)에만 after/before 추가
        // '오늘' 검색 시에는 추가하지 않음 -> 503 에러 방지 및 최신 뉴스 우선
        if (targetDateStr && targetDateStr !== currentKoreaDateStr) {
            const targetDate = new Date(targetDateStr);
            const afterDate = new Date(targetDate);
            const beforeDate = new Date(targetDate);
            beforeDate.setDate(beforeDate.getDate() + 2); // +2일로 넉넉하게

            const afterStr = afterDate.toISOString().split('T')[0];
            const beforeStr = beforeDate.toISOString().split('T')[0];

            queryParams += encodeURIComponent(` after:${afterStr} before:${beforeStr}`);
        }

        const searchUrl = `https://news.google.com/rss/search?${queryParams}&hl=${langConfig.hl}&gl=${langConfig.gl}&ceid=${langConfig.ceid}`;

        let feedData;
        let lastError;

        console.log(`[RSS 요청] URL: ${searchUrl}`);

        // 재시도 로직 (최대 3회)
        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                if (attempt > 1) {
                    const delay = Math.floor(Math.random() * 3000) + 2000;
                    console.log(`[RSS] 재시도 ${attempt}/3 - 대기 ${delay}ms`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }

                // 단순화된 헤더 (봇 탐지 우회)
                const response = await axios.get(searchUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
                        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
                    },
                    timeout: 15000,
                    maxRedirects: 5
                });

                console.log(`[RSS 응답] Status: ${response.status}, Data 길이: ${response.data?.length || 0}`);

                // 데이터가 XML인지 확인
                if (response.data && response.data.includes('<item>')) {
                    feedData = response.data;
                    console.log(`[RSS] 요청 성공 - XML with items detected`);
                    break;
                } else if (response.data && response.data.includes('<rss')) {
                    feedData = response.data;
                    console.log(`[RSS] 요청 성공 - RSS 구조 확인됨 (items 없을 수 있음)`);
                    break;
                } else {
                    console.log(`[RSS] 응답이 RSS가 아님: ${response.data?.substring?.(0, 200)}`);
                    lastError = new Error('Non-RSS response received');
                }
            } catch (error) {
                lastError = error;
                console.log(`[RSS 오류] ${attempt}/3 (${langCode}): ${error.message}`);
                if (error.response) {
                    console.log(`[RSS 오류 상세] Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)?.substring?.(0, 300)}`);
                }

                if (!error.message.includes('429') && !error.message.includes('503')) {
                    break;
                }
            }
        }

        if (!feedData) {
            console.log(`[RSS 실패] ${keyword} (${langCode}): 피드 데이터 없음`);
            throw lastError || new Error('RSS 데이터 수신 실패');
        }

        const $ = cheerio.load(feedData, { xmlMode: true });
        const items = [];

        $('item').each((i, elem) => {
            const title = $(elem).find('title').text();
            const link = $(elem).find('link').text();
            const pubDateStr = $(elem).find('pubDate').text();
            const sourceTag = $(elem).find('source').text() || 'Google News';
            const pubDate = new Date(pubDateStr);

            // 발행일을 한국 시간으로 변환
            const articleKoreaTime = new Date(pubDate.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
            const articleDateStr = formatDateKey(articleKoreaTime);

            // 현지 시간도 계산
            const localTime = new Date(pubDate.toLocaleString('en-US', { timeZone: langConfig.tz }));

            // 해당일 기사만 포함 (또는 disableLocalFilter=true면 모든 기사 반환)
            if (disableLocalFilter || articleDateStr === todayDateStr) {
                items.push({
                    title: title,
                    link: link,
                    pubDate: pubDateStr,
                    source: 'Google News',
                    outlet: sourceTag,
                    dateKey: articleDateStr,
                    timestamp: admin.firestore.Timestamp.fromDate(articleKoreaTime),
                    language: langCode,
                    koreaTime: articleKoreaTime.toISOString(),
                    localTime: localTime.toISOString()
                });
            }
        });

        console.log(`Global Google News 검색 완료 [${langCode}]: ${items.length}건 발견 (${todayDateStr})`);
        return items;

    } catch (error) {
        console.error(`Global Google News 검색 오류 [${langCode}]:`, error.message);
        return [];
    }
}

/**
 * 글로벌 뉴스 수집 API (수동 트리거)
 */
exports.collectGlobalNews = functions
    .region('asia-northeast3')
    .https.onRequest(async (req, res) => {
        // CORS
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }

        const taskId = req.query.taskId;
        const dateParam = req.query.date; // YYYY-MM-DD

        if (!taskId) {
            res.status(400).json({ success: false, error: 'taskId is required' });
            return;
        }

        try {
            // Task 정보 조회
            const taskDoc = await db.collection('globalTasks').doc(taskId).get();
            if (!taskDoc.exists) {
                res.status(404).json({ success: false, error: 'Task not found' });
                return;
            }

            const task = taskDoc.data();
            const keywords = task.keywords || [];
            // 다중 언어 지원
            const languages = Array.isArray(task.languages) ? task.languages : (task.language ? [task.language] : ['en']);
            const filterKeywords = task.filterKeywords || DEFAULT_FILTER_KEYWORDS;
            const excludeKeywords = task.excludeKeywords || DEFAULT_EXCLUDE_KEYWORDS;

            // 날짜 결정
            let dateKey;
            if (dateParam) {
                dateKey = dateParam;
            } else {
                const now = new Date();
                const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
                dateKey = formatDateKey(koreaTime);
            }

            console.log(`글로벌 뉴스 수집 시작: Task=${taskId}, Langs=${languages.join(',')}, Date=${dateKey}`);

            let allArticles = [];

            // 각 언어별로 키워드를 묶어서 수집 (API 호출 최적화)
            for (const language of languages) {
                if (keywords.length > 0) {
                    // 키워드를 5개씩 묶어서 처리 (URL 길이 및 복잡도 고려)
                    const chunkSize = 5;
                    for (let i = 0; i < keywords.length; i += chunkSize) {
                        const chunk = keywords.slice(i, i + chunkSize);
                        // "A" OR "B" 형태로 결합
                        const combinedQuery = chunk.map(w => `${w}`).join(' OR ');

                        console.log(`구글 뉴스 검색 요청 [${language}]: ${combinedQuery}`);
                        // 수동 수집 시 날짜 필터 비활성화 - 모든 기사 수집 후 날짜별로 분류
                        const results = await searchGlobalGoogleNews(combinedQuery, language, null, true);
                        allArticles = allArticles.concat(results);

                        // 딜레이 (OR 검색으로 요청 수 줄었으므로 단축)
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }
            }

            // 필터링 적용
            const beforeFilter = allArticles.length;
            allArticles = allArticles.filter(article => filterArticle(article, filterKeywords, excludeKeywords));
            const afterFilter = allArticles.length;
            console.log(`필터링: ${beforeFilter} → ${afterFilter}개 (${beforeFilter - afterFilter}건 제외)`);

            // 중복 제거 (URL 기준)
            const urlMap = new Map();
            allArticles.forEach(article => {
                const normalizedUrl = article.link.split('?')[0];
                if (!urlMap.has(normalizedUrl)) {
                    urlMap.set(normalizedUrl, article);
                }
            });
            allArticles = Array.from(urlMap.values());

            // === 날짜별 분류 (backfill과 동일 로직) ===
            const articlesByDate = {};

            // 최근 7일 날짜 키 생성
            const now = new Date();
            const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
            for (let i = 0; i < 7; i++) {
                const d = new Date(koreaTime);
                d.setDate(d.getDate() - i);
                const dk = formatDateKey(d);
                articlesByDate[dk] = [];
            }

            // 기사를 날짜별로 분류
            allArticles.forEach(article => {
                const dk = article.dateKey;
                if (articlesByDate[dk]) {
                    articlesByDate[dk].push(article);
                }
            });

            // === 각 날짜별 저장 ===
            let totalNewCount = 0;
            let totalExistingCount = 0;
            let totalFinalCount = 0;
            const savedDates = [];

            for (const [dk, articles] of Object.entries(articlesByDate)) {
                if (articles.length === 0) continue;

                // 기존 데이터와 병합
                const docId = `${taskId}_${dk}`;
                const existingDoc = await db.collection('globalNewsData').doc(docId).get();

                const existingUrlMap = new Map();
                if (existingDoc.exists) {
                    (existingDoc.data().articles || []).forEach(article => {
                        const normalizedUrl = (article.link || '').split('?')[0];
                        if (normalizedUrl) {
                            existingUrlMap.set(normalizedUrl, article);
                        }
                    });
                }

                const existingCount = existingUrlMap.size;
                let newCount = 0;

                // 새 기사 병합
                articles.forEach(article => {
                    const normalizedUrl = article.link.split('?')[0];
                    if (!existingUrlMap.has(normalizedUrl)) {
                        existingUrlMap.set(normalizedUrl, article);
                        newCount++;
                    }
                });

                const mergedArticles = Array.from(existingUrlMap.values());
                const finalCount = mergedArticles.length;

                // Firestore 저장
                await db.collection('globalNewsData').doc(docId).set({
                    taskId: taskId,
                    dateKey: dk,
                    date: admin.firestore.Timestamp.fromDate(new Date(dk + 'T00:00:00+09:00')),
                    count: finalCount,
                    articles: mergedArticles,
                    languages: languages,
                    keywords: keywords,
                    metadata: {
                        existingCount: existingCount,
                        newCount: newCount,
                        filteredCount: beforeFilter - afterFilter,
                        updatedAt: admin.firestore.Timestamp.now()
                    },
                    timestamp: admin.firestore.Timestamp.now()
                }, { merge: true });

                totalNewCount += newCount;
                totalExistingCount += existingCount;
                totalFinalCount += finalCount;
                savedDates.push({ date: dk, count: finalCount, new: newCount });

                console.log(`글로벌 뉴스 저장 완료: ${dk} - 기존 ${existingCount} + 신규 ${newCount} = ${finalCount}건`);
            }

            res.json({
                success: true,
                taskId: taskId,
                languages: languages,
                existing: totalExistingCount,
                new: totalNewCount,
                filtered: beforeFilter - afterFilter,
                total: totalFinalCount,
                dates: savedDates
            });

        } catch (error) {
            console.error('글로벌 뉴스 수집 오류:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });

/**
 * 글로벌 뉴스 30일 백필 API
 */
exports.backfillGlobalNews = functions
    .region('asia-northeast3')
    .runWith({ timeoutSeconds: 540 }) // 9분 타임아웃
    .https.onRequest(async (req, res) => {
        // CORS
        res.set('Access-Control-Allow-Origin', '*');
        res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.status(204).send('');
            return;
        }

        const taskId = req.query.taskId;

        if (!taskId) {
            res.status(400).json({ success: false, error: 'taskId is required' });
            return;
        }

        try {
            // Task 정보 조회
            const taskDoc = await db.collection('globalTasks').doc(taskId).get();
            if (!taskDoc.exists) {
                res.status(404).json({ success: false, error: 'Task not found' });
                return;
            }

            const task = taskDoc.data();
            const keywords = task.keywords || [];
            const languages = Array.isArray(task.languages) ? task.languages : (task.language ? [task.language] : ['en']);
            const filterKeywords = task.filterKeywords || DEFAULT_FILTER_KEYWORDS;
            const excludeKeywords = task.excludeKeywords || DEFAULT_EXCLUDE_KEYWORDS;

            console.log(`30일 벌크 백필 시작: Task=${taskId}, Langs=${languages.join(',')}`);

            const now = new Date();
            const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

            // === 벌크 검색: when:30d 로 한 번에 30일치 검색 ===
            let bulkArticles = [];

            for (const language of languages) {
                if (keywords.length > 0) {
                    // 키워드를 OR로 묶어서 단일 쿼리 (when:30d 제거 - 503 에러 방지)
                    const combinedQuery = keywords.join(' OR ');
                    console.log(`벌크 검색 [${language}]: ${combinedQuery}`);

                    try {
                        // targetDateStr=null, disableLocalFilter=true 로 호출
                        const articles = await searchGlobalGoogleNews(combinedQuery, language, null, true);
                        bulkArticles = bulkArticles.concat(articles);
                        console.log(`[${language}] ${articles.length}건 수집`);
                    } catch (e) {
                        console.error(`벌크 검색 오류 [${language}]:`, e.message);
                    }

                    // 언어간 딜레이
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            console.log(`총 수집: ${bulkArticles.length}건`);

            // 필터링 (포함 + 제외 키워드 적용)
            bulkArticles = bulkArticles.filter(article => filterArticle(article, filterKeywords, excludeKeywords));
            console.log(`필터링 후: ${bulkArticles.length}건`);

            // === 날짜별 분배 ===
            const articlesByDate = {};

            // 30일 날짜 키 생성
            for (let i = 0; i < 30; i++) {
                const d = new Date(koreaTime);
                d.setDate(d.getDate() - i);
                const dateKey = formatDateKey(d);
                articlesByDate[dateKey] = [];
            }

            // 기사를 날짜별로 분류
            bulkArticles.forEach(article => {
                const dateKey = article.dateKey;
                if (articlesByDate[dateKey]) {
                    articlesByDate[dateKey].push(article);
                }
            });

            // === 각 날짜별 저장 ===
            const results = [];
            for (const [dateKey, articles] of Object.entries(articlesByDate)) {
                // 중복 제거
                const urlMap = new Map();
                articles.forEach(article => {
                    const normalizedUrl = article.link.split('?')[0];
                    if (!urlMap.has(normalizedUrl)) {
                        urlMap.set(normalizedUrl, article);
                    }
                });
                const uniqueArticles = Array.from(urlMap.values());

                // ⚠️ 중요: 새 기사가 없으면 저장 스킵 (기존 데이터 보존)
                if (uniqueArticles.length === 0) {
                    results.push({ date: dateKey, count: 0, skipped: true });
                    continue;
                }

                // Firestore 저장 (새 기사가 있는 경우만)
                const docId = `${taskId}_${dateKey}`;
                await db.collection('globalNewsData').doc(docId).set({
                    taskId: taskId,
                    dateKey: dateKey,
                    date: admin.firestore.Timestamp.fromDate(new Date(dateKey + 'T00:00:00+09:00')),
                    count: uniqueArticles.length,
                    articles: uniqueArticles,
                    languages: languages,
                    keywords: keywords,
                    backfill: true,
                    timestamp: admin.firestore.Timestamp.now()
                }, { merge: true });

                results.push({ date: dateKey, count: uniqueArticles.length });
            }

            console.log(`30일 벌크 백필 완료: Task=${taskId}`);

            res.json({
                success: true,
                taskId: taskId,
                totalArticles: bulkArticles.length,
                days: results.length,
                results: results
            });

        } catch (error) {
            console.error('백필 오류:', error);
            res.status(500).json({ success: false, error: error.message });
        }
    });



/**
 * 글로벌 뉴스 2시간 자동 수집
 */
exports.globalNewsAutoCollection = functions
    .region('asia-northeast3')
    .pubsub.schedule('0 */2 * * *')
    .timeZone('Asia/Seoul')
    .onRun(async (context) => {
        const now = new Date();
        const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const currentHour = koreaTime.getHours();
        const todayDateStr = formatDateKey(koreaTime);

        console.log(`글로벌 뉴스 자동 수집 시작... (${currentHour}시)`);

        try {
            // 모든 활성 Task 조회
            const tasksSnapshot = await db.collection('globalTasks')
                .where('isActive', '==', true)
                .get();

            if (tasksSnapshot.empty) {
                console.log('활성 Task 없음');
                return { success: true, message: 'No active tasks' };
            }

            const results = [];

            for (const doc of tasksSnapshot.docs) {
                const taskId = doc.id;
                const task = doc.data();
                const keywords = task.keywords || [];
                // 다중 언어 지원
                const languages = Array.isArray(task.languages) ? task.languages : (task.language ? [task.language] : ['en']);
                const filterKeywords = task.filterKeywords || DEFAULT_FILTER_KEYWORDS;
                const excludeKeywords = task.excludeKeywords || DEFAULT_EXCLUDE_KEYWORDS;

                console.log(`Task 수집: ${taskId} (${languages.join(',')})`);

                let allArticles = [];

                // 각 언어별로 키워드를 묶어서 수집 (API 호출 최적화)
                for (const language of languages) {
                    if (keywords.length > 0) {
                        const chunkSize = 5;
                        for (let k = 0; k < keywords.length; k += chunkSize) {
                            const chunk = keywords.slice(k, k + chunkSize);
                            // 따옴표 제거 (검색 호환성 개선)
                            const combinedQuery = chunk.map(w => `${w}`).join(' OR ');

                            console.log(`자동 수집 구글 뉴스 검색 요청 [${language}]: ${combinedQuery}`);
                            const articles = await searchGlobalGoogleNews(combinedQuery, language, todayDateStr);
                            allArticles = allArticles.concat(articles);

                            // 딜레이 (안전하게 0.5초)
                            await new Promise(resolve => setTimeout(resolve, 500));
                        }
                    }
                }

                // 필터링 (포함 + 제외)
                allArticles = allArticles.filter(article => filterArticle(article, filterKeywords, excludeKeywords));

                // 중복 제거 및 기존 데이터 병합
                const docId = `${taskId}_${todayDateStr}`;
                const existingDoc = await db.collection('globalNewsData').doc(docId).get();

                const existingUrlMap = new Map();
                if (existingDoc.exists) {
                    (existingDoc.data().articles || []).forEach(article => {
                        const normalizedUrl = (article.link || '').split('?')[0];
                        if (normalizedUrl) existingUrlMap.set(normalizedUrl, article);
                    });
                }

                allArticles.forEach(article => {
                    const normalizedUrl = article.link.split('?')[0];
                    if (!existingUrlMap.has(normalizedUrl)) {
                        existingUrlMap.set(normalizedUrl, article);
                    }
                });

                const mergedArticles = Array.from(existingUrlMap.values());

                await db.collection('globalNewsData').doc(docId).set({
                    taskId: taskId,
                    dateKey: todayDateStr,
                    date: admin.firestore.Timestamp.fromDate(new Date(todayDateStr + 'T00:00:00+09:00')),
                    count: mergedArticles.length,
                    articles: mergedArticles,
                    languages: languages,  // 다중 언어 배열
                    keywords: keywords,
                    auto: true,
                    lastAutoUpdate: admin.firestore.Timestamp.now()
                }, { merge: true });

                results.push({ taskId: taskId, count: mergedArticles.length });
            }

            console.log(`글로벌 뉴스 자동 수집 완료: ${results.length}개 Task`);
            return { success: true, results: results };

        } catch (error) {
            console.error('글로벌 뉴스 자동 수집 오류:', error);
            return { success: false, error: error.message };
        }
    });

/**
 * Gemini를 이용한 뉴스 제목 일괄 번역 (매일 자정 실행 + 수동 실행)
 */
exports.translateGlobalNews = functions
    .region('asia-northeast3')
    .runWith({
        timeoutSeconds: 540, // 9분 (배치 처리 시간 확보)
        memory: '2GB'
    })
    .https.onRequest(async (req, res) => {
        // CORS
        res.set('Access-Control-Allow-Origin', '*');
        if (req.method === 'OPTIONS') {
            res.set('Access-Control-Allow-Methods', 'POST');
            res.set('Access-Control-Allow-Headers', 'Content-Type');
            res.set('Access-Control-Max-Age', '3600');
            res.status(204).send('');
            return;
        }

        try {
            console.log('뉴스 제목 일괄 번역 시작...');
            const GEMINI_API_KEY = "AIzaSyBQnDMvtDnQDd9p4clijvVZsZcspRtiFIk";

            // 1. 번역 대상 데이터 조회
            const targetDateStr = req.query.targetDate;
            if (!targetDateStr) {
                return res.status(400).json({ success: false, error: 'targetDate parameter is required (YYYY-MM-DD)' });
            }
            console.log(`번역 요청 날짜: ${targetDateStr}`);

            // 단일 날짜 처리
            const targetDates = [targetDateStr];

            let totalTranslatedCount = 0;

            for (const date of targetDates) {
                const snapshot = await db.collection('globalNewsData')
                    .where('dateKey', '==', date)
                    .get();

                if (snapshot.empty) continue;

                for (const doc of snapshot.docs) {
                    const data = doc.data();
                    const articles = data.articles || [];
                    const taskId = data.taskId;

                    // 번역이 필요한 기사 추출 (이미 번역된 것 제외 + 한국어 제외)
                    // 중요: 원문 기사 내용은 절대 보내지 않음 (title만 추출)
                    // 디버그: 필터링 전 상태 확인
                    if (articles.length > 0) {
                        console.log(`[Translation Check] ${taskId} - Total: ${articles.length}`);
                        articles.forEach((a, idx) => {
                            console.log(`[Check #${idx}] Lang: ${a.language}, HasTrans: ${!!a.translatedTitle}, Title: ${a.title?.substring(0, 15)}...`);
                        });
                    }

                    const articlesToTranslate = articles.filter(a =>
                        (!a.translatedTitle || a.translatedTitle.trim() === '') &&
                        a.language !== 'ko' &&
                        a.title
                    );

                    if (articlesToTranslate.length === 0) continue;

                    console.log(`[${taskId}/${date}] 번역 대상: ${articlesToTranslate.length}건`);

                    // 50개씩 배치 처리
                    const batchSize = 50;
                    for (let i = 0; i < articlesToTranslate.length; i += batchSize) {
                        const batch = articlesToTranslate.slice(i, i + batchSize);

                        // Gemini에 보낼 데이터 (ID와 제목만 전송 - 사용자 요청 엄수)
                        const inputData = batch.map(a => ({
                            id: a.link, // 링크를 ID로 사용
                            title: a.title,
                            language: a.language
                        }));

                        const prompt = `
You are a professional news translator specializing in IT, Economy, and Global Affairs.
Translate the following list of news titles into natural, professional Korean news headlines.

Rules:
1. Maintain the original meaning but adapt the tone to match Korean news standards (concise, formal).
2. Keep important proper nouns (companies, products) such as AI, iPhone in English, or use standard Korean transliteration.
3. Return ONLY a JSON array with the exact same IDs. Do NOT return markdown formatting.

Input Format:
[
  {"id": "link_url_1", "title": "Apple releases new visionOS beta ...", "language": "en"}
]

Output Format:
[
  {"id": "link_url_1", "translatedTitle": "애플, 새로운 비전OS 베타 버전 출시..."}
]

Input Data:
${JSON.stringify(inputData)}
                        `;

                        try {
                            const response = await axios.post(
                                `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
                                {
                                    contents: [{ parts: [{ text: prompt }] }],
                                    generationConfig: {
                                        temperature: 0.1,
                                        responseMimeType: "application/json"
                                    }
                                },
                                { timeout: 60000 }
                            );

                            const generatedText = response.data.candidates[0].content.parts[0].text;
                            let translatedResults;

                            try {
                                translatedResults = JSON.parse(generatedText);
                            } catch (e) {
                                const cleanText = generatedText.replace(/```json/g, '').replace(/```/g, '').trim();
                                translatedResults = JSON.parse(cleanText);
                            }

                            // 결과 매핑 및 업데이트
                            let updatedCount = 0;
                            const resultMap = new Map(translatedResults.map(r => [r.id, r.translatedTitle]));

                            articles.forEach(article => {
                                if (resultMap.has(article.link)) {
                                    article.translatedTitle = resultMap.get(article.link);
                                    updatedCount++;
                                }
                            });

                            totalTranslatedCount += updatedCount;

                        } catch (err) {
                            console.error(`Gemini API 오류 (Batch ${i}):`, err.response?.data || err.message);
                        }

                        // Rate Limit 방지 딜레이
                        await new Promise(resolve => setTimeout(resolve, 1000));
                    }

                    // Firestore 업데이트
                    if (totalTranslatedCount > 0) {
                        await doc.ref.update({ articles: articles });
                    }
                }
            }

            console.log(`번역 완료: 총 ${totalTranslatedCount}건`);
            res.json({ success: true, count: totalTranslatedCount });

        } catch (error) {
            console.error('번역 함수 오류:', error);
            res.status(500).json({ error: error.message });
        }
    });

exports.debugGlobalNewsData = functions
    .region('asia-northeast3')
    .https.onRequest(async (req, res) => {
        const mode = req.query.mode || 'data';

        try {
            if (mode === 'task') {
                const taskId = req.query.taskId;
                if (!taskId) return res.status(400).send('taskId required');
                const doc = await db.collection('globalTasks').doc(taskId).get();
                if (!doc.exists) return res.json({ status: 'not_found' });
                return res.json({ status: 'found', data: doc.data() });
            }

            if (mode === 'doc') {
                const docId = req.query.docId;
                if (!docId) return res.status(400).send('docId required');
                const doc = await db.collection('globalNewsData').doc(docId).get();
                if (!doc.exists) return res.json({ status: 'not_found' });
                return res.json({ status: 'found', data: doc.data() });
            }

            if (mode === 'list') {
                const taskId = req.query.taskId;
                let query = db.collection('globalNewsData').orderBy('timestamp', 'desc').limit(10);

                if (taskId) {
                    // taskId 필터 (색인 없이 사용 위해 정렬 제거, ID가 날짜 포함하므로 대략적 정렬됨)
                    query = db.collection('globalNewsData').where('taskId', '==', taskId).limit(31);
                }

                const snapshot = await query.get();
                const docs = snapshot.docs.map(doc => ({
                    id: doc.id,
                    taskId: doc.data().taskId,
                    dateKey: doc.data().dateKey,
                    articleCount: (doc.data().articles || []).length,
                    languageCounts: (doc.data().articles || []).reduce((acc, cur) => {
                        acc[cur.language || 'unknown'] = (acc[cur.language || 'unknown'] || 0) + 1;
                        return acc;
                    }, {})
                }));
                return res.json({ status: 'found', docs });
            }

            // 최근 10개 문서 조회 (기본)
            const snapshot = await db.collection('globalNewsData')
                .orderBy('timestamp', 'desc')
                .limit(10)
                .get();

            if (snapshot.empty) {
                return res.json({ status: 'empty', message: 'No documents found in globalNewsData' });
            }

            const docs = snapshot.docs.map(doc => ({
                id: doc.id,
                taskId: doc.data().taskId,
                dateKey: doc.data().dateKey,
                articleCount: (doc.data().articles || []).length,
                languageCounts: (doc.data().articles || []).reduce((acc, cur) => {
                    acc[cur.language || 'unknown'] = (acc[cur.language || 'unknown'] || 0) + 1;
                    return acc;
                }, {})
            }));

            res.json({ status: 'found', docs });

        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

/**
 * 디버깅용: 특정 날짜의 데이터 상태 조회
 */
