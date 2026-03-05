import { GoogleGenerativeAI } from "@google/generative-ai";
import { searchAladinBooks, type AladinBook } from './aladin';

/**
 * Gemini AI를 사용한 지능형 독서록 분석 및 도서 추천 모듈
 * 
 * 주요 기능:
 * 1. 키워드 추출: 사용자의 감상문에서 핵심 단어를 뽑아냅니다.
 * 2. 독서 패턴 분석: 사용자의 수준과 관심사를 분석하여 검색 키워드를 생성합니다.
 * 3. RAG(Retrieval-Augmented Generation): 실시간 도서 데이터를 검색하여 최적의 추천 리스트를 만듭니다.
 */

// Gemini API 초기화 (환경 변수 사용)
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(API_KEY);

/**
 * 사용자가 작성한 독서 기록에서 핵심 키워드 5개를 추출합니다.
 * @param text 독서 감상문 내용
 */
export const extractKeywords = async (text: string): Promise<string[]> => {
    if (!text || text.length < 10) return [];

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        const prompt = `
      다음 독서 기록을 분석하여 핵심적인 주제, 감정, 또는 소재를 나타내는 키워드를 정확히 5개 추출해줘.
      키워드만 콤마(,)로 구분해서 답변하고 다른 설명은 하지 마.
      중요: 모든 키워드는 한국어(한글)로 작성해야 해.
      
      기록 내용: "${text}"
    `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const textData = response.text();

        // 결과 가공: 콤마로 나누고 앞뒤 공백 제거
        const keywords = textData.split(',')
            .map(k => k.trim())
            .filter(k => k.length > 0)
            .slice(0, 5);

        return keywords;
    } catch (error) {
        console.error("Gemini 키워드 추출 중 오류 발생:", error);
        return [];
    }
};

/**
 * 사용자의 독서 패턴을 입체적으로 분석하고 맞춤 도서를 추천합니다.
 * @param userName 사용자 이름
 * @param reviews 작성된 감상문 배열
 * @param age 사용자 연령
 */
