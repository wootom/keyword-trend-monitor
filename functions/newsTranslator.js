const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

const GEMINI_API_KEY = "AIzaSyBQnDMvtDnQDd9p4clijvVZsZcspRtiFIk";

/**
 * 간단한 뉴스 제목 번역 함수
 * - DB에서 번역 안 된 기사 10개 가져옴
 * - Gemini로 한국어 번역
 * - DB에 저장
 */
exports.translateGlobalNews = async (req, res) => {
    res.set('Access-Control-Allow-Origin', '*');
    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET, POST');
        res.set('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).send('');
    }

    try {
        const db = admin.firestore();

        // 1. 최근 30일 날짜 생성
        const dates = [];
        for (let i = 0; i < 30; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().split('T')[0]);
        }

        // 2. 번역 안 된 기사 찾기 (최대 10개)
        const toTranslate = [];
        let targetDoc = null;
        let targetArticles = null;

        for (const dateKey of dates) {
            if (toTranslate.length >= 10) break;

            const snap = await db.collection('globalNewsData')
                .where('dateKey', '==', dateKey)
                .limit(5)
                .get();

            for (const doc of snap.docs) {
                if (toTranslate.length >= 10) break;

                const data = doc.data();
                const articles = data.articles || [];

                for (const art of articles) {
                    if (toTranslate.length >= 10) break;

                    // 한글 포함 여부 체크 (무한루프 방지)
                    const hasKorean = /[가-힣]/.test(art.translatedTitle || '');

                    // 번역 필요: (번역없음) OR (원본=번역 AND 한글없음)
                    const need = !art.translatedTitle || (art.translatedTitle === art.title && !hasKorean);

                    if (need && art.language !== 'ko' && art.title) {
                        toTranslate.push({
                            title: art.title,
                            articleObj: art,
                            docRef: doc.ref,
                            allArticles: articles
                        });

                        if (!targetDoc) {
                            targetDoc = doc.ref;
                            targetArticles = articles;
                        }
                    }
                }
            }
        }

        if (toTranslate.length === 0) {
            return res.json({ success: true, count: 0, message: "번역할 기사 없음" });
        }

        console.log(`번역 대상: ${toTranslate.length}개`);

        // 3. Gemini로 번역 요청
        const titles = toTranslate.map((t, i) => `${i}. ${t.title}`).join('\n');

        const prompt = `다음 뉴스 제목들을 한국어로 번역해주세요. 번호와 번역만 출력하세요.

${titles}

출력 형식:
0. 번역된 제목
1. 번역된 제목`;

        const geminiRes = await axios.post(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
            {
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { temperature: 0.1 }
            },
            { timeout: 30000 }
        );

        const responseText = geminiRes.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        console.log(`Gemini 응답: ${responseText.substring(0, 200)}...`);

        // 4. 응답 파싱 (숫자. 번역 형식)
        const lines = responseText.split('\n').filter(l => l.trim());
        let successCount = 0;
        const docsToUpdate = new Map();

        for (const line of lines) {
            const match = line.match(/^(\d+)\.\s*(.+)$/);
            if (match) {
                const idx = parseInt(match[1]);
                const translated = match[2].trim();

                if (idx >= 0 && idx < toTranslate.length && translated) {
                    const item = toTranslate[idx];
                    item.articleObj.translatedTitle = translated;
                    docsToUpdate.set(item.docRef.id, { ref: item.docRef, articles: item.allArticles });
                    successCount++;
                }
            }
        }

        // 5. DB 저장
        for (const [id, info] of docsToUpdate) {
            await info.ref.update({ articles: info.articles });
        }

        console.log(`완료: ${successCount}/${toTranslate.length}`);

        return res.json({
            success: true,
            count: successCount,
            total: toTranslate.length,
            hasMore: toTranslate.length === 10
        });

    } catch (error) {
        console.error('오류:', error.message);
        return res.status(500).json({ success: false, error: error.message });
    }
};
