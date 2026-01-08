/**
 * 데모 데이터 생성기
 * Firebase 연결 없이 로컬에서 UI 테스트용
 */

// 데모 키워드 목록
const demoKeywords = [
    { id: '1', name: 'ChatGPT', active: true },
    { id: '2', name: 'AI', active: true },
    { id: '3', name: '메타버스', active: true },
    { id: '4', name: 'Apple Vision Pro', active: true },
    { id: '5', name: 'Tesla', active: false }
];

// 데모 매체 목록
const demoSources = [
    { id: '1', name: '구글 뉴스', type: 'news', active: true },
    { id: '2', name: '네이버 뉴스', type: 'news', active: true },
    { id: '3', name: '디시인사이드', type: 'community', active: true },
    { id: '4', name: '뽐뿌', type: 'community', active: true },
    { id: '5', name: '루리웹', type: 'community', active: true },
    { id: '6', name: '잇섭', type: 'youtube', url: 'https://www.youtube.com/@itsub', active: true }
];

// 데모 수집 데이터
function generateDemoData(count = 50) {
    const data = [];
    const now = new Date();

    for (let i = 0; i < count; i++) {
        const keyword = demoKeywords[Math.floor(Math.random() * demoKeywords.length)];
        const source = demoSources[Math.floor(Math.random() * demoSources.length)];

        // 최근 24시간 내 랜덤 시간
        const randomHours = Math.random() * 24;
        const timestamp = new Date(now - randomHours * 60 * 60 * 1000);

        data.push({
            id: `demo-${i}`,
            source: source.name,
            sourceType: source.type,
            keyword: keyword.name,
            keywordId: keyword.id,
            title: `${keyword.name} 관련 ${getRandomTitle(source.type)}`,
            url: `https://example.com/article-${i}`,
            content: `${keyword.name}에 대한 최신 정보입니다. 이것은 데모 데이터입니다.`,
            timestamp: timestamp,
            collectedAt: timestamp.toISOString()
        });
    }

    return data.sort((a, b) => b.timestamp - a.timestamp);
}

function getRandomTitle(sourceType) {
    const titles = {
        news: [
            '뉴스: 혁신적인 발전',
            '속보: 새로운 트렌드',
            '심층 분석: 미래 전망',
            '긴급: 업계 변화',
            '특집: 전문가 의견'
        ],
        community: [
            '게시글: 사용 후기',
            '토론: 장단점 비교',
            '정보: 구매 가이드',
            '질문: 추천 부탁',
            '공유: 최신 소식'
        ],
        youtube: [
            '영상: 완벽 가이드',
            '리뷰: 솔직한 평가',
            '튜토리얼: 따라하기',
            '언박싱: 첫인상',
            '비교: VS 경쟁 제품'
        ]
    };

    const typeTitle = titles[sourceType] || titles.news;
    return typeTitle[Math.floor(Math.random() * typeTitle.length)];
}

// 트렌드 데이터 생성 (차트용)
function generateTrendData() {
    const labels = [];
    const datasets = {};

    // 최근 24시간 2시간 간격
    for (let i = 12; i >= 0; i--) {
        const date = new Date();
        date.setHours(date.getHours() - i * 2);
        labels.push(date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }));
    }

    // 각 키워드별 데이터
    demoKeywords.forEach(keyword => {
        if (!keyword.active) return;

        const data = [];
        let baseValue = Math.floor(Math.random() * 20) + 5;

        for (let i = 0; i < labels.length; i++) {
            // 랜덤 변동
            const change = (Math.random() - 0.5) * 10;
            baseValue = Math.max(0, baseValue + change);

            // 일부 키워드는 급증 패턴 추가
            if (keyword.name === 'ChatGPT' && i > 8) {
                baseValue += 5;
            }

            data.push(Math.round(baseValue));
        }

        datasets[keyword.name] = data;
    });

    return { labels, datasets };
}

// 통계 데이터 생성
function generateStats(data) {
    const activeKeywords = demoKeywords.filter(k => k.active).length;
    const activeSources = demoSources.filter(s => s.active).length;
    const lastUpdate = new Date();

    return {
        totalMentions: data.length,
        activeKeywords: activeKeywords,
        activeSources: activeSources,
        lastUpdate: lastUpdate.toLocaleString('ko-KR')
    };
}

// 급증 알림 생성
function generateAlerts() {
    return [
        {
            keyword: 'ChatGPT',
            recentCount: 45,
            previousCount: 18,
            percentageChange: 150,
            sources: '구글 뉴스, 디시인사이드, 잇섭'
        },
        {
            keyword: 'Apple Vision Pro',
            recentCount: 28,
            previousCount: 12,
            percentageChange: 133,
            sources: '네이버 뉴스, 루리웹'
        }
    ];
}

// Export for use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        demoKeywords,
        demoSources,
        generateDemoData,
        generateTrendData,
        generateStats,
        generateAlerts
    };
}
