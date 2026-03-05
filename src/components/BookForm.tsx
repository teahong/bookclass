import React from 'react';
import { Star, AlertCircle, BookOpen, Trash2, UserPlus } from 'lucide-react';

interface BookFormProps {
    isEditing: boolean;
    book: any;
    setBook: (book: any) => void;
    users: any[];
    isAutoFilling: boolean;
    aiError: string | null;
    onCancel: () => void;
    onSubmit: (e: React.FormEvent) => void;
    onAutoFill: () => void;
    onSearchCover: () => void;
}

/**
 * 도서 등록 및 수정 폼 컴포넌트
 * MainDashboard에서 비대해진 폼 로직을 별도 컴포넌트로 분리했습니다.
 */
const BookForm: React.FC<BookFormProps> = ({
    isEditing,
    book,
    setBook,
    users,
    isAutoFilling,
    aiError,
    onCancel,
    onSubmit,
    onAutoFill,
    onSearchCover
}) => {
    return (
        <div className="glass-card book-form-card">
            {/* 헤더 섹션: 수정인지 신규 등록인지 표시 */}
            <h3 className="book-form-title">
                {isEditing ? '📖 책 정보 수정하기' : '✨ 새로운 책 등록하기'}
            </h3>

            <form onSubmit={onSubmit}>
                {/* 1단계: 자동 완성 섹션 (링크로 정보 가져오기) */}
                <div className="book-form-autofill">
                    <label className="book-form-label">자동 완성 (선택)</label>
                    <div className="book-form-autofill-row">
                        <div className="book-form-autofill-input-wrap">
                            <input
                                type="text"
                                className="input-field"
                                placeholder="도서 링크 입력 (예: 예스24, 알라딘 URL)"
                                value={book.link}
                                onChange={e => setBook({ ...book, link: e.target.value })}
                            />
                        </div>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={onAutoFill}
                            disabled={isAutoFilling || !book.link}
                        >
                            {isAutoFilling ? '분석 중...' : 'AI로 정보 추출'}
                        </button>
                    </div>
                    <p className="book-form-help-text">
                        * 도서 상세 페이지 링크를 입력하면 제목, 저자, 출판사, 표지를 AI가 자동으로 채워줍니다.
                    </p>
                </div>

                {/* 에러 메시지 표시 */}
                {aiError && (
                    <div className="book-form-error">
                        <AlertCircle size={18} /> {aiError}
                    </div>
                )}

                {/* 2단계: 필수 도서 정보 입력 */}
                <div className="form-row book-form-main-row">
                    <div className="book-form-fields">
                        {/* 제목 및 검색 버튼 */}
                        <div className="book-form-group">
                            <label className="book-form-label">도서 제목 *</label>
                            <div className="book-title-row">
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="책 제목을 입력하세요"
                                    value={book.title}
                                    onChange={(e) => setBook({ ...book, title: e.target.value })}
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSearchCover(); } }}
                                    required
                                    style={{ flex: 1 }}
                                />
                                <button type="button" className="btn btn-secondary" onClick={onSearchCover} disabled={isAutoFilling || !book.title}>
                                    검색
                                </button>
                            </div>
                        </div>

                        {/* 작가 및 출판사 */}
                        <div className="book-form-two-col">
                            <div>
                                <label className="book-form-label">작가</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="작가 이름"
                                    value={book.author}
                                    onChange={(e) => setBook({ ...book, author: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="book-form-label">출판사</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="출판사 명"
                                    value={book.publisher}
                                    onChange={(e) => setBook({ ...book, publisher: e.target.value })}
                                />
                            </div>
                        </div>

                        {/* 날짜 및 평점 */}
                        <div className="book-form-two-col">
                            <div>
                                <label className="book-form-label">읽은 날짜</label>
                                <input
                                    type="date"
                                    className="input-field"
                                    value={book.read_date}
                                    onChange={e => setBook({ ...book, read_date: e.target.value })}
                                    required
                                />
                            </div>
                            <div>
                                <label className="book-form-label">나의 평점</label>
                                <div className="book-form-stars">
                                    {[1, 2, 3, 4, 5].map(s => (
                                        <Star
                                            key={s}
                                            size={24}
                                            fill={s <= book.rating ? "#FFD700" : "none"}
                                            stroke="#FFD700"
                                            onClick={() => setBook({ ...book, rating: s })}
                                            className="star-icon rating-star"
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 표지 미리보기 섹션 */}
                    <div className="cover-preview-container book-cover-wrap">
                        <label className="book-form-label cover-label">도서 표지</label>
                        <div
                            className="book-cover-dropzone"
                            onClick={() => {
                                if (!book.cover_url) {
                                    const url = prompt("이미지 주소(URL)를 입력하세요:");
                                    if (url) setBook({ ...book, cover_url: url });
                                }
                            }}
                        >
                            {book.cover_url ? (
                                <>
                                    <img src={book.cover_url} alt="표지 미리보기" className="book-cover-image" />
                                    <div
                                        className="book-cover-remove"
                                        onClick={(e) => { e.stopPropagation(); setBook({ ...book, cover_url: '' }); }}
                                    >
                                        <Trash2 size={16} color="#e53e3e" />
                                    </div>
                                </>
                            ) : (
                                <>
                                    <BookOpen size={40} className="book-cover-placeholder-icon" />
                                    <span>이미지 링크를<br />입력해주세요</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* 3단계: 감상문 작성 */}
                <div className="book-review-section">
                    <label className="book-form-label">나의 감상 (독서록) *</label>
                    <textarea
                        className="input-field book-review-input"
                        value={book.review_content}
                        onChange={(e) => setBook({ ...book, review_content: e.target.value })}
                        placeholder="이 책을 읽고 어떤 생각을 했나요? 느낀 점을 자유롭게 적어보세요. (글이 길수록 AI 분석이 정확해져요!)"
                        required
                    ></textarea>
                    <div className="book-review-counter">
                        현재 <strong>{book.review_content.length}</strong>자 작성 중
                    </div>
                </div>

                {/* 4단계: 추천하기 */}
                <div className="book-recommend-section">
                    <label className="book-form-label">누구에게 추천하고 싶나요? (중복 선택 가능)</label>
                    <div className="book-recommend-list">
                        {users.map(u => {
                            const isSelected = book.recommend_to.split(',').map((s: string) => s.trim()).includes(u.name);
                            return (
                                <button
                                    key={u.id}
                                    type="button"
                                    onClick={() => {
                                        const current = book.recommend_to ? book.recommend_to.split(',').map((s: string) => s.trim()).filter(Boolean) : [];
                                        let next;
                                        if (isSelected) {
                                            next = current.filter((n: string) => n !== u.name);
                                        } else {
                                            next = [...current, u.name];
                                        }
                                        setBook({ ...book, recommend_to: next.join(', ') });
                                    }}
                                    className={`recommend-toggle ${isSelected ? 'selected' : ''}`}
                                >
                                    {isSelected ? <UserPlus size={16} /> : <span className="recommend-placeholder" />}
                                    {u.name}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* 하단 버튼 섹션 */}
                <div className="book-form-actions">
                    <button
                        type="button"
                        className="btn form-cancel-btn"
                        onClick={onCancel}
                    >
                        취소하기
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary form-submit-btn"
                    >
                        {isEditing ? '수정 내용 저장' : '독서 기록 저장하기'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default BookForm;
