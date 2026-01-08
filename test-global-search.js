/**
 * Google News RSS 검색 테스트 스크립트
 * 실행: node test-global-search.js
 */

const axios = require('axios');
const cheerio = require('cheerio');

// 언어별 설정
const LANGUAGE_CONFIG = {
    en: { hl: 'en', gl: 'US', ceid: 'US:en', name: 'English' },
    ms: { hl: 'ms', gl: 'MY', ceid: 'MY:ms', name: 'Malay' },
    id: { hl: 'id', gl: 'ID', ceid: 'ID:id', name: 'Indonesian' },
    'pt-BR': { hl: 'pt-BR', gl: 'BR', ceid: 'BR:pt-BR', name: 'Portuguese (Brazil)' },
    ja: { hl: 'ja', gl: 'JP', ceid: 'JP:ja', name: 'Japanese' },
    ar: { hl: 'ar', gl: 'SA', ceid: 'SA:ar', name: 'Arabic' }
};

async function testGoogleNewsSearch(keyword, langCode = 'en') {
    const langConfig = LANGUAGE_CONFIG[langCode] || LANGUAGE_CONFIG.en;

    // 기본 RSS URL
    const searchUrl = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=${langConfig.hl}&gl=${langConfig.gl}&ceid=${langConfig.ceid}`;

    console.log(`\n========================================`);
    console.log(`테스트: "${keyword}" (${langConfig.name})`);
    console.log(`URL: ${searchUrl}`);
    console.log(`========================================`);

    try {
        const response = await axios.get(searchUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'Referer': 'https://news.google.com/'
            },
            timeout: 10000
        });

        console.log(`Status: ${response.status}`);
        console.log(`Content Length: ${response.data.length} bytes`);

        const $ = cheerio.load(response.data, { xmlMode: true });
        const items = [];

        $('item').each((i, elem) => {
            const title = $(elem).find('title').text();
            const link = $(elem).find('link').text();
            const pubDate = $(elem).find('pubDate').text();
            const source = $(elem).find('source').text() || 'Unknown';

            items.push({ title, link, pubDate, source });
        });

        console.log(`\n결과: ${items.length}건 발견\n`);

        if (items.length > 0) {
            console.log('샘플 기사 (최대 5개):');
            items.slice(0, 5).forEach((item, idx) => {
                console.log(`\n[${idx + 1}] ${item.title}`);
                console.log(`    출처: ${item.source}`);
                console.log(`    날짜: ${item.pubDate}`);
            });
        } else {
            // RSS 응답 내용 확인
            console.log('RSS 응답 (처음 1000자):');
            console.log(response.data.substring(0, 1000));
        }

        return items;

    } catch (error) {
        console.error(`오류 발생: ${error.message}`);
        if (error.response) {
            console.error(`HTTP Status: ${error.response.status}`);
            console.error(`Response: ${error.response.data?.substring?.(0, 500) || error.response.data}`);
        }
        return [];
    }
}

async function runTests() {
    console.log('Google News RSS 검색 테스트 시작...\n');

    // 테스트 키워드 목록
    const testCases = [
        // 사용자가 사용 중인 키워드
        { keyword: 'maxis', lang: 'en' },
        { keyword: 'maxis', lang: 'ms' },  // 말레이시아 언어
        { keyword: 'TIM', lang: 'en' },
        { keyword: 'TIM telecom', lang: 'en' },  // 더 구체적인 검색
        { keyword: 'Telecom Italia', lang: 'en' },  // 정식 명칭
        { keyword: 'zain', lang: 'en' },
        { keyword: 'zain', lang: 'ar' },  // 아랍어
        // 대조군: 확실히 결과가 나오는 키워드
        { keyword: 'Samsung', lang: 'en' },
        { keyword: 'Apple', lang: 'en' },
    ];

    for (const tc of testCases) {
        await testGoogleNewsSearch(tc.keyword, tc.lang);
        // 요청 간 딜레이
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('\n\n========================================');
    console.log('테스트 완료!');
    console.log('========================================');
}

runTests();
