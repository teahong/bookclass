import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ArrowLeft, BookOpen, Lock, Activity, Sparkles, TrendingUp, BarChart2, ExternalLink, Share2, Trash2, CalendarDays, ChevronLeft, ChevronRight, Users, ChevronDown, ChevronUp, Pencil, Save, X } from 'lucide-react';
import { analyzeReadingPatterns } from '../lib/gemini';

interface AdminPageProps {
    onBack: () => void;
}

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

interface AnalysisRecommendation {
    title?: string;
    author?: string;
    reason?: string;
    cover_url?: string;
    link?: string;
    rank?: number;
    [key: string]: unknown;
}

interface AnalysisReport {
    level?: string;
    interest?: string;
    recommendations?: AnalysisRecommendation[];
    error?: string;
}

const createAnalysisDraft = (analysis: AnalysisReport | null): AnalysisReport => ({
    level: analysis?.level || '',
    interest: analysis?.interest || '',
    recommendations: Array.isArray(analysis?.recommendations)
        ? analysis.recommendations.map((book) => ({
            ...book,
            title: book.title || '',
            author: book.author || '',
            reason: book.reason || ''
        }))
        : []
});

const formatDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const buildCalendarDays = (baseDate: Date) => {
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDay = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const calendarDays: Array<{ date: Date; isCurrentMonth: boolean }> = [];

    for (let i = startDay - 1; i >= 0; i -= 1) {
        calendarDays.push({
            date: new Date(year, month, -i),
            isCurrentMonth: false
        });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
        calendarDays.push({
            date: new Date(year, month, day),
            isCurrentMonth: true
        });
    }

    while (calendarDays.length < 42) {
        const nextDay = calendarDays.length - (startDay + daysInMonth) + 1;
        calendarDays.push({
            date: new Date(year, month + 1, nextDay),
            isCurrentMonth: false
        });
    }

    return calendarDays;
};

/**
 * 관리자 페이지 컴포넌트
 * 교실 전체의 독서 통계를 확인하고, AI 분석을 통해 맞춤 리포트를 생성합니다.
 */
