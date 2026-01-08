// ==================== 정보 모달 표시 ====================
function showInfoModal() {
    const modalContent = `
        <div style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 9999; display: flex; align-items: center; justify-content: center;" onclick="this.remove()">
            <div style="background: white; padding: 2rem; border-radius: 8px; max-width: 700px; max-height: 80vh; overflow-y: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" onclick="event.stopPropagation()">
                <h2 style="margin-top: 0; color: var(--primary-color);">📊 IXIO 뉴스 모니터링 정책</h2>
                
                <div style="margin: 1.5rem 0;">
                    <h3 style="color: var(--text-primary); font-size: 1.1em;">🔍 수집 대상</h3>
                    <ul style="line-height: 1.8;">
                        <li><strong>소스</strong>: 네이버 뉴스 API + 구글 뉴스 RSS</li>
                        <li><strong>키워드</strong>: <code>익시오</code> OR <code>ixio</code> OR <code>ixi-o</code></li>
                        <li><strong>조건</strong>: 제목 또는 본문에 키워드 포함</li>
                    </ul>
                </div>
                
                <div style="margin: 1.5rem 0;">
                    <h3 style="color: var(--text-primary); font-size: 1.1em;">⏰ 수집 주기</h3>
                    <table style="width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.9em; border: 1px solid #dee2e6;">
                        <tr style="background: #f8f9fa;">
                            <th style="padding: 0.5rem; border: 1px solid #dee2e6; text-align: left;">시간</th>
                            <th style="padding: 0.5rem; border: 1px solid #dee2e6; text-align: left;">동작</th>
                        </tr>
                        <tr>
                            <td style="padding: 0.5rem; border: 1px solid #dee2e6;">매 2시간 (0,2,4...22시)</td>
                            <td style="padding: 0.5rem; border: 1px solid #dee2e6;">오늘 날짜 기사 수집 및 병합</td>
                        </tr>
                        <tr style="background: #f8f9fa;">
                            <td style="padding: 0.5rem; border: 1px solid #dee2e6;">자정 (0시)</td>
                            <td style="padding: 0.5rem; border: 1px solid #dee2e6;">어제 날짜 최종 확정</td>
                        </tr>
                    </table>
                </div>
                
                <div style="margin: 1.5rem 0;">
                    <h3 style="color: var(--text-primary); font-size: 1.1em;">📰 56개 주요 언론사</h3>
                    <p style="margin: 0.5rem 0; font-size: 0.9em; color: #666;">아래 언론사의 기사만 카운트됩니다.</p>
                    
                    <table style="width: 100%; border-collapse: collapse; margin-top: 0.5rem; font-size: 0.85em; border: 1px solid #dee2e6;">
                        <thead>
                            <tr style="background: #f8f9fa;">
                                <th style="padding: 0.4rem; border: 1px solid #dee2e6; text-align: left;">구분</th>
                                <th style="padding: 0.4rem; border: 1px solid #dee2e6; text-align: center; width: 40px;">수</th>
                                <th style="padding: 0.4rem; border: 1px solid #dee2e6; text-align: left;">언론사</th>
                            </tr>
                        </thead>
                        <tbody style="line-height: 1.5;">
                            <tr>
                                <td style="padding: 0.4rem; border: 1px solid #dee2e6;">종합일간지</td>
                                <td style="padding: 0.4rem; border: 1px solid #dee2e6; text-align: center;">10</td>
                                <td style="padding: 0.4rem; border: 1px solid #dee2e6;">조선일보, 중앙일보, 동아일보, 한겨레, 경향신문, 한국일보, 서울신문, 세계일보, 국민일보, 문화일보</td>
                            </tr>
                            <tr style="background: #f8f9fa;">
                                <td style="padding: 0.4rem; border: 1px solid #dee2e6;">경제지</td>
                                <td style="padding: 0.4rem; border: 1px solid #dee2e6; text-align: center;">10</td>
                                <td style="padding: 0.4rem; border: 1px solid #dee2e6;">매일경제, 한국경제, 서울경제, 파이낸셜뉴스, 머니투데이, 이데일리, 아시아경제, 헤럴드경제, 뉴스1, 뉴시스</td>
                            </tr>
                            <tr>
                                <td style="padding: 0.4rem; border: 1px solid #dee2e6;">방송사</td>
                                <td style="padding: 0.4rem; border: 1px solid #dee2e6; text-align: center;">11</td>
                                <td style="padding: 0.4rem; border: 1px solid #dee2e6;">KBS, MBC, SBS, JTBC, MBN, YTN, 연합뉴스TV, TV조선, 채널A, CBS, 연합뉴스</td>
                            </tr>
                            <tr style="background: #f8f9fa;">
                                <td style="padding: 0.4rem; border: 1px solid #dee2e6;">IT/기술</td>
                                <td style="padding: 0.4rem; border: 1px solid #dee2e6; text-align: center;">10</td>
                                <td style="padding: 0.4rem; border: 1px solid #dee2e6;">전자신문, 디지털타임스, 디지털데일리, 지디넷코리아, 블로터, 아이뉴스24, IT동아, 테크월드, 바이라인네트워크, AI타임스</td>
                            </tr>
                            <tr>
                                <td style="padding: 0.4rem; border: 1px solid #dee2e6;">주요 온라인</td>
                                <td style="padding: 0.4rem; border: 1px solid #dee2e6; text-align: center;">16</td>
                                <td style="padding: 0.4rem; border: 1px solid #dee2e6;">오마이뉴스, 프레시안, 미디어오늘, 더팩트, 스포츠조선, 스포츠동아, 일간스포츠, 데일리안, SBS Biz, 비즈워치, 이투데이, 조선비즈, 한경비즈니스, 뉴스웨이, 노컷뉴스, 시사저널</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
                
                <div style="margin: 1.5rem 0;">
                    <h3 style="color: var(--text-primary); font-size: 1.1em;">🔄 데이터 처리</h3>
                    <ul style="line-height: 1.8;">
                        <li><strong>중복 제거</strong>: URL 기준 (쿼리 파라미터 제거, 네이버 링크 정규화)</li>
                        <li><strong>병합 정책</strong>: 기존 기사 보존, 새 기사만 추가 (데이터 손실 방지)</li>
                        <li><strong>저장소</strong>: Google Firestore (날짜별 문서)</li>
                    </ul>
                </div>
                
                <div style="margin: 1.5rem 0;">
                    <h3 style="color: var(--text-primary); font-size: 1.1em;">📈 차트 기능</h3>
                    <ul style="line-height: 1.8;">
                        <li><strong>급증 감지</strong>: 전일 대비 2배↑ 또는 0→10건↑</li>
                        <li><strong>키워드 추출</strong>: 급증일 기사 제목에서 빈출 명사 자동 추출</li>
                        <li><strong>주말/공휴일</strong>: 빨간색으로 표시</li>
                        <li><strong>스크롤</strong>: 30일 이상 데이터 시 좌우 스크롤 가능</li>
                    </ul>
                </div>

                <div style="text-align: center; margin-top: 2rem;">
                    <button class="btn btn-primary" onclick="this.closest('div[style*=fixed]').remove()">
                        확인
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalContent);
}

// 전역 함수로 노출
window.showInfoModal = showInfoModal;
