/**
 * Firestore에서 IXIO 데이터를 조회하고
 * MAJOR_OUTLETS 목록에 없는 언론사 기사를 분석
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// 56개 주요 언론사 목록
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

// URL에서 언론사 추출
function extractOutletFromUrl(url) {
    if (!url) return '';
    try {
        const domain = new URL(url).hostname.replace('www.', '');

        const domainMap = {
            'chosun.com': '조선일보', 'joongang.co.kr': '중앙일보',
            'donga.com': '동아일보', 'hani.co.kr': '한겨레',
            'khan.co.kr': '경향신문', 'mk.co.kr': '매일경제',
            'hankyung.com': '한국경제', 'sedaily.com': '서울경제',
            'fnnews.com': '파이낸셜뉴스', 'mt.co.kr': '머니투데이',
            'edaily.co.kr': '이데일리', 'asiae.co.kr': '아시아경제',
            'heraldcorp.com': '헤럴드경제', 'news1.kr': '뉴스1',
            'newsis.com': '뉴시스', 'yna.co.kr': '연합뉴스',
            'kbs.co.kr': 'KBS', 'imbc.com': 'MBC',
            'sbs.co.kr': 'SBS', 'jtbc.co.kr': 'JTBC',
            'etnews.com': '전자신문', 'dt.co.kr': '디지털타임스',
            'ddaily.co.kr': '디지털데일리', 'zdnet.co.kr': '지디넷코리아',
            'bloter.net': '블로터', 'nocutnews.co.kr': '노컷뉴스',
            'etoday.co.kr': '이투데이', 'bizwatch.co.kr': '비즈워치',
            'newsway.co.kr': '뉴스웨이', 'yonhapnewstv.co.kr': '연합뉴스TV',
            'aitimes.com': 'AI타임스', 'smedaily.co.kr': '중소기업신문',
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

// 주요 언론사 확인
function isMajorOutlet(source) {
    if (!source) return false;
    const sourceLower = source.toLowerCase();
    return MAJOR_OUTLETS.some(outlet =>
        sourceLower.includes(outlet.toLowerCase()) ||
        outlet.toLowerCase().includes(sourceLower)
    );
}

async function analyzeOutlets() {
    try {
        const snapshot = await db.collection('ixioData').get();

        let totalArticles = 0;
        let majorOutletCount = 0;
        let nonMajorOutletCount = 0;
        const nonMajorOutlets = {};
        const nonMajorArticles = [];

        snapshot.forEach(doc => {
            const data = doc.data();
            const articles = data.articles || [];

            articles.forEach(article => {
                totalArticles++;
                const link = article.link || article.url || '';
                const outlet = article.outlet || extractOutletFromUrl(link);

                if (isMajorOutlet(outlet)) {
                    majorOutletCount++;
                } else {
                    nonMajorOutletCount++;
                    nonMajorOutlets[outlet] = (nonMajorOutlets[outlet] || 0) + 1;
                    nonMajorArticles.push({
                        date: data.dateKey,
                        outlet: outlet,
                        title: article.title?.substring(0, 50) + '...'
                    });
                }
            });
        });

        console.log('\n====================================');
        console.log('IXIO 데이터 언론사 분석 결과');
        console.log('====================================\n');
        console.log(`총 기사 수: ${totalArticles}건`);
        console.log(`주요 언론사 기사: ${majorOutletCount}건`);
        console.log(`비주요 언론사 기사: ${nonMajorOutletCount}건\n`);

        console.log('--- 비주요 언론사 목록 ---');
        Object.entries(nonMajorOutlets)
            .sort((a, b) => b[1] - a[1])
            .forEach(([outlet, count]) => {
                console.log(`  ${outlet}: ${count}건`);
            });

        console.log('\n--- 비주요 언론사 기사 상세 ---');
        nonMajorArticles.forEach((art, idx) => {
            console.log(`${idx + 1}. [${art.date}] ${art.outlet}: ${art.title}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('오류:', error);
        process.exit(1);
    }
}

analyzeOutlets();
