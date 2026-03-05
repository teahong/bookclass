import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Glasses, Sun, Rocket, Sprout, Trophy, UserCog, Lock, User, BookOpen, Star, Heart, Smile, Cat, Dog, Bird, Fish, TreePine, Flower2, Leaf, Flame, Sparkles, Crown, Shield, GraduationCap, Pencil, Ruler, Calculator, Music, Camera, Gamepad2, Dumbbell, Palette, Lightbulb } from 'lucide-react';
import { getAvatarPrefFromLocal, getDefaultAvatarPref } from '../lib/avatarPrefs';
import type { AvatarIconKey } from '../lib/avatarPrefs';

interface LoginPageProps {
    onLogin: (userName: string) => void;
    onShowChallenge: () => void;
    onShowAdmin: () => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onShowChallenge, onShowAdmin }) => {
    const [users, setUsers] = useState<any[]>([]);
    const [selectedUser, setSelectedUser] = useState<any>(null);
    const [pin, setPin] = useState('');
    const [isSettingPin, setIsSettingPin] = useState(false);
    const [error, setError] = useState('');

    const [loading, setLoading] = useState(false);

    // Admin PIN State
    const [isAdminPinOpen, setIsAdminPinOpen] = useState(false);
    const [adminPin, setAdminPin] = useState('');
    const [adminError, setAdminError] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        let { data: rawUsers, error: rawError } = await supabase
            .from('users')
            .select('id, name, pin, avatar_icon, avatar_color')
            .order('name', { ascending: true });

        // avatar 컬럼이 아직 없는 DB 호환 처리
        if (rawError) {
            const fallback = await supabase
                .from('users')
                .select('id, name, pin')
                .order('name', { ascending: true });
            rawUsers = fallback.data as any;
            rawError = fallback.error as any;
        }

        if (rawError) {
            console.error('Error fetching users:', rawError);
            setError('사용자 목록을 불러오지 못했습니다. DB 테이블(users) 구성을 확인해주세요.');
            return;
        }

        setUsers((rawUsers || []).map((u: any) => ({
            ...u,
            avatar_icon: u.avatar_icon ?? getAvatarPrefFromLocal(u.name)?.icon ?? getDefaultAvatarPref(u.id, u.name).icon,
            avatar_color: u.avatar_color ?? getAvatarPrefFromLocal(u.name)?.color ?? getDefaultAvatarPref(u.id, u.name).color,
            has_pin: Boolean(u.pin)
        })));
    };

    const handleUserSelect = (user: any) => {
        if (loading) return; // 로딩 중 선택 방지
        setSelectedUser(user);
        setIsSettingPin(!(user.has_pin ?? user.pin));
        setPin('');
        setError('');
    };

    const handlePinChange = (value: string) => {
        if (loading) return;
        if (!/^\d*$/.test(value)) return;
        setPin(value.slice(0, 4));
    };

    const handleLoginSubmit = async () => {
        const fullPin = pin;
        if (fullPin.length < 4) {
            setError('4자리 비밀번호를 입력해주세요.');
            return;
        }

        setLoading(true);
        setError('');

        try {
            if (isSettingPin) {
                const { error: updateError } = await supabase
                    .from('users')
                    .update({ pin: fullPin })
                    .eq('id', selectedUser.id);

                if (updateError) {
                    setError('비밀번호 저장 중 오류가 발생했습니다.');
                } else {
                    onLogin(selectedUser.name);
                }
            } else {
                // 서버 측에서 안전하게 PIN 검증
                const { data: isValid, error: verifyError } = await supabase
                    .rpc('verify_pin', { user_id: selectedUser.id, input_pin: fullPin });

                if (!verifyError && isValid) {
                    onLogin(selectedUser.name);
                } else if (!verifyError) {
                    setError('비밀번호가 일치하지 않습니다.');
                    setPin('');
                } else {
                    // verify_pin RPC가 없는 서버 fallback
                    const { data: userData, error: userFetchError } = await supabase
                        .from('users')
                        .select('pin')
                        .eq('id', selectedUser.id)
                        .maybeSingle();

                    if (userFetchError) {
                        console.error('PIN verification fallback error:', userFetchError);
                        setError('로그인 중 오류가 발생했습니다.');
                    } else if (userData?.pin === fullPin) {
                        onLogin(selectedUser.name);
                    } else {
                        setError('비밀번호가 일치하지 않습니다.');
                        setPin('');
                    }
                }
            }
        } catch (e) {
            setError('예상치 못한 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    };

    // Admin PIN Handler
    const handleAdminSubmit = async () => {
        setLoading(true);
        const fallbackKey = 'bookClassAdminPin';

        // app_settings 테이블이 없는 서버 fallback
        const useLocalFallback = async () => {
            const savedPin = localStorage.getItem(fallbackKey);
            if (!savedPin) {
                if (adminPin.length !== 4) {
                    setAdminError('4자리 비밀번호를 설정해주세요.');
                    setLoading(false);
                    return;
                }
                localStorage.setItem(fallbackKey, adminPin);
                onShowAdmin();
                setIsAdminPinOpen(false);
                setAdminPin('');
                setLoading(false);
                return;
            }

            if (adminPin === savedPin) {
                onShowAdmin();
                setIsAdminPinOpen(false);
                setAdminPin('');
            } else {
                setAdminError('비밀번호가 올바르지 않습니다.');
            }
            setLoading(false);
        };

        // 1. Fetch Admin PIN from DB
        const { data: settings, error: fetchError } = await supabase
            .from('app_settings')
            .select('value')
            .eq('key', 'admin_pin')
            .single();

        if (fetchError && fetchError.code === '42P01') {
            await useLocalFallback();
            return;
        }
        if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "Row not found"
            setAdminError('설정 확인 중 오류가 발생했습니다.');
            setLoading(false);
            return;
        }

        const dbPin = settings?.value;

        if (!dbPin) {
            // Case 1: First time setup -> Save new PIN
            if (adminPin.length !== 4) {
                setAdminError('4자리 비밀번호를 설정해주세요.');
                setLoading(false);
                return;
            }

            const { error: insertError } = await supabase
                .from('app_settings')
                .insert([{ key: 'admin_pin', value: adminPin }]);

            if (insertError) {
                if (insertError.code === '42P01') {
                    await useLocalFallback();
                    return;
                }
                setAdminError('비밀번호 설정 중 오류가 발생했습니다.');
            } else {
                alert('관리자 비밀번호가 설정되었습니다: ' + adminPin);
                onShowAdmin();
                setIsAdminPinOpen(false);
                setAdminPin('');
            }
        } else {
            // Case 2: Verify existing PIN
            if (adminPin === dbPin) {
                onShowAdmin();
                setIsAdminPinOpen(false);
                setAdminPin('');
            } else {
                setAdminError('비밀번호가 올바르지 않습니다.');
            }
        }
        setLoading(false);
    };

    const avatarIcons: Record<AvatarIconKey, any> = {
        glasses: Glasses,
        sun: Sun,
        rocket: Rocket,
        sprout: Sprout,
        user: User,
        book: BookOpen,
        star: Star,
        heart: Heart,
        smile: Smile,
        cat: Cat,
        dog: Dog,
        bird: Bird,
        fish: Fish,
        tree_pine: TreePine,
        flower: Flower2,
        leaf: Leaf,
        flame: Flame,
        sparkles: Sparkles,
        crown: Crown,
        shield: Shield,
        graduation_cap: GraduationCap,
        pencil: Pencil,
        ruler: Ruler,
        calculator: Calculator,
        music: Music,
        camera: Camera,
        gamepad: Gamepad2,
        dumbbell: Dumbbell,
        palette: Palette,
        lightbulb: Lightbulb
    };

    const getAvatar = (iconKey: AvatarIconKey) => {
        const iconSize = 40;
        const iconStyle = { color: 'white' };
        const Icon = avatarIcons[iconKey] || User;
        return <Icon size={iconSize} style={iconStyle} />;
    };

    return (
        <div className="login-container">

            <h1 className="title">책과 함께 성장하는 우리 교실</h1>

            <div className="glass-card login-panel">
                <div className="login-panel-header">
                    {/* Admin Button */}
                    <button
                        onClick={() => setIsAdminPinOpen(true)}
                        className="btn btn-admin"
                    >
                        <UserCog size={22} />
                        관리자
                    </button>

                    {/* Challenge Button */}
                    <button className="btn btn-primary btn-inline-icon" onClick={onShowChallenge} disabled={loading}>
                        <Trophy size={18} />
                        독서챌린지 보러가기
                    </button>
                </div>

                <h2 className="login-subtitle">누가 접속하시나요?</h2>

                <div className="grid-family login-family-grid">
                    {[...users].sort((a, b) => a.name.localeCompare(b.name, 'ko')).map(user => (
                        <div
                            key={user.id}
                            className={`avatar-card glass-card family-card ${selectedUser?.id === user.id ? 'active' : ''} ${loading && selectedUser?.id !== user.id ? 'dimmed' : ''}`}
                            onClick={() => handleUserSelect(user)}
                            style={{
                                cursor: loading ? 'wait' : 'pointer',
                                ['--avatar-color' as any]: user.avatar_color
                            } as React.CSSProperties}
                        >
                            <div className="avatar-circle">
                                {getAvatar(user.avatar_icon)}
                            </div>
                            <h3 className="avatar-name">{user.name}</h3>
                        </div>
                    ))}
                </div>
            </div>

            {/* Login User PIN Modal */}
            {selectedUser && (
                <div className="pin-modal">
                    <div className="glass-card pin-container">
                        <div
                            className="pin-avatar-circle"
                            style={{ ['--avatar-color' as any]: selectedUser.avatar_color } as React.CSSProperties}
                        >
                            {getAvatar(selectedUser.avatar_icon)}
                        </div>
                        <h3>{selectedUser.name}님</h3>
                        <p>{isSettingPin ? '첫 방문이시네요! 비밀번호 4자리를 등록해주세요.' : '비밀번호를 입력해주세요.'}</p>

                        <input
                            type="tel"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={4}
                            placeholder="PIN 4자리"
                            value={pin}
                            className="input-field pin-input"
                            onChange={(e) => handlePinChange(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleLoginSubmit();
                            }}
                            autoFocus
                            disabled={loading}
                        />

                        {error && <p className="pin-error">{error}</p>}

                        <div className="pin-actions">
                            <button className="btn" style={{ flex: 1, padding: '12px' }} onClick={() => setSelectedUser(null)} disabled={loading}>취소</button>
                            <button className="btn btn-primary" style={{ flex: 1, padding: '12px' }} onClick={handleLoginSubmit} disabled={loading}>
                                {loading ? '확인 중...' : '확인'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Admin PIN Modal */}
            {isAdminPinOpen && (
                <div className="pin-modal">
                    <div className="glass-card admin-modal">
                        <div className="admin-icon-circle">
                            <Lock size={24} color="white" />
                        </div>
                        <h3 style={{ marginBottom: '10px' }}>관리자 접속</h3>
                        <p className="admin-help">
                            관리자 비밀번호를 입력해주세요.<br />
                            <span className="admin-help-note">(최초 접속 시 입력한 번호로 설정됩니다)</span>
                        </p>

                        <input
                            type="tel"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            maxLength={4}
                            placeholder="PIN 4자리"
                            value={adminPin}
                            onChange={(e) => {
                                if (/^\d*$/.test(e.target.value)) {
                                    setAdminPin(e.target.value.slice(0, 4));
                                    setAdminError('');
                                }
                            }}
                            onKeyDown={(e) => e.key === 'Enter' && handleAdminSubmit()}
                            style={{ width: '100%' }}
                            className="input-field pin-input"
                            autoFocus
                        />
                        {adminError && <p className="pin-error" style={{ fontSize: '0.8rem', marginBottom: '15px' }}>{adminError}</p>}

                        <div className="pin-actions" style={{ marginTop: 0 }}>
                            <button className="btn" onClick={() => {
                                setIsAdminPinOpen(false);
                                setAdminPin('');
                                setAdminError('');
                            }}>취소</button>
                            <button className="btn btn-primary" onClick={handleAdminSubmit}>
                                확인
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LoginPage;