const AdminPage: React.FC<AdminPageProps> = ({ onBack }) => {
    const [books, setBooks] = useState<any[]>([]);          // 전체 도서 데이터
    const [users, setUsers] = useState<any[]>([]);          // 학생 유저 목록
    const [loading, setLoading] = useState(true);           // 초기 로딩 상태
    const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
    const [savingCommentId, setSavingCommentId] = useState<string | null>(null);

    // AI 분석 관련 상태
    const [selectedUser, setSelectedUser] = useState<string>(''); // 분석 대상 유저 이름
    const [analysisResult, setAnalysisResult] = useState<any>(null); // 분석 결과 데이터
    const [analysisDraft, setAnalysisDraft] = useState<AnalysisReport | null>(null);
    const [isEditingAnalysis, setIsEditingAnalysis] = useState(false);
    const [isSavingAnalysis, setIsSavingAnalysis] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);        // AI 분석 중 로딩 상태
    const [statsType, setStatsType] = useState<'count' | 'length'>('count'); // 통계 기준 (권수 vs 글자수)
    const [newStudentName, setNewStudentName] = useState('');
    const [newStudentAge, setNewStudentAge] = useState('');
    const [addingStudent, setAddingStudent] = useState(false);
    const [studentError, setStudentError] = useState('');
    const [bulkStudentInput, setBulkStudentInput] = useState('');
    const [bulkDefaultAge, setBulkDefaultAge] = useState('');
    const [addingBulkStudents, setAddingBulkStudents] = useState(false);
    const [bulkError, setBulkError] = useState('');
    const [bulkSuccess, setBulkSuccess] = useState('');
    const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
    const [calendarMonth, setCalendarMonth] = useState(() => {
        const today = new Date();
        return new Date(today.getFullYear(), today.getMonth(), 1);
    });
    const [selectedCalendarDate, setSelectedCalendarDate] = useState<string | null>(null);
    const [isStudentManagerOpen, setIsStudentManagerOpen] = useState(false);

    // 컴포넌트 마운트 시 데이터 fetch
    useEffect(() => {
        fetchData();
    }, []);

    // 선택된 유저가 바뀔 때마다 기존에 저장된 AI 분석 결과가 있는지 가져옴
    useEffect(() => {
        if (selectedUser && users.length > 0) {
            setIsEditingAnalysis(false);
            setAnalysisDraft(null);
            fetchAIAnalysis();
        }
    }, [selectedUser, users]);

    /**
     * DB에서 전체 도서 정보와 유저 정보를 동시에 가져옵니다.
     */
    const fetchData = async () => {
        setLoading(true);
        // 전체 도서 목록 조회
        const { data: booksData } = await supabase.from('books').select('*');
        if (booksData) {
            setBooks(booksData);
            setCommentDrafts(
                booksData.reduce((acc, book) => {
                    acc[book.id] = book.teacher_comment || '';
                    return acc;
                }, {} as Record<string, string>)
            );
        }

        // 연령 정보를 포함한 유저 목록 조회
        const { data: usersData } = await supabase.from('users').select('id, name, age');
        if (usersData) {
            setUsers(usersData);
            // 첫 번째 유저를 기본 선택값으로 설정
            if (usersData.length > 0) setSelectedUser(usersData[0].name);
        }
        setLoading(false);
    };

    /**
     * 특정 유저에 대해 과거에 수행한 AI 분석 결과가 있다면 가져옵니다.
     */
    const fetchAIAnalysis = async () => {
        const targetUser = users.find(u => u.name === selectedUser);
        if (!targetUser) return;

        const { data, error } = await supabase
            .from('ai_analysis')
            .select('*')
            .eq('user_id', targetUser.id)
            .maybeSingle();

        if (error) {
            console.error('AI 분석 결과 조회 실패:', error);
            setAnalysisResult(null);
            setAnalysisDraft(null);
            return;
        }

        if (data) {
            const report = {
                level: data.level,
                interest: data.interest,
                recommendations: data.recommendations
            };
            setAnalysisResult(report);
            setAnalysisDraft(createAnalysisDraft(report));
        } else {
            setAnalysisResult(null); // 기록이 없으면 null 설정
            setAnalysisDraft(null);
        }
    };

    // --- 통계 계산 로직 ---
    const totalBooks = books.length;
    const totalLength = books.reduce((acc, book) => acc + (book.review_content ? book.review_content.length : 0), 0);

    // 학생별 독서 데이터 집계
    const booksByUser = users.map(u => {
        // 이름이나 ID로 매칭 (데이터 무결성 고려)
        const userBooks = books.filter(b =>
            (b.user_id?.trim() === u.name?.trim()) || (b.user_id?.trim() === u.id?.trim())
        );
        return {
            name: u.name,
            id: u.id,
            count: userBooks.length,
            length: userBooks.reduce((acc, b) => acc + (b.review_content ? b.review_content.length : 0), 0)
        };
    }).sort((a, b) => statsType === 'count' ? b.count - a.count : b.length - a.length);

    // 독서량 1위 유저 (독서왕)
    const readingKing = booksByUser.length > 0 ? booksByUser[0] : null;
    const userNameById = users.reduce((acc, user) => {
        acc[user.id] = user.name;
        return acc;
    }, {} as Record<string, string>);
    const booksByDate = books.reduce((acc, book) => {
        if (!book.read_date) return acc;
        const dateKey = book.read_date;
        const displayName = userNameById[book.user_id] || book.user_id || '이름 없음';
        acc[dateKey] = [...(acc[dateKey] || []), { ...book, displayName }];
        return acc;
    }, {} as Record<string, any[]>);
    const calendarDays = buildCalendarDays(calendarMonth);
    const currentMonthLabel = `${calendarMonth.getFullYear()}년 ${calendarMonth.getMonth() + 1}월`;
    const monthlyBooks = books.filter((book) => {
        if (!book.read_date) return false;
        const readDate = new Date(book.read_date);
        return readDate.getFullYear() === calendarMonth.getFullYear() && readDate.getMonth() === calendarMonth.getMonth();
    });
    const monthlyStudents = new Set(monthlyBooks.map((book) => userNameById[book.user_id] || book.user_id).filter(Boolean)).size;
    const todayKey = formatDateKey(new Date());
    const selectedDateBooks = selectedCalendarDate ? (booksByDate[selectedCalendarDate] || []) : [];

    const handleTeacherCommentSave = async (bookId: string) => {
        const teacherComment = (commentDrafts[bookId] || '').trim();
        setSavingCommentId(bookId);

        const { error } = await supabase
            .from('books')
            .update({
                teacher_comment: teacherComment || null,
                teacher_commented_at: teacherComment ? new Date().toISOString() : null
            })
            .eq('id', bookId);

        if (error) {
            alert('교사 코멘트 저장 중 오류가 발생했습니다.');
            setSavingCommentId(null);
            return;
        }

        setBooks((prevBooks) => prevBooks.map((book) => (
            book.id === bookId
                ? {
                    ...book,
                    teacher_comment: teacherComment || null,
                    teacher_commented_at: teacherComment ? new Date().toISOString() : null
                }
                : book
        )));
        setSavingCommentId(null);
    };

    /**
     * 관리자 페이지에서 유저의 연령 정보를 직접 수정합니다.
     */
    const updateAge = async (userId: string, age: string) => {
        const val = parseInt(age);
        if (isNaN(val)) return;

        const { error } = await supabase
            .from('users')
            .update({ age: val })
            .eq('id', userId);

        if (!error) {
            setUsers(users.map(u => u.id === userId ? { ...u, age: val } : u));
        }
    };

    /**
     * 관리자(교사)가 새 학생 계정을 추가합니다.
     * PIN은 최초 로그인 시 학생이 직접 설정합니다.
     */
    const handleAddStudent = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = newStudentName.trim();
        if (!name) {
            setStudentError('학생 이름을 입력해주세요.');
            return;
        }

        setAddingStudent(true);
        setStudentError('');
        const parsedAge = parseInt(newStudentAge, 10);

        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('name', name)
            .maybeSingle();

        if (existing) {
            setStudentError('이미 존재하는 이름입니다. 다른 이름을 사용해주세요.');
            setAddingStudent(false);
            return;
        }

        const { error } = await supabase
            .from('users')
            .insert({
                name,
                age: Number.isNaN(parsedAge) ? null : parsedAge,
                pin: null
            });

        if (error) {
            setStudentError('학생 추가 중 오류가 발생했습니다.');
            setAddingStudent(false);
            return;
        }

        setNewStudentName('');
        setNewStudentAge('');
        setAddingStudent(false);
        fetchData();
    };

    const parseAge = (value?: string) => {
        if (!value) return null;
        const parsed = parseInt(value.trim(), 10);
        return Number.isNaN(parsed) ? null : parsed;
    };

    /**
     * 엑셀에서 복사한 이름 목록을 일괄 추가합니다.
     * 지원 형식:
     * 1) 이름 (한 줄 1명)
     * 2) 이름[TAB]나이 (엑셀 2열 붙여넣기)
     */
    const handleBulkAddStudents = async (e: React.FormEvent) => {
        e.preventDefault();
        setBulkError('');
        setBulkSuccess('');

        const raw = bulkStudentInput.trim();
        if (!raw) {
            setBulkError('붙여넣을 학생 목록을 입력해주세요.');
            return;
        }

        const normalized = raw.replace(/\r/g, '');
        const lines = normalized.split('\n').flatMap((line) => {
            if (line.includes('\t')) return [line];
            if (!line.includes(',') || normalized.includes('\n')) return [line];
            return line.split(',');
        });

        const parsedRows = lines
            .map((line) => line.trim())
            .filter(Boolean)
            .map((line) => {
                const [namePart, agePart] = line.split('\t');
                return {
                    name: (namePart || '').trim(),
                    age: parseAge(agePart)
                };
            })
            .filter((row) => row.name.length > 0);

        if (parsedRows.length === 0) {
            setBulkError('유효한 학생 이름을 찾지 못했습니다.');
            return;
        }

        const uniqueRows = Array.from(
            new Map(parsedRows.map((row) => [row.name, row])).values()
        );

        setAddingBulkStudents(true);
        const names = uniqueRows.map((row) => row.name);
        const defaultAge = parseAge(bulkDefaultAge);

        const { data: existingUsers, error: existingError } = await supabase
            .from('users')
            .select('name')
            .in('name', names);

        if (existingError) {
            setBulkError('기존 학생 확인 중 오류가 발생했습니다.');
            setAddingBulkStudents(false);
            return;
        }

        const existingNameSet = new Set((existingUsers || []).map((u: any) => u.name));
        const rowsToInsert = uniqueRows.filter((row) => !existingNameSet.has(row.name));

        if (rowsToInsert.length === 0) {
            setBulkSuccess('추가할 새 학생이 없습니다. (모두 기존 이름)');
            setAddingBulkStudents(false);
            return;
        }

        const { error: insertError } = await supabase
            .from('users')
            .insert(
                rowsToInsert.map((row) => ({
                    name: row.name,
                    age: row.age ?? defaultAge,
                    pin: null
                }))
            );

        if (insertError) {
            setBulkError('학생 일괄 추가 중 오류가 발생했습니다.');
            setAddingBulkStudents(false);
            return;
        }

        const skippedCount = uniqueRows.length - rowsToInsert.length;
        setBulkSuccess(`학생 ${rowsToInsert.length}명 추가 완료${skippedCount > 0 ? ` (중복 ${skippedCount}명 제외)` : ''}`);
        setBulkStudentInput('');
        setAddingBulkStudents(false);
        fetchData();
    };

    /**
     * 학생 계정 및 연관 데이터를 삭제합니다.
     */
    const handleDeleteStudent = async (user: any) => {
        const confirmed = window.confirm(
            `${user.name} 학생을 삭제하시겠습니까?\n관련 독서기록과 AI 분석 데이터도 함께 삭제됩니다.`
        );
        if (!confirmed) return;

        setDeletingUserId(user.id);

        // books.user_id가 이름/uuid 둘 다 쓰일 수 있어 둘 다 정리
        const { error: bookDeleteError } = await supabase
            .from('books')
            .delete()
            .or(`user_id.eq.${user.name},user_id.eq.${user.id}`);

        if (bookDeleteError) {
            setDeletingUserId(null);
            alert('독서기록 삭제 중 오류가 발생했습니다.');
            return;
        }

        const { error: analysisDeleteError } = await supabase
            .from('ai_analysis')
            .delete()
            .eq('user_id', user.id);

        if (analysisDeleteError) {
            setDeletingUserId(null);
            alert('AI 분석 데이터 삭제 중 오류가 발생했습니다.');
            return;
        }

        const { error: userDeleteError } = await supabase
            .from('users')
            .delete()
            .eq('id', user.id);

        if (userDeleteError) {
            setDeletingUserId(null);
            alert('학생 삭제 중 오류가 발생했습니다.');
            return;
        }

        if (selectedUser === user.name) {
            setSelectedUser('');
            setAnalysisResult(null);
        }

        setDeletingUserId(null);
        fetchData();
    };

    /**
     * Gemini AI를 호출하여 선택된 유저의 독서 패턴을 심층 분석합니다.
     */
    const handleAnalyze = async () => {
        if (!selectedUser) return;
        setIsAnalyzing(true);

        const targetUser = users.find(u => u.name === selectedUser);
        if (!targetUser) return;

        // 10글자 이상의 유효한 독서 감상문만 추출하여 분석에 사용
        const userBooks = books.filter(b =>
            ((b.user_id?.trim() === selectedUser?.trim()) || (b.user_id?.trim() === targetUser.id?.trim())) &&
            b.review_content && b.review_content.trim().length >= 10
        );

        const reviews = userBooks.map(b => b.review_content);

        // 분석할 데이터가 부족한 경우
        if (reviews.length === 0) {
            setAnalysisResult({ error: `${selectedUser}님의 독서록 중 10글자 이상의 유효한 데이터가 부족합니다.` });
            setIsAnalyzing(false);
            return;
        }

        // Gemini AI 호출 (lib/gemini.ts의 RAG 로직 실행)
        const result = await analyzeReadingPatterns(selectedUser, reviews, targetUser?.age);

        if (result && !(result as any).error) {
            setAnalysisResult(result);
            setAnalysisDraft(createAnalysisDraft(result));
            setIsEditingAnalysis(false);

            // 분석 결과를 DB에 저장(upsert)하여 나중에 바로 보여줄 수 있게 함
            await supabase
                .from('ai_analysis')
                .upsert({
                    user_id: targetUser.id,
                    level: (result as any).level,
                    interest: (result as any).interest,
                    recommendations: (result as any).recommendations,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });
        } else {
            setAnalysisResult({ error: 'AI 분석 수행 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' });
        }
        setIsAnalyzing(false);
    };

    const handleStartAnalysisEdit = () => {
        setAnalysisDraft(createAnalysisDraft(analysisResult));
        setIsEditingAnalysis(true);
    };

    const handleCancelAnalysisEdit = () => {
        setAnalysisDraft(createAnalysisDraft(analysisResult));
        setIsEditingAnalysis(false);
    };

    const updateAnalysisDraft = (field: 'level' | 'interest', value: string) => {
        setAnalysisDraft((prev) => ({
            ...createAnalysisDraft(prev),
            [field]: value
        }));
    };

    const updateRecommendationDraft = (index: number, field: 'title' | 'author' | 'reason', value: string) => {
        setAnalysisDraft((prev) => {
            const draft = createAnalysisDraft(prev);
            const recommendations = [...(draft.recommendations || [])];
            recommendations[index] = {
                ...recommendations[index],
                [field]: value
            };
            return { ...draft, recommendations };
        });
    };

    const removeRecommendationDraft = (index: number) => {
        setAnalysisDraft((prev) => {
            const draft = createAnalysisDraft(prev);
            return {
                ...draft,
                recommendations: (draft.recommendations || []).filter((_, itemIndex) => itemIndex !== index)
            };
        });
    };

    const handleSaveAnalysisEdit = async () => {
        if (!selectedUser || !analysisDraft) return;
        const targetUser = users.find(u => u.name === selectedUser);
        if (!targetUser) return;

        const nextReport = {
            level: (analysisDraft.level || '').trim(),
            interest: (analysisDraft.interest || '').trim(),
            recommendations: (analysisDraft.recommendations || []).map((book) => ({
                ...book,
                title: String(book.title || '').trim(),
                author: String(book.author || '').trim(),
                reason: String(book.reason || '').trim()
            }))
        };

        setIsSavingAnalysis(true);
        const { error } = await supabase
            .from('ai_analysis')
            .upsert({
                user_id: targetUser.id,
                level: nextReport.level,
                interest: nextReport.interest,
                recommendations: nextReport.recommendations,
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (error) {
            alert('AI 추천 리포트 저장 중 오류가 발생했습니다.');
            setIsSavingAnalysis(false);
            return;
        }

        setAnalysisResult(nextReport);
        setAnalysisDraft(createAnalysisDraft(nextReport));
        setIsEditingAnalysis(false);
        setIsSavingAnalysis(false);
    };

    /**
     * 공유 페이지로 이동
     */
    const handleOpenSharePage = () => {
        if (!selectedUser) return;
        // StandaloneReportPage로 이동 (새 탭) 또는 현재 창 이동
        // 앱 내 라우팅을 위해 URL을 변경하고 리로딩 없이 App.tsx가 감지하게 하거나, 
        // 간단히 href 변경으로 처리. 여기서는 새 탭 열기로 '공유용 화면' 느낌을 줌.
        const shareUrl = `${window.location.origin}${window.location.pathname}?mode=report&user=${encodeURIComponent(selectedUser)}`;
        window.open(shareUrl, '_blank');
    };

    const displayedAnalysis = isEditingAnalysis && analysisDraft ? analysisDraft : analysisResult;

    return (
        <div className="dashboard-container" style={{ animation: 'fadeIn 0.5s' }}>
            {/* 상단 헤더: 뒤로가기 및 제목 */}
            <header style={{ display: 'flex', alignItems: 'center', marginBottom: '40px', gap: '20px', flexWrap: 'wrap' }}>
                <button onClick={onBack} className="btn-icon no-print" style={{ background: 'white', padding: '10px', borderRadius: '50%', border: '1px solid #eee', cursor: 'pointer', boxShadow: '0 2px 5px rgba(0,0,0,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ArrowLeft size={24} color="#333" />
                </button>
                <div>
                    <h1 style={{ fontSize: 'min(2rem, 6vw)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Lock color="var(--primary)" size={28} /> 관리자 리포트
                    </h1>
                    <p style={{ color: '#666' }}>우리 교실의 독서 성장을 한눈에 관리하세요.</p>
                </div>
            </header>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '50px', fontSize: '1.2rem', color: 'var(--primary)' }}>교실 데이터를 불러오는 중...</div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>

                    <section>
                        <div className="glass-card reading-calendar-card admin-calendar-card">
                            <div className="reading-calendar-header">
                                <div>
                                    <div className="reading-calendar-title-row">
                                        <CalendarDays size={18} />
                                        <h2 className="reading-calendar-title">독서 누가 달력</h2>
                                    </div>
                                    <p className="reading-calendar-description">
                                        날짜별로 누가 독서록을 남겼는지 교실 전체 흐름을 확인하세요.
                                    </p>
                                </div>
                                <div className="reading-calendar-summary">
                                    <strong>{monthlyBooks.length}건</strong>
                                    <span>{monthlyStudents}명 참여</span>
                                </div>
                            </div>

                            <div className="reading-calendar-toolbar">
                                <button
                                    type="button"
                                    className="reading-calendar-nav"
                                    onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                                    aria-label="이전 달"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <div className="reading-calendar-month">{currentMonthLabel}</div>
                                <button
                                    type="button"
                                    className="reading-calendar-nav"
                                    onClick={() => setCalendarMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                                    aria-label="다음 달"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>

                            <div className="reading-calendar-grid admin-calendar-grid">
                                {WEEKDAY_LABELS.map((label) => (
                                    <div key={label} className="reading-calendar-weekday">{label}</div>
                                ))}

                                {calendarDays.map(({ date, isCurrentMonth }) => {
                                    const dateKey = formatDateKey(date);
                                    const dayBooks = booksByDate[dateKey] || [];
                                    const dayStudents = Array.from(new Set(dayBooks.map((book: any) => book.displayName))) as string[];
                                    const isToday = dateKey === todayKey;

                                    return (
                                        <div
                                            key={dateKey}
                                            className={`reading-calendar-cell admin-calendar-cell${isCurrentMonth ? '' : ' muted'}${isToday ? ' today' : ''}${dayBooks.length ? ' has-book' : ''}${selectedCalendarDate === dateKey ? ' selected' : ''}`}
                                            onClick={() => {
                                                if (!dayBooks.length) return;
                                                setSelectedCalendarDate((prev) => prev === dateKey ? null : dateKey);
                                            }}
                                        >
                                            <div className="admin-calendar-cell-top">
                                                <span className="reading-calendar-date">{date.getDate()}</span>
                                                {dayBooks.length > 0 && (
                                                    <span className="reading-calendar-badge">
                                                        <BookOpen size={12} />
                                                        <span>{dayBooks.length}</span>
                                                    </span>
                                                )}
                                            </div>

                                            {dayStudents.length > 0 && (
                                                <div className="admin-calendar-names">
                                                    {dayStudents.slice(0, 2).map((name) => (
                                                        <span key={name} className="admin-calendar-name-pill">{name}</span>
                                                    ))}
                                                    {dayStudents.length > 2 && (
                                                        <span className="admin-calendar-more">+{dayStudents.length - 2}</span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>

                            {selectedCalendarDate && selectedDateBooks.length > 0 && (
                                <div className="reading-calendar-detail">
                                    <div className="reading-calendar-detail-head">
                                        <strong>{selectedCalendarDate}</strong>
                                        <span>{selectedDateBooks.length}개의 독서록</span>
                                    </div>
                                    <div className="reading-calendar-detail-list">
                                        {selectedDateBooks.map((book: any) => (
                                            <div
                                                key={book.id}
                                                className="reading-calendar-detail-item"
                                                style={{ alignItems: 'flex-start' }}
                                            >
                                                <div className="reading-calendar-detail-icon">
                                                    {book.cover_url ? (
                                                        <img src={book.cover_url} alt={book.title} />
                                                    ) : (
                                                        <BookOpen size={18} />
                                                    )}
                                                </div>
                                                <div className="reading-calendar-detail-content" style={{ gap: '10px' }}>
                                                    <div>
                                                        <strong>{book.title}</strong>
                                                        <span>{book.displayName} · {book.author || '작가 정보 없음'}</span>
                                                    </div>
                                                    <p style={{ margin: 0, color: '#475569', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                                                        {book.review_content || '작성된 감상문이 없습니다.'}
                                                    </p>
                                                    <div style={{ display: 'grid', gap: '8px' }}>
                                                        <label style={{ fontSize: '0.9rem', fontWeight: 700, color: '#334155' }}>
                                                            교사 코멘트
                                                        </label>
                                                        <textarea
                                                            className="input-field"
                                                            rows={4}
                                                            placeholder="학생 글에 남길 피드백을 입력하세요."
                                                            value={commentDrafts[book.id] || ''}
                                                            onChange={(e) => setCommentDrafts((prev) => ({ ...prev, [book.id]: e.target.value }))}
                                                            style={{ resize: 'vertical', background: 'white' }}
                                                        />
                                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                                            <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                                                                저장하면 학생 화면에서도 바로 보입니다.
                                                            </span>
                                                            <button
                                                                type="button"
                                                                className="btn btn-primary"
                                                                onClick={() => handleTeacherCommentSave(book.id)}
                                                                disabled={savingCommentId === book.id}
                                                            >
                                                                {savingCommentId === book.id ? '저장 중...' : '코멘트 저장'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </section>

                    <section>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' }}>
                            <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px', margin: 0 }}>
                                <Users size={22} /> 학생 관리
                            </h2>
                            <button
                                type="button"
                                className="btn"
                                onClick={() => setIsStudentManagerOpen((prev) => !prev)}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'white', border: '1px solid #dbe4ee' }}
                            >
                                {isStudentManagerOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                                {isStudentManagerOpen ? '학생 관리 숨기기' : '학생 관리 열기'}
                            </button>
                        </div>

                        {isStudentManagerOpen && (
                            <div className="glass-card" style={{ padding: '20px', display: 'grid', gap: '20px' }}>
                                <div>
                                    <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '1rem' }}>개별 추가</h3>
                                    <form onSubmit={handleAddStudent} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
                                        <input
                                            className="input-field"
                                            placeholder="학생 이름"
                                            value={newStudentName}
                                            onChange={(e) => setNewStudentName(e.target.value)}
                                        />
                                        <input
                                            className="input-field"
                                            placeholder="나이(선택)"
                                            type="number"
                                            min={1}
                                            max={120}
                                            value={newStudentAge}
                                            onChange={(e) => setNewStudentAge(e.target.value)}
                                        />
                                        <button className="btn btn-primary" type="submit" disabled={addingStudent}>
                                            {addingStudent ? '추가 중...' : '학생 추가'}
                                        </button>
                                    </form>
                                    {studentError && <p style={{ color: '#dc2626', marginTop: '10px', fontSize: '0.9rem' }}>{studentError}</p>}
                                </div>

                                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                                    <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '1rem' }}>엑셀 붙여넣기 일괄 추가</h3>
                                    <form onSubmit={handleBulkAddStudents} style={{ display: 'grid', gap: '10px' }}>
                                        <textarea
                                            className="input-field"
                                            rows={6}
                                            placeholder={'예시 1) 이름만 한 줄씩\n홍길동\n김영희\n\n예시 2) 이름 + 나이(엑셀 2열 복사)\n홍길동\t10\n김영희\t11'}
                                            value={bulkStudentInput}
                                            onChange={(e) => setBulkStudentInput(e.target.value)}
                                            style={{ resize: 'vertical' }}
                                        />
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                                            <input
                                                className="input-field"
                                                placeholder="일괄 나이(선택, 입력 시 모두 적용)"
                                                type="number"
                                                min={1}
                                                max={120}
                                                value={bulkDefaultAge}
                                                onChange={(e) => setBulkDefaultAge(e.target.value)}
                                            />
                                            <button className="btn btn-primary" type="submit" disabled={addingBulkStudents}>
                                                {addingBulkStudents ? '일괄 추가 중...' : '일괄 추가'}
                                            </button>
                                        </div>
                                    </form>
                                    {bulkError && <p style={{ color: '#dc2626', marginTop: '10px', fontSize: '0.9rem' }}>{bulkError}</p>}
                                    {bulkSuccess && <p style={{ color: '#15803d', marginTop: '10px', fontSize: '0.9rem' }}>{bulkSuccess}</p>}
                                </div>

                                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                                    <h3 style={{ marginTop: 0, marginBottom: '10px', fontSize: '1rem' }}>학생 삭제</h3>
                                    {users.length === 0 ? (
                                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.9rem' }}>등록된 학생이 없습니다.</p>
                                    ) : (
                                        <div style={{ display: 'grid', gap: '8px', maxHeight: '340px', overflowY: 'auto', paddingRight: '4px' }}>
                                            {users.map((u) => (
                                                <div
                                                    key={u.id}
                                                    style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'space-between',
                                                        gap: '10px',
                                                        padding: '10px 12px',
                                                        background: '#f8fafc',
                                                        border: '1px solid #e2e8f0',
                                                        borderRadius: '10px'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontWeight: 700, color: '#1f2937' }}>{u.name}</span>
                                                        <span style={{ color: '#94a3b8', fontSize: '0.85rem' }}>
                                                            {u.age ? `${u.age}세` : '나이 미입력'}
                                                        </span>
                                                    </div>
                                                    <button
                                                        className="btn"
                                                        style={{
                                                            padding: '8px 12px',
                                                            background: '#fee2e2',
                                                            color: '#b91c1c',
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '6px'
                                                        }}
                                                        onClick={() => handleDeleteStudent(u)}
                                                        disabled={deletingUserId === u.id}
                                                    >
                                                        <Trash2 size={14} />
                                                        {deletingUserId === u.id ? '삭제 중...' : '삭제'}
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <p style={{ color: '#64748b', marginTop: 0, marginBottom: 0, fontSize: '0.9rem' }}>
                                    추가된 학생은 로그인 시 자신의 4자리 비밀번호를 최초 1회 설정합니다.
                                </p>
                            </div>
                        )}
                    </section>

                    <section>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 style={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <BarChart2 /> 독서 통계
                            </h2>
                            {/* 통계 기준 전환 (권수 / 글자수) */}
                            <div style={{ background: '#f1f5f9', padding: '4px', borderRadius: '25px', display: 'flex', gap: '4px' }}>
                                {(['count', 'length'] as const).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setStatsType(type)}
                                        style={{
                                            padding: '6px 16px', borderRadius: '20px', border: 'none', cursor: 'pointer',
                                            background: statsType === type ? 'white' : 'transparent',
                                            boxShadow: statsType === type ? '0 2px 4px rgba(0,0,0,0.1)' : 'none',
                                            fontWeight: '600', color: statsType === type ? 'var(--primary)' : '#64748b',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        {type === 'count' ? '기록 권수' : '리뷰 글자수'}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* 요약 카드 */}
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                            <div className="glass-card" style={{ textAlign: 'center', padding: '25px' }}>
                                <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '10px' }}>교실 전체 누적 기록</div>
                                <div style={{ fontSize: 'min(2.5rem, 8vw)', fontWeight: '800', color: 'var(--primary)', lineHeight: 1.2 }}>
                                    {statsType === 'count' ? `${totalBooks}권` : `${totalLength.toLocaleString()}자`}
                                </div>
                            </div>
                            <div className="glass-card" style={{ textAlign: 'center', padding: '25px', border: '1px solid #ffedd5' }}>
                                <div style={{ fontSize: '0.9rem', color: '#64748b', marginBottom: '10px' }}>🏅 최다 독서 학생</div>
                                <div style={{ fontSize: 'min(2rem, 7vw)', fontWeight: '800', color: '#ea580c', lineHeight: 1.2 }}>
                                    {readingKing ? readingKing.name : '-'}
                                    <div style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: '500', marginTop: '5px' }}>
                                        {statsType === 'count' ? `${readingKing?.count}권 완료` : `${readingKing?.length.toLocaleString()}자 작성`}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 그래프 영역 */}
                        <div className="glass-card" style={{ marginTop: '20px', padding: '30px' }}>
                            <h3 style={{ marginBottom: '25px', fontSize: '1.2rem', fontWeight: '700' }}>학생별 활동량</h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                                {booksByUser.map(user => {
                                    const val = statsType === 'count' ? user.count : user.length;
                                    const maxVal = Math.max(...booksByUser.map(u => statsType === 'count' ? u.count : u.length));
                                    const percent = maxVal > 0 ? (val / maxVal) * 100 : 0;
                                    return (
                                        <div key={user.name}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.95rem' }}>
                                                <span style={{ fontWeight: '600' }}>{user.name}</span>
                                                <span style={{ color: '#64748b' }}>{val.toLocaleString()}{statsType === 'count' ? '권' : '자'}</span>
                                            </div>
                                            <div style={{ height: '12px', background: '#f1f5f9', borderRadius: '6px', overflow: 'hidden' }}>
                                                <div style={{ width: `${percent}%`, height: '100%', background: 'var(--primary)', transition: 'width 0.8s ease-out' }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    {/* 2. AI 독서 분석 섹션 */}
                    <section>
                        <h2 style={{ fontSize: '1.5rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <Sparkles color="#8b5cf6" /> AI 심층 독서 분석 리포트
                            </div>
                            {analysisResult && !(analysisResult as any).error && (
                                <div className="no-print" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                    {isEditingAnalysis ? (
                                        <>
                                            <button onClick={handleSaveAnalysisEdit} className="btn-icon" title="수정 내용 저장" disabled={isSavingAnalysis} style={{ background: '#16a34a', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: isSavingAnalysis ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', color: 'white', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.1)', opacity: isSavingAnalysis ? 0.7 : 1 }}>
                                                <Save size={16} /> <span>{isSavingAnalysis ? '저장 중...' : '저장'}</span>
                                            </button>
                                            <button onClick={handleCancelAnalysisEdit} className="btn-icon" title="수정 취소" disabled={isSavingAnalysis} style={{ background: '#f1f5f9', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '8px', cursor: isSavingAnalysis ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', color: '#334155', fontWeight: 'bold' }}>
                                                <X size={16} /> <span>취소</span>
                                            </button>
                                        </>
                                    ) : (
                                        <button onClick={handleStartAnalysisEdit} className="btn-icon" title="AI 리포트 수정" style={{ background: '#0f172a', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', color: 'white', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                            <Pencil size={16} /> <span>수정</span>
                                        </button>
                                    )}
                                    <button onClick={handleOpenSharePage} className="btn-icon" title="공유 페이지 열기" style={{ background: 'var(--primary)', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', color: 'white', fontWeight: 'bold', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                                        <Share2 size={16} /> <span>공유 / 인쇄</span>
                                    </button>
                                </div>
                            )}
                        </h2>

                        <div className="glass-card print-target" style={{ padding: '30px' }}>
                            <p style={{ marginBottom: '20px', color: '#64748b' }}>분석 대상 유저를 선택하고 AI 리포트를 생성하세요. (연령 정보를 입력하면 더 정확한 추천이 가능합니다.)</p>

                            {/* 유저 선택 및 연령 수정 UI (인쇄 시 숨김) */}
                            <div className="no-print" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: '15px', marginBottom: '30px' }}>
                                {users.map(u => (
                                    <div
                                        key={u.id}
                                        style={{
                                            padding: '20px', borderRadius: '15px', cursor: 'pointer', transition: 'all 0.2s',
                                            background: selectedUser === u.name ? 'rgba(99, 102, 241, 0.05)' : 'white',
                                            border: selectedUser === u.name ? '2px solid var(--primary)' : '1px solid #e2e8f0',
                                            boxShadow: selectedUser === u.name ? '0 4px 12px rgba(99, 102, 241, 0.1)' : 'none'
                                        }}
                                        onClick={() => setSelectedUser(u.name)}
                                    >
                                        <div style={{ fontWeight: '700', fontSize: '1.2rem', marginBottom: '8px', color: selectedUser === u.name ? 'var(--primary)' : '#1e293b' }}>{u.name}</div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.9rem' }}>
                                            <span style={{ color: '#94a3b8' }}>연령:</span>
                                            <input
                                                type="number"
                                                defaultValue={u.age || ''}
                                                onBlur={(e) => updateAge(u.id, e.target.value)}
                                                style={{ width: '45px', border: 'none', borderBottom: '1px solid #cbd5e1', padding: '2px', textAlign: 'center', fontWeight: '600' }}
                                                onClick={(e) => e.stopPropagation()}
                                            />
                                            <span style={{ fontWeight: '600' }}>세</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button className="btn btn-primary no-print" onClick={handleAnalyze} disabled={isAnalyzing} style={{ width: '100%', padding: '16px', fontSize: '1.1rem', fontWeight: 'bold' }}>
                                {isAnalyzing ? '✨ Gemini AI가 데이터를 분석하고 있습니다...' : `${selectedUser}님을 위한 AI 추천 리포트 생성`}
                            </button>

                            {/* 분석 결과 표시 */}
                            {analysisResult && (
                                <div style={{ marginTop: '30px', borderTop: '1px solid #f1f5f9', paddingTop: '30px', animation: 'fadeInUp 0.6s' }}>
                                    {(analysisResult as any).error ? (
                                        <div style={{ padding: '20px', background: '#fff5f5', color: '#c53030', borderRadius: '12px', border: '1px solid #fed7d7' }}>
                                            {(analysisResult as any).error}
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gap: '25px' }}>
                                            <div style={{ background: '#f0f9ff', padding: '20px', borderRadius: '15px', borderLeft: '5px solid #0ea5e9' }}>
                                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#0369a1', fontWeight: '700' }}>
                                                    <Activity size={20} /> 읽기/쓰기 수준 진단
                                                </h4>
                                                {isEditingAnalysis ? (
                                                    <textarea
                                                        value={analysisDraft?.level || ''}
                                                        onChange={(e) => updateAnalysisDraft('level', e.target.value)}
                                                        style={{ width: '100%', minHeight: '120px', resize: 'vertical', border: '1px solid #bae6fd', borderRadius: '10px', padding: '12px', lineHeight: '1.7', color: '#0c4a6e', font: 'inherit', background: 'white' }}
                                                    />
                                                ) : (
                                                    <p style={{ margin: 0, lineHeight: '1.7', color: '#0c4a6e' }}>{displayedAnalysis.level}</p>
                                                )}
                                            </div>

                                            <div style={{ background: '#fdf4ff', padding: '20px', borderRadius: '15px', borderLeft: '5px solid #d946ef' }}>
                                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: '#a21caf', fontWeight: '700' }}>
                                                    <TrendingUp size={20} /> 관심 분야 및 독서 성향
                                                </h4>
                                                {isEditingAnalysis ? (
                                                    <textarea
                                                        value={analysisDraft?.interest || ''}
                                                        onChange={(e) => updateAnalysisDraft('interest', e.target.value)}
                                                        style={{ width: '100%', minHeight: '120px', resize: 'vertical', border: '1px solid #f5d0fe', borderRadius: '10px', padding: '12px', lineHeight: '1.7', color: '#701a75', font: 'inherit', background: 'white' }}
                                                    />
                                                ) : (
                                                    <p style={{ margin: 0, lineHeight: '1.7', color: '#701a75' }}>{displayedAnalysis.interest}</p>
                                                )}
                                            </div>

                                            <div style={{ background: '#f0fdf4', padding: '20px', borderRadius: '15px', borderLeft: '5px solid #22c55e' }}>
                                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px', color: '#15803d', fontWeight: '700' }}>
                                                    <BookOpen size={20} /> 실시간 추천 도서 (TOP 10)
                                                </h4>
                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(270px, 1fr))', gap: '20px' }}>
                                                    {Array.isArray(displayedAnalysis.recommendations) && displayedAnalysis.recommendations.map((book: any, idx: number) => (
                                                        <div key={idx} className="glass-card" style={{ display: 'flex', gap: '15px', border: '1px solid #dcfce7', padding: '15px', transition: 'transform 0.2s' }}>
                                                            {book.cover_url && (
                                                                <div style={{ flexShrink: 0, width: '85px', height: '120px', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
                                                                    <img src={book.cover_url} alt={book.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                                </div>
                                                            )}
                                                            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                                                                {isEditingAnalysis ? (
                                                                    <div style={{ display: 'grid', gap: '8px' }}>
                                                                        <input
                                                                            value={String(book.title || '')}
                                                                            onChange={(e) => updateRecommendationDraft(idx, 'title', e.target.value)}
                                                                            style={{ border: '1px solid #bbf7d0', borderRadius: '8px', padding: '8px 10px', fontWeight: 700, color: '#166534', font: 'inherit' }}
                                                                        />
                                                                        <input
                                                                            value={String(book.author || '')}
                                                                            onChange={(e) => updateRecommendationDraft(idx, 'author', e.target.value)}
                                                                            style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '8px 10px', color: '#475569', font: 'inherit', fontSize: '0.9rem' }}
                                                                        />
                                                                        <textarea
                                                                            value={String(book.reason || '')}
                                                                            onChange={(e) => updateRecommendationDraft(idx, 'reason', e.target.value)}
                                                                            style={{ minHeight: '110px', resize: 'vertical', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '10px', color: '#374151', font: 'inherit', lineHeight: 1.5 }}
                                                                        />
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeRecommendationDraft(idx)}
                                                                            style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', border: '1px solid #fecaca', background: '#fff1f2', color: '#be123c', borderRadius: '8px', padding: '8px 10px', fontWeight: 700, cursor: 'pointer', justifySelf: 'start' }}
                                                                        >
                                                                            <Trash2 size={14} /> 추천 도서 제거
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <>
                                                                        <div style={{ fontWeight: '700', fontSize: '1rem', color: '#166534', marginBottom: '4px', lineHeight: '1.3' }}>{book.title}</div>
                                                                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '8px' }}>{book.author} ({book.rank}점)</div>
                                                                        <p style={{ fontSize: '0.9rem', color: '#374151', margin: '0 0 10px 0', lineHeight: '1.5', flex: 1 }}>{book.reason}</p>
                                                                    </>
                                                                )}

                                                                {book.link && !isEditingAnalysis && (
                                                                    <a
                                                                        href={book.link}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="no-print"
                                                                        style={{
                                                                            display: 'inline-flex', alignItems: 'center', gap: '5px',
                                                                            background: '#ecfccb', color: '#4d7c0f',
                                                                            padding: '6px 12px', borderRadius: '8px',
                                                                            textDecoration: 'none', fontSize: '0.85rem', fontWeight: 'bold',
                                                                            alignSelf: 'flex-start', border: '1px solid #bef264',
                                                                            marginTop: 'auto'
                                                                        }}
                                                                    >
                                                                        <ExternalLink size={14} /> 알라딘에서 보기
                                                                    </a>
                                                                )}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
};

export default AdminPage;
