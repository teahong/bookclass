import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Book, Type, ArrowLeft } from 'lucide-react';

interface ChallengePageProps {
    onBack: () => void;
}

const ChallengePage: React.FC<ChallengePageProps> = ({ onBack }) => {
    const [stats, setStats] = useState<any[]>([]);
    const [viewType, setViewType] = useState<'count' | 'words'>('count');
    const [animate, setAnimate] = useState(false);

    const colorPalette = ['#4a90e2', '#e91e63', '#2ecc71', '#f39c12', '#8e44ad', '#16a085', '#e67e22', '#34495e'];
    const getMemberColor = (name: string) => {
        const idx = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % colorPalette.length;
        return colorPalette[idx];
    };

    useEffect(() => {
        fetchStats();
        // Trigger animation after mount
        const timer = setTimeout(() => setAnimate(true), 100);
        return () => clearTimeout(timer);
    }, []);

    const fetchStats = async () => {
        const { data: books } = await supabase.from('books').select('user_id, review_word_count');
        const { data: users } = await supabase.from('users').select('id, name').order('name', { ascending: true });

        if (books && users) {
            const aggregated = users.map(user => {
                const memberBooks = books.filter(b => b.user_id === user.name || b.user_id === user.id);
                return {
                    name: user.name,
                    count: memberBooks.length,
                    words: memberBooks.reduce((sum, b) => sum + (b.review_word_count || 0), 0)
                };
            });
            setStats(aggregated);
        }
    };

    const getRank = (name: string) => {
        const currentUser = stats.find(s => s.name === name);
        if (!currentUser) return -1;

        const currentVal = viewType === 'count' ? currentUser.count : currentUser.words;

        // 자신보다 점수가 높은 사람의 수를 셉니다.
        const higherCount = stats.filter(s => {
            const val = viewType === 'count' ? s.count : s.words;
            return val > currentVal;
        }).length;

        return higherCount;
    };

    const maxValue = Math.max(...stats.map(s => viewType === 'count' ? s.count : s.words), 1);

    const handleViewChange = (type: 'count' | 'words') => {
        setViewType(type);
        setAnimate(false);
        setTimeout(() => setAnimate(true), 50);
    };

    return (
        <div className="challenge-container">
            <div className="challenge-header">
                <button className="btn challenge-back-btn" onClick={onBack}>
                    <ArrowLeft size={18} />
                    뒤로가기
                </button>
                <h1 className="title challenge-title">독서 챌린지</h1>
            </div>

            <div className="glass-card challenge-panel">
                {/* Toggle Buttons */}
                <div className="challenge-toggle-row">
                    <button
                        className={`btn challenge-toggle-btn ${viewType === 'count' ? 'btn-primary' : ''}`}
                        onClick={() => handleViewChange('count')}
                    >
                        <Book size={20} />
                        등록된 책 수
                    </button>
                    <button
                        className={`btn challenge-toggle-btn ${viewType === 'words' ? 'btn-primary' : ''}`}
                        onClick={() => handleViewChange('words')}
                    >
                        <Type size={20} />
                        독서감상문 글자 수
                    </button>
                </div>

                {/* Graph Area */}
                <div className="challenge-graph-scroll">
                    <div
                        className="challenge-graph-area"
                        style={{ width: `${Math.max(stats.length * 84, 620)}px` }}
                    >
                        {stats.map((user) => {
                        const val = viewType === 'count' ? user.count : user.words;
                        // Use 75% as max height to leave plenty of room for medals/labels
                        const heightPercent = (val / maxValue) * 75;
                        const rank = getRank(user.name);
                        const isWinner = rank === 0 && val > 0;

                        return (
                            <div key={user.name} className="challenge-member-col">
                                {/* Medal & Value Wrapper */}
                                <div className={`challenge-medal-wrap ${animate ? 'show' : ''}`}>
                                    {rank === 0 && val > 0 && (
                                        <div className="trophy-wrap rank-1">
                                            <div className="glow-gold"></div>
                                            <img
                                                src="/trophy_gold.png"
                                                alt="1등 트로피"
                                                className="trophy-img rank-1"
                                            />
                                        </div>
                                    )}
                                    {rank === 1 && val > 0 && (
                                        <div className="trophy-wrap rank-2">
                                            <div className="glow-silver"></div>
                                            <img
                                                src="/trophy_gold.png"
                                                alt="2등 트로피"
                                                className="trophy-img rank-2"
                                            />
                                        </div>
                                    )}
                                    {rank === 2 && val > 0 && (
                                        <div className="trophy-wrap rank-3">
                                            <div className="glow-bronze"></div>
                                            <img
                                                src="/trophy_gold.png"
                                                alt="3등 트로피"
                                                className="trophy-img rank-3"
                                            />
                                        </div>
                                    )}

                                    <div className={`challenge-value ${rank === 0 ? 'winner-gap' : ''}`}>
                                        {viewType === 'count' ? `${val}권` : `${val.toLocaleString()}자`}
                                    </div>
                                </div>

                                {/* Bar */}
                                <div
                                    className={`challenge-bar ${isWinner ? 'winner' : ''}`}
                                    style={{
                                        height: animate ? `${Math.max(heightPercent, 2)}%` : '0%',
                                        backgroundColor: getMemberColor(user.name)
                                    }}
                                >
                                    {/* Shine effect for winner */}
                                    {isWinner && (
                                        <div className="challenge-bar-shine"></div>
                                    )}
                                </div>

                                {/* Name Label */}
                                <div className="challenge-name-label">
                                    {user.name}
                                </div>
                            </div>
                        );
                    })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChallengePage;
