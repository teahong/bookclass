import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, BookOpen, Star, User, Gift, ExternalLink, X } from 'lucide-react';

interface RecommendedBooksPageProps {
    userName: string;
    onBack: () => void;
}

const RecommendedBooksPage: React.FC<RecommendedBooksPageProps> = ({ userName, onBack }) => {
    const [books, setBooks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedBook, setSelectedBook] = useState<any>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    useEffect(() => {
        fetchRecommendedBooks();
    }, []);

    const fetchRecommendedBooks = async () => {
        try {
            // 모든 책을 가져온 후 클라이언트 측에서 필터링 (간단한 가족 앱 규모에 적합)
            const { data, error } = await supabase
                .from('books')
                .select('*')
                .not('recommend_to', 'is', null) // 추천이 있는 책만 조회
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data) {
                const myRecommendations = data.filter(book =>
                    book.recommend_to && book.recommend_to.split(',').map((s: string) => s.trim()).includes(userName)
                );
                setBooks(myRecommendations);
            }
        } catch (error) {
            console.error('추천 도서 불러오기 실패:', error);
        } finally {
            setLoading(false);
        }
    };

    const getUserColor = (name: string) => {
        const palette = [
            { bg: '#FFF9C4', text: '#F57F17', icon: '#FBC02D' },
            { bg: '#e3f2fd', text: '#1565c0', icon: '#1e88e5' },
            { bg: '#e8f5e9', text: '#2e7d32', icon: '#43a047' },
            { bg: '#f3e5f5', text: '#7b1fa2', icon: '#8e24aa' },
            { bg: '#fff1f2', text: '#be123c', icon: '#f43f5e' },
            { bg: '#ecfeff', text: '#0e7490', icon: '#06b6d4' }
        ];
        const idx = [...(name || 'default')].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % palette.length;
        return palette[idx];
    };

    const handleBookClick = (book: any) => {
        setSelectedBook(book);
        setIsDetailOpen(true);
    };

    return (
        <div className="dashboard-container fade-in-page">
            <header className="recommended-header">
                <button
                    onClick={onBack}
                    className="recommended-back-btn"
                >
                    <ArrowLeft size={24} color="#333" />
                </button>
                <div>
                    <h1 className="recommended-title">
                        <Gift color="var(--primary)" size={32} />
                        <span className="recommended-name">{userName}</span>님을 위한 추천 도서
                    </h1>
                    <p className="recommended-subtitle">가족들이 회원님에게 추천한 책들을 모아봤어요.</p>
                </div>
            </header>

            {loading ? (
                <div className="recommended-loading">
                    불러오는 중...
                </div>
            ) : books.length === 0 ? (
                <div className="glass-card recommended-empty">
                    <BookOpen size={48} className="recommended-empty-icon" />
                    <p>아직 추천 받은 책이 없어요.</p>
                    <p className="recommended-empty-sub">가족들에게 책을 추천해달라고 해보세요!</p>
                </div>
            ) : (
                <div className="grid-family recommended-grid">
                    {books.map(book => {
                        const userColor = getUserColor(book.user_id);
                        return (
                            <div
                                key={book.id}
                                className="glass-card book-card recommended-card"
                                onClick={() => handleBookClick(book)}
                            >
                                <div className="recommended-row">
                                    {/* 표지 이미지 */}
                                    <div className="recommended-cover-wrap">
                                        <div className="recommended-cover-frame">
                                            {book.cover_url ? (
                                                <img src={book.cover_url} alt={book.title} className="recommended-cover-image" />
                                            ) : (
                                                <BookOpen size={20} color="#adb5bd" />
                                            )}
                                        </div>
                                    </div>

                                    <div className="recommended-content">
                                        <div
                                            className="recommended-badge"
                                            style={{
                                                ['--badge-bg' as any]: userColor.bg,
                                                ['--badge-text' as any]: userColor.text
                                            } as React.CSSProperties}
                                        >
                                            <User size={12} color={userColor.icon} />
                                            {book.user_id}님의 추천
                                        </div>
                                        <h4 className="recommended-book-title">
                                            {book.title}
                                        </h4>
                                        <p className="recommended-author">
                                            {book.author}
                                        </p>
                                        <div className="recommended-meta">
                                            <div className="recommended-rating">
                                                <Star size={14} fill="gold" stroke="gold" />
                                                <span className="recommended-rating-value">{book.rating}</span>
                                            </div>
                                            {/* 리스트에는 링크 아이콘 작게 유지 (모달 유도를 위해 제거할 수도 있지만, 빠른 접근을 위해 유지) */}
                                            {book.link && (
                                                <ExternalLink size={14} color="#aaa" />
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="recommended-review">
                                    "{book.review_content}"
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* 상세 보기 모달 (Read-Only) */}
            {isDetailOpen && selectedBook && (
                <div className="modal-backdrop" onClick={() => setIsDetailOpen(false)}>
                    <div
                        className="glass-card detail-modal"
                        style={{ animation: 'fadeIn 0.3s' }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header Actions */}
                        <div className="detail-header-actions">
                            <button onClick={() => setIsDetailOpen(false)} className="icon-btn-clean" title="닫기" style={{ color: '#999' }}>
                                <X size={24} />
                            </button>
                        </div>

                        <div className="recommended-detail-stack">
                            <div className="recommended-detail-row">
                                {/* Big Cover */}
                                <div className="recommended-detail-cover-col">
                                    <div className="recommended-detail-cover-frame">
                                        {selectedBook.cover_url ? (
                                            <img src={selectedBook.cover_url} alt={selectedBook.title} className="recommended-detail-cover-image" />
                                        ) : (
                                            <BookOpen size={60} color="#ccc" />
                                        )}
                                    </div>

                                    {/* 원문 보기 버튼 강조 */}
                                    {selectedBook.link && (
                                        <a
                                            href={selectedBook.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="recommended-link-btn"
                                        >
                                            <ExternalLink size={18} /> 원문 보기
                                        </a>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="recommended-detail-content">
                                    <div className="recommended-detail-meta-row">
                                        {(() => {
                                            const uColor = getUserColor(selectedBook.user_id);
                                            return (
                                                <div
                                                    className="recommended-badge recommended-badge-lg"
                                                    style={{
                                                        ['--badge-bg' as any]: uColor.bg,
                                                        ['--badge-text' as any]: uColor.text
                                                    } as React.CSSProperties}
                                                >
                                                    <User size={14} color={uColor.icon} />
                                                    {selectedBook.user_id}님의 추천
                                                </div>
                                            );
                                        })()}
                                        <div className="recommended-divider">|</div>
                                        <div className="recommended-read-date">
                                            {selectedBook.read_date} 읽음
                                        </div>
                                    </div>

                                    <h2 className="recommended-detail-title">{selectedBook.title}</h2>
                                    <div className="recommended-detail-author">
                                        {selectedBook.author} {selectedBook.publisher && `| ${selectedBook.publisher}`}
                                    </div>

                                    <div className="recommended-detail-rating">
                                        {[...Array(5)].map((_, i) => (
                                            <Star key={i} size={24} fill={i < selectedBook.rating ? "gold" : "none"} stroke="gold" />
                                        ))}
                                        <span className="recommended-detail-rating-value">{selectedBook.rating}.0</span>
                                    </div>

                                    <div className="recommended-detail-review-card">
                                        <h4 className="recommended-detail-review-title">📝 추천 사유 (감상문)</h4>
                                        <p className="recommended-detail-review-text">
                                            {selectedBook.review_content}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default RecommendedBooksPage;
