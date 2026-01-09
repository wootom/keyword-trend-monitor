const functions = require('firebase-functions');
const { OpenAI } = require("openai");
const newsTranslator = require('./newsTranslator');
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
 * Google News 검색 (지난 24시간만)
 * - 503 에러 대응: Exponential backoff 재시도 로직 추가
 * - 타임아웃 증가: 10초 → 20초
 * - 요청 간 딜레이 추가
 */
async function searchGoogleNews(keyword, targetDateStr = null) {
    const MAX_RETRIES = 3;
    let retryCount = 0;

    while (retryCount < MAX_RETRIES) {
        try {
            // ✅ 요청 간 랜덤 딜레이 추가 (rate limiting 회피)
            if (retryCount > 0) {
                const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff: 2초, 4초, 8초
                console.log(`Google RSS 재시도 ${retryCount}/${MAX_RETRIES} - ${delay}ms 대기 중...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                // 첫 요청도 1-3초 랜덤 딜레이
                const randomDelay = 1000 + Math.random() * 2000;
                await new Promise(resolve => setTimeout(resolve, randomDelay));
            }

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

            // ✅ 타임아웃 증가: 10초 → 20초
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 20000
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
            // ✅ 503/429 에러 시 재시도, 그 외 에러는 즉시 중단
            if (error.response?.status === 503 || error.response?.status === 429) {
                retryCount++;
                console.warn(`⚠️ Google RSS ${error.response.status} 에러 발생 (키워드: ${keyword})`);

                if (retryCount >= MAX_RETRIES) {
                    console.error(`❌ Google RSS 최대 재시도 횟수 초과 (키워드: ${keyword}) - 빈 결과 반환`);
                    return [];
                }
                // 재시도 계속
            } else {
                // 503/429 외의 에러는 재시도 없이 즉시 반환
                console.error(`❌ Google News 검색 오류 (키워드: ${keyword}):`, error.message);
                return [];
            }
        }
    }

    // 모든 재시도 실패
    return [];
}

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

            // 각 키워드별로 수집 (Google News만 사용)
            for (const keyword of keywords) {
                const googleResults = await searchGoogleNews(keyword, dateKey);
                allGoogleArticles = allGoogleArticles.concat(googleResults);
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

            // 모든 날짜 수집
            const allDates = new Set(Object.keys(googleByDate));

            const batch = db.batch();
            let savedDates = [];

            for (const dateKey of allDates) {
                const targetDate = new Date(dateKey + 'T00:00:00+09:00');
                const googleArticles = googleByDate[dateKey] || [];

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
    // 2. 포함 체크
    return shouldIncludeArticle(article, filterKeywords);
}

/**
 * 다국어 Google News 검색
 * - 503 에러 대응: Exponential backoff 재시도 로직 추가
 * - 타임아웃 증가: 15초 → 20초
 * - 요청 간 딜레이 추가
 * @param {string} keyword - 검색 키워드
 * @param {string} langCode - 언어 코드 (en, ms, id, pt-BR, ja, ar)
 * @param {string} targetDateStr - YYYY-MM-DD 형식 (null이면 오늘)
 * @param {boolean} disableLocalFilter - true면 날짜 필터링 없이 모든 기사 반환 (벌크 백필용)
 */
async function searchGlobalGoogleNews(keyword, langCode, targetDateStr = null, disableLocalFilter = false) {
    const MAX_RETRIES = 3;
    let retryCount = 0;
    let feedData = null;
    let lastError = null;
    let todayDateStr;

    while (retryCount < MAX_RETRIES) {
        try {
            // ✅ 요청 간 랜덤 딜레이 추가 (rate limiting 회피)
            if (retryCount > 0) {
                const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff: 2초, 4초, 8초
                console.log(`[Global RSS] 재시도 ${retryCount}/${MAX_RETRIES} - ${delay}ms 대기 중...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            } else {
                // 첫 요청도 1-3초 랜덤 딜레이
                const randomDelay = 1000 + Math.random() * 2000;
                await new Promise(resolve => setTimeout(resolve, randomDelay));
            }

            const langConfig = LANGUAGE_CONFIG[langCode] || LANGUAGE_CONFIG.en;

            // 날짜 결정
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

            console.log(`[RSS 요청] URL: ${searchUrl}`);

            // ✅ 타임아웃 증가: 15초 → 20초
            const response = await axios.get(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 20000,
                maxRedirects: 5
            });

            console.log(`[RSS 응답] Status: ${response.status}, Data 길이: ${response.data?.length || 0}`);

            // 데이터가 XML인지 확인
            if (response.data && response.data.includes('<item>')) {
                feedData = response.data;
                console.log(`[RSS] 요청 성공 - XML with items detected`);
                break; // Exit retry loop on success
            } else if (response.data && response.data.includes('<rss')) {
                feedData = response.data;
                console.log(`[RSS] 요청 성공 - RSS 구조 확인됨 (items 없을 수 있음)`);
                break; // Exit retry loop on success
            } else {
                console.log(`[RSS] 응답이 RSS가 아님: ${response.data?.substring?.(0, 200)}`);
                throw new Error('Non-RSS response received');
            }
        } catch (error) {
            lastError = error;
            console.log(`[Global RSS 오류] ${retryCount + 1}/${MAX_RETRIES} (${langCode}): ${error.message}`);
            if (error.response) {
                console.log(`[Global RSS 오류 상세] Status: ${error.response.status}, Data: ${JSON.stringify(error.response.data)?.substring?.(0, 300)}`);
            }

            // ✅ 503/429 에러 시만 재시도, 그 외 에러는 즉시 중단
            if (error.response?.status === 503 || error.response?.status === 429 ||
                error.message.includes('429') || error.message.includes('503')) {
                retryCount++;
                if (retryCount >= MAX_RETRIES) {
                    break;
                }
                // 재시도 계속
            } else {
                // Non-retryable error, exit loop
                break;
            }
        }
    }

    if (!feedData) {
        console.log(`[Global RSS 실패] ${keyword} (${langCode}): 피드 데이터 없음`);
        return [];  // Return empty array instead of throwing
    }

    try {
        const $ = cheerio.load(feedData, { xmlMode: true });
        const items = [];
        const langConfig = LANGUAGE_CONFIG[langCode] || LANGUAGE_CONFIG.en;

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
                        const results = await searchGlobalGoogleNews(combinedQuery, language, dateKey, true);
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
        timeoutSeconds: 540,
        memory: '2GB'
    })
    .https.onRequest(newsTranslator.translateGlobalNews);

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

            // 키워드 포함 기사 삭제 모드
            if (mode === 'delete') {
                const keyword = req.query.keyword;
                const taskId = req.query.taskId;

                if (!keyword) return res.status(400).send('keyword required');

                let query = db.collection('globalNewsData');
                if (taskId) {
                    query = query.where('taskId', '==', taskId);
                }

                const snapshot = await query.get();
                let deletedCount = 0;
                let updatedDocs = 0;

                for (const doc of snapshot.docs) {
                    const data = doc.data();
                    const articles = data.articles || [];
                    const originalCount = articles.length;

                    // 키워드 포함 기사 필터링 (대소문자 무시)
                    const filtered = articles.filter(art => {
                        const title = (art.title || '').toLowerCase();
                        const translated = (art.translatedTitle || '').toLowerCase();
                        return !title.includes(keyword.toLowerCase()) && !translated.includes(keyword.toLowerCase());
                    });

                    if (filtered.length < originalCount) {
                        await doc.ref.update({ articles: filtered });
                        deletedCount += originalCount - filtered.length;
                        updatedDocs++;
                    }
                }

                return res.json({
                    success: true,
                    keyword: keyword,
                    deletedArticles: deletedCount,
                    updatedDocs: updatedDocs
                });
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