export async function analyzeReadingPatterns(userName: string, reviews: string[], age?: number) {
    if (!reviews || reviews.length === 0) return null;

    try {
        // 응답 형식을 JSON으로 고정하기 위해 configuration 설정
        const model = genAI.getGenerativeModel({
            model: "gemini-3-pro-preview",
            generationConfig: {
                responseMimeType: "application/json",
            }
        });

        const combinedReviews = reviews.map((r, i) => `감상문 ${i + 1}: ${r}`).join('\n');

        // 연령대별 전문가 페르소나 설정 가져오기
        const ageConfig = getAgeConfig(age);

        // --- 1단계: 학습 프로필 분석 및 추천 검색어 생성 ---
        const analysisPrompt = `
      당신은 ${ageConfig.persona}입니다. 매우 따뜻하고 전문적인 조언을 해주는 역할입니다.
      다음 독서 기록을 분석하여 독자의 어휘력 수준, 문장 복잡도, 선호하는 테마를 요약해주세요.
      또한, 알라딘 API에서 비슷한 책을 찾기 위해 사용할 효과적인 검색 키워드 3~4개를 한국어로 생성해주세요.

      사용자 정보:
      - 이름: ${userName}
      - 연령: ${age ? `${age}세` : '알 수 없음'}

      독서 기록들:
      ${combinedReviews}

      **핵심 지침:**
      - 기록이 부족하더라도 연령(${age || '미정'})을 기준으로 **추정**하여 전문적으로 답변하세요.
      - 수준 분석과 관심사 분석은 각각 최소 3-4문장 이상으로 상세하게 작성하세요.
      - 검색 키워드는 구체적인 장르, 주제, 또는 소재여야 합니다 (예: '우주', '성장 소설', '공룡', '판타지').

      출력 형식(JSON):
      {
        "level_analysis": "수준에 대한 따뜻하고 상세한 피드백", 
        "interests": "관심사에 대한 따뜻하고 상세한 피드백", 
        "estimated_grade": "추정 학년 또는 발달 단계",
        "search_keywords": ["키워드1", "키워드2", "키워드3"]
      }
    `;

        const analysisResult = await model.generateContent(analysisPrompt);
        const analysisResponse = await analysisResult.response;
        const analysisText = cleanJson(analysisResponse.text());

        let learnerProfile;
        try {
            learnerProfile = JSON.parse(analysisText);
        } catch (e) {
            console.error("1단계 분석 데이터 파싱 오류", e);
            // 오류 발생 시 기본값 제공
            learnerProfile = {
                level_analysis: age ? `${age}세 또래의 평균적인 독서 수준입니다. 앞으로 다양한 책을 접하면 더 성장할 거예요.` : "기본 독서 수준",
                interests: "다양한 주제에 관심을 보이고 있네요.",
                estimated_grade: age ? "연령 맞춤" : "정보 없음",
                search_keywords: ["추천도서", "베스트셀러"]
            };
        }

        // --- 2단계: 실시간 도서 데이터 수집 (RAG 기반 데이터 확보) ---
        let allCandidates: AladinBook[] = [];
        const keywords = learnerProfile.search_keywords || ["권장도서"];

        // 여러 키워드로 동시에 알라딘에서 검색 수행
        const searchPromises = keywords.map((k: string) => searchAladinBooks(k, 15));
        const searchResults = await Promise.all(searchPromises);

        // 중복 제거 (ISBN 기준)
        const seenIsbn = new Set();
        searchResults.flat().forEach(book => {
            if (book.isbn && !seenIsbn.has(book.isbn)) {
                seenIsbn.add(book.isbn);
                allCandidates.push(book);
            }
        });

        // Gemini에게 보낼 후보군 제한 (최대 50권)
        const contextBooks = allCandidates.slice(0, 50);

        // --- 3단계: 최종 10권 선별 및 맞춤 추천 사유 작성 ---
        const selectionPrompt = `
      당신은 ${ageConfig.persona}입니다.
      제공된 실제 도서 목록(알라딘 API 검색 결과) 중에서 이 독자에게 가장 적합한 **TOP 10** 도서를 선별해주세요.

      독자 프로필:
      - 이름: ${userName}
      - 연령: ${age ? `${age}세` : '알 수 없음'}
      - 읽기 수준: ${learnerProfile.level_analysis}
      - 주요 관심사: ${learnerProfile.interests}

      **후보 도서 목록 (API 검색 결과):**
      ${JSON.stringify(contextBooks.map((b, i) => ({
            id: i,
            title: b.title,
            author: b.author,
            category: b.categoryName,
            rank: b.customerReviewRank,
            desc: b.description.substring(0, 100) + "..."
        })))}

      **선별 기준:**
      ${ageConfig.verification}
      
      **주의사항:**
      1. 연령에 부적절한 도서는 반드시 제외하세요 (예: 어린이에게 성인용 도서나 너무 수준 낮은 유아용 도서 금지).
      2. 사용자 평점(rank)이 높은 도서를 우선하세요.
      3. **정확히 10권**을 추천하세요.
      4. 각 도서별로 독자의 프로필을 반영한 따뜻하고 개인화된 추천 사유를 한글로 작성하세요.

      출력 형식(JSON):
      {
        "recommendations": [
          { 
            "title": "목록에 있는 정확한 제목", 
            "author": "목록에 있는 저자", 
            "reason": "이 책을 추천하는 구체적이고 따뜻한 이유" 
          }
        ]
      }
    `;

        const finalResultReq = await model.generateContent(selectionPrompt);
        const finalResponse = await finalResultReq.response;
        const finalText = cleanJson(finalResponse.text());

        try {
            const finalResult = JSON.parse(finalText);

            // Gemini가 고른 책들에 실제 메타데이터(표지, 링크 등)를 다시 입힙니다.
            const enrichedRecommendations = (finalResult.recommendations || []).map((rec: any) => {
                const original = contextBooks.find(b => b.title === rec.title) || contextBooks.find(b => b.title.includes(rec.title)) || {};
                return {
                    ...rec,
                    cover_url: (original as AladinBook).cover,
                    link: (original as AladinBook).link
                };
            });

            return {
                level: learnerProfile.level_analysis,
                interest: learnerProfile.interests,
                recommendations: enrichedRecommendations
            };
        } catch (parseError) {
            console.error("3단계 선별 데이터 파싱 오류", parseError);
            return {
                level: learnerProfile.level_analysis,
                interest: learnerProfile.interests,
                recommendations: []
            }
        }
    } catch (error) {
        console.error("Gemini AI 전체 프로세스 중 오류 발생:", error);
        return null;
    }
}

