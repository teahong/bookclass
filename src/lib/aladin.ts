import axios from 'axios';

/**
 * 알라딘 도서 검색 API 연동 모듈
 * 
 * VITE_ALADIN_API_KEY: .env 파일에 설정된 알라딘 TTB 키
 * PROXY_BASE_URL: CORS 문제를 피하기 위해 설정된 프록시 경로
 */
const ALADIN_API_KEY = import.meta.env.VITE_ALADIN_API_KEY;
const PROXY_BASE_URL = '/api/aladin';

// 알라딘 API로부터 받는 도서 정보 인터페이스
export interface AladinBook {
    title: string;           // 도서 제목
    author: string;          // 저자 정보
    pubDate: string;         // 출판일
    description: string;     // 도서 설명 (요약)
    isbn: string;            // ISBN (13자리 우선)
    cover: string;           // 도서 표지 이미지 URL
    categoryName: string;    // 카테고리 (분류)
    customerReviewRank: number; // 고객 평점 (10점 만점)
    priceStandard: number;   // 정가
    link: string;            // 알라딘 상세 페이지 링크
}

interface AladinApiItem {
    title: string;
    author: string;
    pubDate: string;
    description?: string;
    isbn?: string;
    isbn13?: string;
    cover: string;
    categoryName: string;
    customerReviewRank: number;
    priceStandard: number;
    link: string;
}

interface AladinSearchResponse {
    item?: AladinApiItem[];
}

/**
 * 알라딘 API를 사용하여 도서를 검색합니다.
 * @param query 검색어 (제목, 저자, 키워드 등)
 * @param maxResults 가져올 최대 결과 수 (기본값: 20)
 */
export const searchAladinBooks = async (query: string, maxResults: number = 20): Promise<AladinBook[]> => {
    try {
        /**
         * axios를 사용하여 알라딘 API (프록시를 통해) 호출
         * 알라딘 API는 기본적으로 XML을 반환하지만, 'output=js' 파라미터를 통해 JSON 형식을 받을 수 있습니다.
         */
        const response = await axios.get<AladinSearchResponse>(PROXY_BASE_URL, {
            params: {
                ...(ALADIN_API_KEY ? { ttbkey: ALADIN_API_KEY } : {}),
                Query: query,                // 검색어
                QueryType: 'Keyword',        // 검색 유형 (키워드)
                MaxResults: maxResults,      // 최대 결과 수
                start: 1,                    // 검색 시작 위치
                SearchTarget: 'Book',        // 검색 대상 (도서)
                output: 'js',                // 출력 형식 (JSON)
                Version: '20131101'          // API 버전
            }
        });

        // 응답 데이터에서 'item' 배열이 있는지 확인하고 데이터를 가공합니다.
        if (response.data && response.data.item) {
            return response.data.item.map((item) => ({
                title: item.title,
                author: item.author,
                pubDate: item.pubDate,
                description: item.description || "",
                isbn: item.isbn13 || item.isbn || "", // ISBN 13자리가 있으면 사용하고, 없으면 일반 ISBN 사용
                cover: item.cover,
                categoryName: item.categoryName,
                customerReviewRank: item.customerReviewRank,
                priceStandard: item.priceStandard,
                link: item.link
            }));
        }

        return [];
    } catch (error) {
        // 네트워크 오류나 API 키 오류 발생 시 빈 배열을 반환하고 콘솔에 에러를 기록합니다.
        console.error("알라딘 API 검색 중 오류 발생:", error);
        return [];
    }
};
