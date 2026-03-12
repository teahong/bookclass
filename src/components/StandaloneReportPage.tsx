import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { BookOpen, Activity, TrendingUp, ExternalLink, Printer, Share2 } from 'lucide-react';

interface StandaloneReportPageProps {
    userName: string;
    onHome: () => void;
}

/**
 * 공유용 단독 리포트 페이지
 * 로그인 없이(또는 간편하게) AI 리포트만 확인할 수 있는 페이지입니다.
 */
const StandaloneReportPage: React.FC<StandaloneReportPageProps> = ({ userName, onHome }) => {
    const [analysisResult, setAnalysisResult] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchReport();
    }, [userName]);

    const fetchReport = async () => {
        try {
            setLoading(true);
            // 1. 유저 ID 찾기
            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('id, name')
                .eq('name', userName)
                .single();

            if (userError || !userData) {
                setError("사용자를 찾을 수 없습니다.");
                return;
            }

            // 2. 리포트 데이터 가져오기
            const { data: reportData, error: reportError } = await supabase
                .from('ai_analysis')
                .select('*')
                .eq('user_id', userData.id)
                .maybeSingle();

            if (reportError) {
                setError("리포트를 불러오는 중 오류가 발생했습니다.");
                return;
            }

            if (!reportData) {
                setError("아직 생성된 리포트가 없습니다.");
                return;
            }

            setAnalysisResult(reportData);
        } catch (e) {
            setError("데이터를 불러오는 중 오류가 발생했습니다.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleShare = async () => {
        const shareUrl = window.location.href;
        const shareData = {
            title: `${userName}님의 독서 분석 리포트`,
            text: '교실 독서 AI가 분석한 독서 리포트입니다.',
            url: shareUrl
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData);
            } else {
                await navigator.clipboard.writeText(shareUrl);
                alert('리포트 링크가 복사되었습니다!');
            }
        } catch (err) {
            console.error(err);
            try {
                await navigator.clipboard.writeText(shareUrl);
                alert('리포트 링크가 복사되었습니다!');
            } catch (e) {
                prompt('이 링크를 복사하여 공유하세요:', shareUrl);
            }
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: '20px' }}>
                <div className="spinner"></div> {/* CSS spinner class assumed or text */}
                <div style={{ fontSize: '1.2rem', color: 'var(--primary)', fontWeight: 'bold' }}>{userName}님의 리포트를 불러오는 중...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div style={{ textAlign: 'center', padding: '50px', maxWidth: '600px', margin: '0 auto' }}>
                <h2 style={{ fontSize: '1.5rem', marginBottom: '20px', color: '#e74c3c' }}>😢 죄송합니다</h2>
                <p style={{ color: '#666', marginBottom: '30px' }}>{error}</p>
                <button onClick={onHome} className="btn btn-primary">홈으로 이동</button>
            </div>
        );
    }

    return (
        <div className="print-target" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px', minHeight: '100vh', background: '#f8fafc' }}>
            <div className="glass-card" style={{ padding: '40px', background: 'white', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                {/* 헤더 */}
                <header style={{ borderBottom: '2px solid #f1f5f9', paddingBottom: '20px', marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
                    <div>
                        <div style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 'bold', marginBottom: '5px' }}>BOOK FAMILY AI REPORT</div>
                        <h1 style={{ fontSize: '2rem', margin: 0, color: '#1e293b' }}>{userName}님의 독서 분석</h1>
                    </div>
                    <button
                        onClick={() => window.print()}
                        className="btn-secondary no-print"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '20px', fontSize: '0.9rem' }}
                    >
                        <Printer size={16} /> 인쇄/PDF
                    </button>
                    <button
                        onClick={handleShare}
                        className="btn-primary no-print"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', borderRadius: '20px', fontSize: '0.9rem', color: 'white', border: 'none' }}
                    >
                        <Share2 size={16} /> 링크 공유
                    </button>
                </header>

                {/* 본문 */}
                <div style={{ display: 'grid', gap: '30px' }}>

                    {/* 1. 수준 진단 */}
                    <section>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', marginBottom: '15px', color: '#0369a1' }}>
                            <Activity size={24} /> 읽기/쓰기 수준 진단
                        </h3>
                        <div style={{ background: '#f0f9ff', padding: '25px', borderRadius: '15px', lineHeight: '1.8', color: '#334155', fontSize: '1.05rem' }}>
                            {analysisResult.level}
                        </div>
                    </section>

                    {/* 2. 관심사 */}
                    <section>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', marginBottom: '15px', color: '#a21caf' }}>
                            <TrendingUp size={24} /> 관심 분야 및 독서 성향
                        </h3>
                        <div style={{ background: '#fdf4ff', padding: '25px', borderRadius: '15px', lineHeight: '1.8', color: '#334155', fontSize: '1.05rem' }}>
                            {analysisResult.interest}
                        </div>
                    </section>

                    {/* 3. 추천 도서 */}
                    <section>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '1.2rem', marginBottom: '15px', color: '#15803d' }}>
                            <BookOpen size={24} /> AI 맞춤 추천 도서
                        </h3>
                        <div style={{ display: 'grid', gap: '20px' }}>
                            {Array.isArray(analysisResult.recommendations) && analysisResult.recommendations.map((book: any, idx: number) => (
                                <div key={idx} style={{
                                    display: 'flex', gap: '20px', padding: '20px', borderRadius: '15px', border: '1px solid #e2e8f0', background: 'white',
                                    alignItems: 'start'
                                }}>
                                    {book.cover_url ? (
                                        <img src={book.cover_url} alt={book.title} style={{ width: '80px', borderRadius: '8px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }} />
                                    ) : (
                                        <div style={{ width: '80px', height: '110px', background: '#f1f5f9', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <BookOpen color="#cbd5e1" />
                                        </div>
                                    )}
                                    <div style={{ flex: 1 }}>
                                        <h4 style={{ margin: '0 0 5px 0', fontSize: '1.1rem', color: '#1e293b' }}>{book.title}</h4>
                                        <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '10px' }}>{book.author}</div>
                                        <p style={{ margin: '0 0 10px 0', fontSize: '0.95rem', color: '#475569', lineHeight: '1.5' }}>{book.reason}</p>

                                        {book.link && (
                                            <a
                                                href={book.link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="no-print"
                                                style={{
                                                    display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#15803d',
                                                    fontSize: '0.9rem', fontWeight: '600', textDecoration: 'none'
                                                }}
                                            >
                                                <ExternalLink size={14} /> 알라딘에서 상세보기
                                            </a>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>

                <footer style={{ marginTop: '50px', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem', borderTop: '1px solid #f1f5f9', paddingTop: '20px' }}>
                    Analyzed by Classroom Reading AI • <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={onHome}>홈으로 가기</span>
                </footer>
            </div>
        </div>
    );
};

export default StandaloneReportPage;