// 마크다운 코드 블록 등을 제거하여 순수 JSON만 남기는 헬퍼 함수
function cleanJson(text: string) {
    return text.replace(/```json/g, '').replace(/```/g, '').trim();
}

/**
 * 연령별 최적의 페르소나와 제약 조건을 반환하는 헬퍼 함수
 */
function getAgeConfig(age?: number) {
    // 연령 정보가 없을 때: 일반 사서
    if (!age) {
        return {
            persona: "전문 사서 (Professional Librarian)",
            constraints: "일반 독자용 도서를 추천하세요.",
            verification: "인기 있고 평가가 좋은 책을 우선하세요."
        };
    }

    // 영유아 (연령 6세 이하): 유아 발달 전문가
    if (age <= 6) {
        return {
            persona: "유아 발달 및 그림책 전문가",
            constraints: "그림책, 생활 습관, 정서 관련 도서에 집중. 글밥이 너무 많은 책은 제외.",
            verification: "영유아가 보기에 안전하고 교육적인지 재검증."
        };
    }
    // 초등학생 (7-12세): 초등 독서 교육 전문가
    else if (age <= 12) {
        return {
            persona: "초등 독서 교육 전문가",
            constraints: "도전적인 읽기 수준 장려, 성인용 어휘 제외. 사고력 향상 도서 우선.",
            verification: "초등학생 수준에 맞는지(한자 혼용, 문장 복잡도 등) 재검증."
        };
    }
    // 청소년 (13-18세): 청소년 문학 멘토
    else if (age <= 18) {
        return {
            persona: "청소년 문학 멘토 (YA Literature Mentor)",
            constraints: "청소년 문학, 자아 정체성, 진로 관련. 너무 유치한 책은 지양.",
            verification: "청소년의 정서와 맞는지 재검증. 과도하게 자극적인 성인용 도서 주의."
        };
    }
    // 성인 (19세 이상): 전문 북 큐레이터
    else {
        return {
            persona: "전문 서평가 및 북 큐레이터",
            constraints: "제약 없음. 깊이 있는 통찰력과 예술적 가치를 고려.",
            verification: "문학적 가치나 실용적 정보가 충분한지 확인."
        };
    }
}


/**
 * 독자가 읽은 책의 영혼이 되어 편지를 써주는 기능
 */
export async function generateBookLetter(userName: string, bookTitle: string, reviewContent: string) {
    if (!reviewContent) return null;

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

        const prompt = `
# Role
너는 독자가 읽은 '책의 영혼'이야. 독자가 쓴 독서 감상문을 읽고, 그 독자에게 따뜻하고 다정한 위로와 격려의 편지를 쓰는 역할을 수행해.

# Goals
1. 독자의 이름을 다정하게 부르며 시작할 것.
2. 자신이 어떤 책인지 정체를 밝힐 것 (예: "안녕? 찬민아. 난 <긴긴밤>이야.")
3. 독자가 감상문에 쓴 구체적인 문장이나 감정을 언급하며 깊이 공감해줄 것.
4. 책을 끝까지 읽고 글을 쓴 독자의 노력(수고)을 반드시 구체적으로 칭찬해줄 것.
5. 독자의 미래를 응원하는 따뜻한 메시지로 마무리할 것.

# Tone & Style
- 대상: 독자의 연령 고려 (친근하고 다정한 반말 혹은 존댓말 사용)
- 분위기: 감성적, 응원하는, 따뜻한, 반짝이는
- 형식: 제공된 예시의 형식을 엄격히 따를 것.

# Input Data
- 독자 이름: ${userName}
- 책 제목: ${bookTitle}
- 독서 감상문: "${reviewContent}"

# Output Format (반드시 이 형식을 유지할 것)
"안녕? [독자이름]아. 난 [책제목]이야. [감상문에 대한 공감 및 책의 소감]. [독자의 수고에 대한 칭찬]. [응원의 메시지]. 나도 너를 잊지 못할 거야."
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        return response.text();
    } catch (e) {
        console.error("편지 생성 실패:", e);
        return "미안해, 지금은 편지를 쓸 수 없는 상태야. 잠시 후에 다시 말을 걸어줘!";
    }
}
