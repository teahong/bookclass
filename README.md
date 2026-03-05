# 📚 BookFam (우리 가족 독서 기록)

> **"지식을 나누고 함께 성장하는 우리 가족만의 공간"**

BookFam은 가족 구성원들이 읽은 책을 기록하고, 서로의 독서 활동을 시유하며 즐겁게 독서 습관을 만들어가는 **맞춤형 가족 독서 플랫폼**입니다.

---

## ✨ 주요 기능

### 1. 🏠 개인 맞춤형 대시보드
- **간편 등록**: 도서 링크나 제목 검색을 통해 책 정보를 자동으로 가져옵니다. (AI 추출 기능 포함)
- **독서 감상문**: 별점과 함께 읽은 소감을 기록하고 누적 글자 수를 확인합니다.
- **추천하기**: 가족 구성원 중 이 책을 읽으면 좋을 사람에게 추천 메시지를 담아 보낼 수 있습니다.

### 2. 🏆 독서 챌린지 및 순위
- **시각화**: 누적 독서량과 감상문 작성량을 화려한 막대 그래프로 확인하세요.
- **트로피 시스템**: 1, 2, 3위에게는 특별한 금, 은, 동 트로피 아이콘과 후광 효과가 부여됩니다.
- **바운스 애니메이션**: 1등 트로피는 대시보드에서 화려하게 움직이며 성취감을 고취합니다.

### 3. 🕸️ 지식 그래프 (Knowledge Graph)
- **AI 키워드 추출**: 작성한 감상문에서 Gemini AI가 핵심 키워드를 추출합니다.
- **관계 시각화**: 가족이 읽은 책들이 어떤 주제(키워드)로 연결되어 있는지 인터랙티브한 그래프로 감상하세요.

### 4. 🔒 안전한 가족 보안
- **전용 PIN 번호**: 우리 가족만 아는 4자리 PIN 번호로 안전하게 로그인합니다.

---

## 🛠 기술 스택

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: CSS3 (Glassmorphism, Modern UI/UX)
- **Database / Auth**: Supabase
- **AI Interface**: Google Gemini API (Keyword Extraction)
- **Visuals**: Lucide React (Icons), Recharts (Charts), D3.js (Force-directed Graph)

---

## 🚀 시작하기

### 환경 변수 설정
`.env` 파일에 다음 항목을 설정해야 합니다:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_GEMINI_API_KEY=your_gemini_api_key
```

### 실행 방법
```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 빌드
npm run build
```

---

## 🎨 디자인 철학
BookFam은 **Glassmorphism(유리 질감)**과 **Vibrant Gradients(생동감 있는 그라데이션)**을 활용하여 현대적이고 프리미엄한 디자인을 지향합니다. 사용자 인터페이스가 살아있는 듯한 미세한 애니메이션(Micro-interactions)을 통해 즐거운 사용자 경험을 제공합니다.
