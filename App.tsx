
import React, { useState, useEffect, createContext, useContext, useCallback, useMemo } from 'react';
import { User, UserRole, Subject, Question, ExamAttempt, AppState, QuestionType, EnrollmentType, ExamType } from './types';
import { initializeDB, getDB, saveDB } from './services/database';
import generatePDFFromElement from './utils/pdfGenerator';

// --- Assets & Icons ---
const Logo = () => (
    <div className="flex items-center space-x-3 rtl:space-x-reverse">
        <svg className="w-16 h-16 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l6.16-3.422A12.083 12.083 0 0112 21a12.083 12.083 0 01-6.16-10.422L12 14z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l-9 5 9 5 9-5-9-5z" /></svg>
        <div>
            <h1 className="text-xl font-bold text-white">كلية الحقوق بقنا</h1>
            <p className="text-sm text-gray-300">نظام الامتحانات الإلكتروني</p>
        </div>
    </div>
);

const Badge = ({ children, className }: { children: React.ReactNode, className?: string }) => (
    <span className={`px-3 py-1 text-sm font-bold rounded-full ${className}`}>
        {children}
    </span>
);

// --- Footer Component (Global Dedication) ---
const FooterDedication: React.FC = () => {
    return (
        <footer className="py-6 mt-auto text-white bg-slate-800 border-t-4 border-brand-gold">
            <div className="container mx-auto text-center px-4">
                <p className="text-lg font-medium leading-relaxed">
                    هذا العمل لوجه الله تعالى، وجعله الله صدقة جارية على روح أمي.
                    <br />
                    <span className="font-bold text-brand-gold">أسألكم الدعاء لها بالرحمة والمغفرة.</span>
                </p>
            </div>
        </footer>
    );
};


// --- App State Context ---
const AppContext = createContext<{
    state: AppState;
    setState: React.Dispatch<React.SetStateAction<AppState>>;
    currentUser: User | null;
    login: (name: string, passwordHash: string) => { success: boolean, message?: string };
    register: (user: User) => boolean;
    logout: () => void;
}>({
    state: initializeDB(),
    setState: () => {},
    currentUser: null,
    login: () => ({ success: false }),
    register: () => false,
    logout: () => {},
});

const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [state, setState] = useState<AppState>(initializeDB);
    const [currentUser, setCurrentUser] = useState<User | null>(() => {
        const storedUser = sessionStorage.getItem('currentUser');
        return storedUser ? JSON.parse(storedUser) : null;
    });

    useEffect(() => {
        saveDB(state);
    }, [state]);

    const login = (name: string, passwordHash: string): { success: boolean, message?: string } => {
        const trimmedName = name.trim();
        
        // Find user by Full Name OR Username OR Email (to support admin and flexibility)
        let user = state.users.find(u => 
            u.fullName === trimmedName || 
            u.username === trimmedName ||
            u.email.toLowerCase() === trimmedName.toLowerCase()
        );
        
        if (!user) {
            return { success: false, message: 'المستخدم غير موجود' };
        }

        if (user.isLocked) {
            return { success: false, message: 'تم قفل الحساب بسبب تكرار كلمة المرور الخاطئة. يرجى مراجعة المسؤول.' };
        }

        if (user.passwordHash === passwordHash) {
            // Success: Reset failed attempts
            const updatedUser = { ...user, failedLoginAttempts: 0 };
            const updatedUsers = state.users.map(u => u.id === user!.id ? updatedUser : u);
            
            setState(prev => ({ ...prev, users: updatedUsers }));
            setCurrentUser(updatedUser);
            sessionStorage.setItem('currentUser', JSON.stringify(updatedUser));
            return { success: true };
        } else {
            // Failure: Increment attempts and possibly lock
            const newAttempts = (user.failedLoginAttempts || 0) + 1;
            const shouldLock = newAttempts >= 2 && user.role !== UserRole.ADMIN; // Admins don't get locked out easily for safety
            
            const updatedUser = { 
                ...user, 
                failedLoginAttempts: newAttempts,
                isLocked: shouldLock
            };
            
            const updatedUsers = state.users.map(u => u.id === user!.id ? updatedUser : u);
            setState(prev => ({ ...prev, users: updatedUsers }));
            
            if (shouldLock) {
                return { success: false, message: 'تم قفل الحساب. لقد أدخلت كلمة المرور خطأ مرتين.' };
            } else {
                return { success: false, message: 'كلمة المرور غير صحيحة. انتبه: الخطأ القادم سيؤدي لقفل الحساب.' };
            }
        }
    };

    const register = (newUser: User): boolean => {
        const existingUser = state.users.find(u => u.fullName === newUser.fullName || u.email === newUser.email);
        if (existingUser) return false;

        setState(prevState => ({
            ...prevState,
            users: [...prevState.users, newUser]
        }));
        
        setCurrentUser(newUser);
        sessionStorage.setItem('currentUser', JSON.stringify(newUser));
        return true;
    };

    const logout = () => {
        setCurrentUser(null);
        sessionStorage.removeItem('currentUser');
    };
    
    return (
        <AppContext.Provider value={{ state, setState, currentUser, login, register, logout }}>
            {children}
        </AppContext.Provider>
    );
};

// --- Main App ---
const App: React.FC = () => {
    return (
        <AppProvider>
            <Main />
        </AppProvider>
    );
}

const Main: React.FC = () => {
    const { currentUser } = useContext(AppContext);
    
    return (
        <div className="flex flex-col min-h-screen bg-gray-100">
            <div className="flex-grow">
                {currentUser ? (
                    currentUser.role === UserRole.ADMIN ? <AdminView /> : <StudentView />
                ) : (
                    <LoginScreen />
                )}
            </div>
            {currentUser && <FooterDedication />}
        </div>
    );
};

// --- Login Screen ---
const LoginScreen: React.FC = () => {
    const { login, register, state } = useContext(AppContext);
    const [isLoginMode, setIsLoginMode] = useState(true);
    
    // Login State
    const [loginName, setLoginName] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [loginPrayerChecked, setLoginPrayerChecked] = useState(false);
    
    // Register State
    const [fullName, setFullName] = useState('');
    const [regPassword, setRegPassword] = useState('0000');
    const [confirmPassword, setConfirmPassword] = useState('0000');
    const [enrollmentType, setEnrollmentType] = useState<EnrollmentType>(EnrollmentType.INTISAB);
    const [regPrayerChecked, setRegPrayerChecked] = useState(false);

    const [error, setError] = useState('');

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (!loginPrayerChecked) {
            setError('يجب قراءة الفاتحة والترحم على والدة المبرمج للدخول.');
            return;
        }

        const result = login(loginName, loginPassword);
        if (!result.success) {
            setError(result.message || 'خطأ في تسجيل الدخول');
        }
    };

    const handleRegister = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        
        if (!regPrayerChecked) {
            setError('يجب قراءة الفاتحة والترحم على والدة المبرمج للتسجيل.');
            return;
        }

        if (regPassword !== confirmPassword) {
            setError('كلمتا المرور غير متطابقتين.');
            return;
        }

        if (regPassword.length < 4) {
            setError('يجب أن تتكون كلمة المرور من 4 أرقام على الأقل.');
            return;
        }

        // Generate ID
        const maxNumericId = state.users
            .filter(u => u.role === UserRole.STUDENT && !isNaN(parseInt(u.username)))
            .reduce((max, u) => Math.max(max, parseInt(u.username)), 2024000);
        
        const newUser: User = {
            id: `student_${Date.now()}`,
            username: String(maxNumericId + 1),
            email: `student${maxNumericId + 1}@law.edu`, // Placeholder email
            passwordHash: regPassword,
            fullName: fullName,
            role: UserRole.STUDENT,
            enrollmentType: enrollmentType,
            failedLoginAttempts: 0,
            isLocked: false
        };

        const success = register(newUser);
        if (!success) {
            setError('هذا المستخدم مسجل بالفعل.');
        }
    };

    return (
        <div className="flex flex-col min-h-screen bg-[#0B1D3A]">
            <div className="flex flex-col items-center justify-center flex-grow p-4">
                <div className="w-full max-w-md p-8 space-y-6 bg-white rounded-lg shadow-xl">
                    <div className="flex flex-col items-center space-y-4">
                        <svg className="w-16 h-16 mx-auto text-brand-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l6.16-3.422A12.083 12.083 0 0112 21a12.083 12.083 0 01-6.16-10.422L12 14z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l-9 5 9 5 9-5-9-5z" /></svg>
                        <h2 className="text-lg font-bold text-gray-700">نظام الامتحانات الإلكتروني</h2>
                        <div className="flex p-1 bg-gray-200 rounded-lg">
                            <button onClick={() => setIsLoginMode(true)} className={`px-4 py-2 text-sm font-bold rounded-md ${isLoginMode ? 'bg-white shadow text-brand-navy' : 'text-gray-500'}`}>تسجيل الدخول</button>
                            <button onClick={() => setIsLoginMode(false)} className={`px-4 py-2 text-sm font-bold rounded-md ${!isLoginMode ? 'bg-white shadow text-brand-navy' : 'text-gray-500'}`}>إنشاء حساب جديد</button>
                        </div>
                    </div>

                    {isLoginMode ? (
                        <form className="space-y-6 text-right" onSubmit={handleLogin}>
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-700">الاسم الثلاثي (بالعربي)</label>
                                <input 
                                    type="text" 
                                    value={loginName} 
                                    onChange={e => setLoginName(e.target.value)} 
                                    required 
                                    placeholder="ادخل اسمك المسجل به"
                                    className="w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-brand-gold focus:outline-none" 
                                />
                            </div>
                            <div>
                                <label className="block mb-2 text-sm font-medium text-gray-700">كلمة المرور</label>
                                <input 
                                    type="password" 
                                    value={loginPassword} 
                                    onChange={e => setLoginPassword(e.target.value)} 
                                    required 
                                    placeholder="كلمة المرور (الافتراضية 0000)"
                                    className="w-full px-4 py-3 border rounded-md focus:ring-2 focus:ring-brand-gold focus:outline-none" 
                                />
                            </div>
                            
                            <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-brand-gold rounded-md">
                                <input 
                                    type="checkbox" 
                                    id="prayer-check-login"
                                    checked={loginPrayerChecked}
                                    onChange={(e) => setLoginPrayerChecked(e.target.checked)}
                                    className="w-5 h-5 text-brand-gold focus:ring-brand-gold cursor-pointer"
                                />
                                <label htmlFor="prayer-check-login" className="text-sm font-bold text-brand-navy cursor-pointer select-none">
                                    أقر بأنني قرأت الفاتحة وترحمت على والدة مبرمج الموقع.
                                </label>
                            </div>

                            {error && <p className="text-sm text-center text-red-500 font-bold">{error}</p>}
                            <button type="submit" className="w-full py-3 font-bold text-gray-900 bg-yellow-400 rounded-md hover:bg-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed">
                                دخول
                            </button>
                        </form>
                    ) : (
                        <form className="space-y-4 text-right" onSubmit={handleRegister}>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700">الاسم الثلاثي (بالعربي)</label>
                                <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} required className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-brand-gold focus:outline-none" placeholder="الاسم كما في الكشف" />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block mb-1 text-sm font-medium text-gray-700">كلمة المرور</label>
                                    <input type="text" value={regPassword} onChange={e => setRegPassword(e.target.value)} required className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-brand-gold focus:outline-none" placeholder="مثال: 0000" />
                                </div>
                                <div>
                                    <label className="block mb-1 text-sm font-medium text-gray-700">تأكيد كلمة المرور</label>
                                    <input type="text" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-brand-gold focus:outline-none" />
                                </div>
                            </div>
                            <div>
                                <label className="block mb-1 text-sm font-medium text-gray-700">نوع القيد</label>
                                <select value={enrollmentType} onChange={e => setEnrollmentType(e.target.value as EnrollmentType)} className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-brand-gold focus:outline-none">
                                    <option value={EnrollmentType.INTISAB}>انتساب عام</option>
                                    <option value={EnrollmentType.INTIZAM}>انتظام</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-yellow-50 border border-brand-gold rounded-md">
                                <input 
                                    type="checkbox" 
                                    id="prayer-check-reg"
                                    checked={regPrayerChecked}
                                    onChange={(e) => setRegPrayerChecked(e.target.checked)}
                                    className="w-5 h-5 text-brand-gold focus:ring-brand-gold cursor-pointer"
                                />
                                <label htmlFor="prayer-check-reg" className="text-sm font-bold text-brand-navy cursor-pointer select-none">
                                    أقر بأنني قرأت الفاتحة وترحمت على والدة مبرمج الموقع.
                                </label>
                            </div>

                            {error && <p className="text-sm text-center text-red-500 font-bold">{error}</p>}
                            <button type="submit" className="w-full py-3 font-bold text-gray-900 bg-yellow-400 rounded-md hover:bg-yellow-500">
                                تسجيل حساب جديد
                            </button>
                        </form>
                    )}
                </div>
            </div>
            
            {/* Dedication Footer on Login Screen */}
            <div className="w-full p-6 text-center text-white bg-slate-900/50">
                <p className="text-lg font-medium leading-relaxed">
                     هذا العمل لوجه الله تعالى، وجعله الله صدقة جارية على روح أمي.
                    <br />
                    <span className="font-bold text-brand-gold">أسألكم الدعاء لها بالرحمة والمغفرة.</span>
                </p>
            </div>
        </div>
    );
};


// --- Header ---
const Header: React.FC = () => {
    const { currentUser, logout } = useContext(AppContext);
    return (
        <header className="sticky top-0 z-50 shadow-lg brand-navy">
            <div className="container flex items-center justify-between p-4 mx-auto">
                <div className="flex items-center space-x-4 rtl:space-x-reverse">
                  <Logo />
                </div>
                <div className="flex items-center space-x-2 rtl:space-x-reverse">
                    <div className="text-left text-white">
                        <p className="text-sm font-bold">{currentUser?.fullName}</p>
                        <p className="text-xs text-gray-300">{currentUser?.enrollmentType === EnrollmentType.INTIZAM ? 'انتظام' : 'انتساب'}</p>
                    </div>
                    <button onClick={logout} className="px-3 py-2 text-sm text-white bg-red-600 rounded-md hover:bg-red-700">
                        خروج
                    </button>
                </div>
            </div>
        </header>
    );
};


// --- Student View ---
const StudentView: React.FC = () => {
    const [currentView, setCurrentView] = useState<'dashboard' | 'mode-select' | 'pre-exam' | 'exam' | 'results'>('dashboard');
    const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
    const [selectedExamType, setSelectedExamType] = useState<ExamType | null>(null);
    const [currentAttempt, setCurrentAttempt] = useState<ExamAttempt | null>(null);

    const selectSubject = (subject: Subject) => {
        setSelectedSubject(subject);
        setCurrentView('mode-select');
    };

    const selectExamMode = (type: ExamType) => {
        setSelectedExamType(type);
        setCurrentView('pre-exam');
    }

    const beginExam = () => {
        if (!selectedSubject || !selectedExamType) return;
        setCurrentView('exam');
    };

    const finishExam = (attempt: ExamAttempt) => {
        setCurrentAttempt(attempt);
        setCurrentView('results');
    };

    const backToDashboard = () => {
        setSelectedSubject(null);
        setSelectedExamType(null);
        setCurrentAttempt(null);
        setCurrentView('dashboard');
    };
    
    return (
        <>
            <Header />
            <main className="container p-4 mx-auto md:p-8">
                {currentView === 'dashboard' && <StudentDashboard onSelectSubject={selectSubject} />}
                
                {currentView === 'mode-select' && selectedSubject && (
                    <ExamModeSelection 
                        subject={selectedSubject} 
                        onSelectMode={selectExamMode} 
                        onBack={backToDashboard} 
                    />
                )}

                {currentView === 'pre-exam' && selectedSubject && selectedExamType && (
                    <PreExamScreen 
                        subject={selectedSubject} 
                        examType={selectedExamType}
                        onBegin={beginExam} 
                        onCancel={backToDashboard} 
                    />
                )}

                {currentView === 'exam' && selectedSubject && selectedExamType && (
                    <ExamScreen 
                        subject={selectedSubject} 
                        examType={selectedExamType}
                        onFinish={finishExam} 
                    />
                )}

                {currentView === 'results' && currentAttempt && (
                    <ResultsScreen 
                        attempt={currentAttempt} 
                        onBack={backToDashboard} 
                    />
                )}
            </main>
        </>
    );
};

const StudentDashboard: React.FC<{onSelectSubject: (subject: Subject) => void}> = ({ onSelectSubject }) => {
    const { state, currentUser } = useContext(AppContext);
    
    return (
        <div>
            <div className="p-6 mb-8 bg-white rounded-lg shadow-md">
                <h2 className="text-2xl font-bold text-brand-navy">لوحة التحكم</h2>
                <p className="text-gray-600">أهلاً بك، {currentUser?.fullName}. اختر المادة للدخول إلى الامتحانات.</p>
            </div>

            <h2 className="mb-6 text-2xl font-bold text-brand-navy">المواد الدراسية</h2>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                {state.subjects.map(subject => {
                    const userAttempts = (state.examAttempts || []).filter(a => a.userId === currentUser!.id && a.subjectId === subject.id && a.examType === 'final');
                    const attemptCount = userAttempts.length;
                    const examSettings = state.examSettings[subject.id] || { isOpen: false };
                    const { isOpen } = examSettings;

                    let buttonText = 'الدخول للامتحان';
                    let buttonClass = 'brand-gold hover:bg-yellow-500 text-gray-900';

                    if (!isOpen) {
                        buttonText = 'الامتحان مغلق';
                        buttonClass = 'bg-gray-400 text-white cursor-not-allowed';
                    }
                    
                    const lastScore = attemptCount > 0 ? userAttempts[userAttempts.length - 1].score : null;
                    const totalQs = attemptCount > 0 ? userAttempts[userAttempts.length - 1].totalQuestions : 1;

                    return (
                    <div key={subject.id} className="relative p-6 transition duration-300 bg-white border border-gray-200 rounded-lg shadow-md hover:shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-brand-navy">{subject.name}</h3>
                            <span className="px-2 py-1 text-xs font-bold text-gray-600 bg-gray-100 rounded-full">النهائي: {attemptCount} / 2 محاولات</span>
                        </div>
                        
                        {lastScore !== null && (
                            <div className="mb-4 text-sm text-gray-600">
                                آخر درجة (نهائي): <span className="font-bold text-brand-navy">{((lastScore / totalQs) * 100).toFixed(1)} من 100</span>
                            </div>
                        )}

                        <button 
                            onClick={() => onSelectSubject(subject)}
                            disabled={!isOpen}
                            className={`w-full px-4 py-3 font-bold transition rounded-md shadow-sm ${buttonClass}`}>
                           {buttonText}
                        </button>
                    </div>
                )})}
            </div>
        </div>
    );
};

const ExamModeSelection: React.FC<{ subject: Subject, onSelectMode: (type: ExamType) => void, onBack: () => void }> = ({ subject, onSelectMode, onBack }) => {
    const { state, currentUser } = useContext(AppContext);
    
    // Check attempts for FINAL exam (Max 2)
    const finalAttempts = (state.examAttempts || []).filter(a => a.userId === currentUser!.id && a.subjectId === subject.id && a.examType === 'final');
    const finalAttemptsCount = finalAttempts.length;
    const maxFinalAttempts = 2;
    const canTakeFinal = finalAttemptsCount < maxFinalAttempts;

    // Check attempts for TRIAL exam (Max 4)
    const trialAttempts = (state.examAttempts || []).filter(a => a.userId === currentUser!.id && a.subjectId === subject.id && a.examType === 'trial');
    const trialAttemptsCount = trialAttempts.length;
    const maxTrialAttempts = 4;
    const canTakeTrial = trialAttemptsCount < maxTrialAttempts;

    return (
        <div className="max-w-4xl mx-auto">
            <div className="mb-6 flex justify-between items-center">
                <h2 className="text-2xl font-bold text-brand-navy">اختر نوع الامتحان: {subject.name}</h2>
                <button onClick={onBack} className="text-gray-600 hover:text-gray-800">العودة</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Trial Exam Card */}
                <div className={`bg-white rounded-xl shadow-lg overflow-hidden border-t-4 border-blue-500 transition-shadow ${!canTakeTrial ? 'opacity-70 grayscale' : 'hover:shadow-2xl cursor-pointer'}`} onClick={() => canTakeTrial && onSelectMode('trial')}>
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800 mb-2">امتحان تجريبي</h3>
                        <p className="text-gray-500 mb-6">تدريب عشوائي مكون من 40 سؤال</p>
                        <ul className="text-sm text-gray-600 space-y-2 mb-8 text-right px-4">
                            <li className="flex items-center"><span className="ml-2 text-blue-500">✓</span> عدد الأسئلة: 40 سؤال</li>
                            <li className="flex items-center"><span className="ml-2 text-blue-500">✓</span> الترتيب: اختياري ثم صح/خطأ</li>
                            <li className="flex items-center"><span className="ml-2 text-blue-500">✓</span> المحاولات المتبقية: <span className="font-bold text-red-600 mr-1">{maxTrialAttempts - trialAttemptsCount}</span></li>
                        </ul>
                        <button disabled={!canTakeTrial} className={`w-full py-3 rounded-lg font-bold transition ${canTakeTrial ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-400 text-white cursor-not-allowed'}`}>
                            {canTakeTrial ? 'بدء الامتحان التجريبي' : 'تم استنفاذ المحاولات'}
                        </button>
                    </div>
                </div>

                {/* Final Exam Card */}
                <div className={`bg-white rounded-xl shadow-lg overflow-hidden border-t-4 border-brand-gold transition-shadow ${!canTakeFinal ? 'opacity-70 grayscale' : 'hover:shadow-2xl cursor-pointer'}`} onClick={() => canTakeFinal && onSelectMode('final')}>
                    <div className="p-8 text-center">
                        <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        <h3 className="text-2xl font-bold text-gray-800 mb-2">امتحان آخر العام</h3>
                        <p className="text-gray-500 mb-6">امتحان شامل لكامل المقرر الدراسي</p>
                        <ul className="text-sm text-gray-600 space-y-2 mb-8 text-right px-4">
                            <li className="flex items-center"><span className="ml-2 text-brand-gold">✓</span> يشمل جميع الأسئلة المتاحة</li>
                            <li className="flex items-center"><span className="ml-2 text-brand-gold">✓</span> الترتيب: اختياري ثم صح/خطأ</li>
                            <li className="flex items-center"><span className="ml-2 text-brand-gold">✓</span> المحاولات المتبقية: <span className="font-bold text-red-600 mr-1">{maxFinalAttempts - finalAttemptsCount}</span></li>
                        </ul>
                        <button disabled={!canTakeFinal} className={`w-full py-3 rounded-lg font-bold transition ${canTakeFinal ? 'bg-brand-gold text-gray-900 hover:bg-yellow-500' : 'bg-gray-400 text-white cursor-not-allowed'}`}>
                            {canTakeFinal ? 'بدء امتحان آخر العام' : 'تم استنفاذ المحاولات'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PreExamScreen: React.FC<{ subject: Subject; examType: ExamType; onBegin: () => void; onCancel: () => void }> = ({ subject, examType, onBegin, onCancel }) => {
    const { state } = useContext(AppContext);
    
    // Determine questions count purely for display
    const subjectQuestions = state.questions.filter(q => q.subjectId === subject.id);
    const questionCount = examType === 'trial' ? 40 : subjectQuestions.length;
    const durationMinutes = state.examSettings[subject.id]?.durationMinutes || 60; // Or adjust based on mode if needed

    return (
        <div className="max-w-3xl p-8 mx-auto bg-white rounded-lg shadow-lg">
            <h2 className="mb-4 text-2xl font-bold text-center text-brand-navy">
                تعليمات {examType === 'trial' ? 'الامتحان التجريبي' : 'امتحان آخر العام'}: {subject.name}
            </h2>
            <div className="p-6 my-6 space-y-4 text-center bg-yellow-50 border-r-4 border-brand-gold">
                <h3 className="text-lg font-bold text-brand-navy">تنبيه هام</h3>
                <p className="text-gray-700">
                    {examType === 'final' 
                        ? 'هذا امتحان رسمي. لديك فرصتان فقط لدخوله. تأكد من استعدادك التام.' 
                        : 'هذا امتحان تدريبي لتقييم مستواك. لديك 4 محاولات لهذا النوع.'}
                </p>
            </div>
            <div className="space-y-3 text-gray-800">
                <p>• مدة الامتحان <span className="font-bold">{durationMinutes} دقيقة</span> (أو حتى الانتهاء).</p>
                <p>• يتكون الامتحان من <span className="font-bold">{questionCount} سؤال</span>.</p>
                <p>• نوع الأسئلة: اختيار من متعدد أولاً، يليه أسئلة الصواب والخطأ.</p>
                <p>• بمجرد الضغط على زر "ابدأ الامتحان"، سيبدأ المؤقت <span className="font-bold">فورًا</span>.</p>
            </div>
            <div className="flex gap-4 mt-8 text-center">
                <button onClick={onCancel} className="flex-1 px-6 py-3 text-lg font-bold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">
                    إلغاء والعودة
                </button>
                <button onClick={onBegin} className="flex-1 px-6 py-3 text-lg font-bold text-gray-900 rounded-md shadow-xl brand-gold hover:bg-yellow-500">
                    ابدأ الامتحان الآن
                </button>
            </div>
        </div>
    );
};

const ExamScreen: React.FC<{ subject: Subject; examType: ExamType; onFinish: (attempt: ExamAttempt) => void }> = ({ subject, examType, onFinish }) => {
    const { state, setState, currentUser } = useContext(AppContext);
    const settings = state.examSettings[subject.id];
    const durationMinutes = settings?.durationMinutes || 60;

    const [questions, setQuestions] = useState<Question[]>([]);
    const [currentQIndex, setCurrentQIndex] = useState(0);
    const [answers, setAnswers] = useState<{ [questionId: string]: string }>({});
    const [timeLeft, setTimeLeft] = useState(durationMinutes * 60);

    const shuffleArray = <T,>(array: T[]): T[] => {
        return [...array].sort(() => Math.random() - 0.5);
    };

    useEffect(() => {
        // 1. Get all questions for subject
        let allSubjectQuestions = state.questions.filter(q => q.subjectId === subject.id);

        // 2. Separate types
        const mcqs = allSubjectQuestions.filter(q => q.type === QuestionType.MCQ);
        const tfs = allSubjectQuestions.filter(q => q.type === QuestionType.TRUE_FALSE);

        let finalQuestions: Question[] = [];

        if (examType === 'trial') {
            const allShuffled = shuffleArray(allSubjectQuestions);
            const selected40 = allShuffled.slice(0, 40);
            
            // Now sort selected40: MCQ first, then TF
            const selectedMCQs = selected40.filter(q => q.type === QuestionType.MCQ);
            const selectedTFs = selected40.filter(q => q.type === QuestionType.TRUE_FALSE);
            
            finalQuestions = [...selectedMCQs, ...selectedTFs];

        } else {
            // Final Exam: All questions
            const shuffledMCQ = shuffleArray(mcqs);
            const shuffledTF = shuffleArray(tfs);
            finalQuestions = [...shuffledMCQ, ...shuffledTF];
        }
        
        setQuestions(finalQuestions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subject.id, examType]);

    const submitExam = useCallback(() => {
        let score = 0;
        const finalAnswers = { ...answers };
        questions.forEach(q => {
            if (finalAnswers[q.id] === q.correctAnswer) {
                score++;
            }
        });
        
        const newAttempt: ExamAttempt = {
            id: `attempt_${Date.now()}`,
            userId: currentUser!.id,
            subjectId: subject.id,
            examType: examType,
            startTime: Date.now() - (durationMinutes * 60 - timeLeft) * 1000,
            endTime: Date.now(),
            answers: finalAnswers,
            questionIds: questions.map(q => q.id),
            score,
            totalQuestions: questions.length,
            status: 'completed'
        };

        setState(prevState => ({
            ...prevState,
            examAttempts: [...(prevState.examAttempts || []), newAttempt]
        }));
        onFinish(newAttempt);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [answers, currentUser, onFinish, questions, setState, subject.id, timeLeft, durationMinutes, examType]);


    useEffect(() => {
        if (questions.length === 0) return;
        const timer = setInterval(() => {
            setTimeLeft(prevTime => {
                if (prevTime <= 1) {
                    clearInterval(timer);
                    submitExam();
                    return 0;
                }
                return prevTime - 1;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, [questions, submitExam]);

    if (questions.length === 0) {
        return <div className="text-center p-8">جارٍ تحضير الأسئلة...</div>;
    }
    
    const currentQuestion = questions[currentQIndex];
    
    const handleAnswer = (answer: string) => {
        setAnswers(prev => ({...prev, [currentQuestion.id]: answer}));
    };

    return (
        <div className="max-w-4xl p-8 mx-auto bg-white rounded-lg shadow-2xl">
            <div className="flex items-center justify-between pb-4 mb-4 border-b">
                <div className="text-right">
                    <h2 className="text-xl font-bold text-brand-navy">{subject.name}</h2>
                    <span className="text-sm text-gray-500">{examType === 'trial' ? 'امتحان تجريبي' : 'امتحان آخر العام'}</span>
                </div>
                <div className="px-4 py-2 font-bold text-white rounded-md brand-navy">
                    {Math.floor(timeLeft / 60)}:{('0' + (timeLeft % 60)).slice(-2)}
                </div>
            </div>
            
            <div className="mb-6">
                <div className="flex justify-between items-center mb-2">
                    <p className="font-bold">السؤال {currentQIndex + 1} من {questions.length}</p>
                    <span className="text-xs font-bold px-2 py-1 bg-gray-100 rounded text-gray-600">
                        {currentQuestion.type === QuestionType.MCQ ? 'اختيار من متعدد' : 'صح أم خطأ'}
                    </span>
                </div>
                <p className="text-lg text-gray-800 leading-relaxed">{currentQuestion.text}</p>
            </div>
            
            <div className="space-y-4">
                {currentQuestion.type === QuestionType.MCQ && currentQuestion.options?.map((option, index) => (
                    <label key={index} className={`flex items-center p-4 border rounded-lg cursor-pointer hover:bg-gray-50 transition ${answers[currentQuestion.id] === String(index) ? 'bg-yellow-100 border-brand-gold' : 'border-gray-200'}`}>
                        <input type="radio" name={`q_${currentQuestion.id}`} value={index} checked={answers[currentQuestion.id] === String(index)} onChange={() => handleAnswer(String(index))} className="w-5 h-5 ml-4 text-brand-gold focus:ring-brand-gold"/>
                        <span className="text-brand-navy">{option}</span>
                    </label>
                ))}
                 {currentQuestion.type === QuestionType.TRUE_FALSE && (
                    <div className="flex gap-4">
                        <label className={`flex-1 flex items-center justify-center p-6 border rounded-lg cursor-pointer hover:bg-gray-50 transition ${answers[currentQuestion.id] === 'true' ? 'bg-yellow-100 border-brand-gold' : 'border-gray-200'}`}>
                            <input type="radio" name={`q_${currentQuestion.id}`} value="true" checked={answers[currentQuestion.id] === 'true'} onChange={() => handleAnswer('true')} className="w-5 h-5 ml-4 text-brand-gold focus:ring-brand-gold" />
                            <span className="text-brand-navy text-lg font-bold">✓ صح</span>
                        </label>
                        <label className={`flex-1 flex items-center justify-center p-6 border rounded-lg cursor-pointer hover:bg-gray-50 transition ${answers[currentQuestion.id] === 'false' ? 'bg-yellow-100 border-brand-gold' : 'border-gray-200'}`}>
                            <input type="radio" name={`q_${currentQuestion.id}`} value="false" checked={answers[currentQuestion.id] === 'false'} onChange={() => handleAnswer('false')} className="w-5 h-5 ml-4 text-brand-gold focus:ring-brand-gold" />
                            <span className="text-brand-navy text-lg font-bold">✗ خطأ</span>
                        </label>
                    </div>
                 )}
            </div>

            <div className="flex justify-between mt-8 pt-6 border-t border-gray-100">
                <button onClick={() => setCurrentQIndex(Math.max(0, currentQIndex - 1))} disabled={currentQIndex === 0} className="px-6 py-2 bg-gray-200 rounded-md disabled:opacity-50 hover:bg-gray-300 transition">السابق</button>
                {currentQIndex === questions.length - 1 ? (
                    <button onClick={submitExam} className="px-6 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 shadow-md transition">تسليم الامتحان</button>
                ) : (
                    <button onClick={() => setCurrentQIndex(Math.min(questions.length - 1, currentQIndex + 1))} className="px-6 py-2 text-white rounded-md brand-gold hover:bg-yellow-500 shadow-md transition">التالي</button>
                )}
            </div>
        </div>
    );
};

const getGradeDetails = (score: number, totalQuestions: number): { grade: string, color: string } => {
    if (totalQuestions === 0) return { grade: 'N/A', color: 'text-gray-500' };
    const percentage = (score / totalQuestions) * 100;
    if (percentage < 50) return { grade: 'راسب', color: 'text-red-500' };
    if (percentage < 65) return { grade: 'مقبول', color: 'text-orange-500' };
    if (percentage < 80) return { grade: 'جيد', color: 'text-blue-500' };
    if (percentage < 90) return { grade: 'جيد جداً', color: 'text-green-500' };
    return { grade: 'امتياز', color: 'text-purple-500' };
};

const FullExamReview: React.FC<{ attempt: ExamAttempt }> = ({ attempt }) => {
    const { state } = useContext(AppContext);

    // Reconstruct the exact list of questions presented in the exam.
    const reviewedQuestions = useMemo(() => {
        const idsToReview = attempt.questionIds || Object.keys(attempt.answers);
        
        return idsToReview.map(qId => {
            const question = state.questions.find(q => q.id === qId);
            if (!question) return null;
            const userAnswer = attempt.answers[qId]; // May be undefined if skipped
            const isCorrect = userAnswer === question.correctAnswer;
            return { question, userAnswer, isCorrect };
        }).filter(x => x !== null) as { question: Question, userAnswer: string | undefined, isCorrect: boolean }[];
    }, [attempt, state.questions]);

    return (
        <div className="p-6 mt-8 bg-white rounded-lg shadow-md">
            <h3 className="mb-4 text-2xl font-bold text-center text-brand-navy">مراجعة الإجابات والأسئلة الكاملة</h3>
            <div className="space-y-6">
                {reviewedQuestions.map(({ question, userAnswer, isCorrect }, index) => {
                    let userAnswerText = userAnswer;
                    let correctAnswerText = question.correctAnswer;
                    
                    if (!userAnswer) {
                         userAnswerText = "لم يتم الإجابة";
                    } else if (question.type === QuestionType.MCQ && question.options) {
                        userAnswerText = question.options[parseInt(userAnswer)] || "لم تجب";
                    } else if (question.type === QuestionType.TRUE_FALSE) {
                        userAnswerText = userAnswer === 'true' ? 'صح' : 'خطأ';
                    }

                    if (question.type === QuestionType.MCQ && question.options) {
                        correctAnswerText = question.options[parseInt(question.correctAnswer)];
                    } else if (question.type === QuestionType.TRUE_FALSE) {
                        correctAnswerText = question.correctAnswer === 'true' ? 'صح' : 'خطأ';
                    }

                    return (
                        <div key={question.id} className={`p-4 border-r-4 rounded-lg shadow-sm ${isCorrect ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}>
                            <div className="flex items-start justify-between">
                                <div>
                                    <p className="font-bold text-gray-800">({index + 1}) {question.text}</p>
                                    <div className="mt-2 text-sm">
                                        <span className={`font-bold ${isCorrect ? 'text-green-700' : 'text-red-700'}`}>
                                            إجابتك: {userAnswerText}
                                        </span>
                                        {!isCorrect && (
                                            <span className="mr-4 font-bold text-green-700">
                                                 الإجابة الصحيحة: {correctAnswerText}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                {isCorrect ? (
                                    <span className="text-2xl text-green-500">✓</span>
                                ) : (
                                    <span className="text-2xl text-red-500">✗</span>
                                )}
                            </div>
                            {question.explanation && <p className="p-2 mt-2 text-sm text-gray-600 bg-white rounded border border-gray-100">توضيح: {question.explanation}</p>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
};


const ResultsScreen: React.FC<{ attempt: ExamAttempt; onBack: () => void }> = ({ attempt, onBack }) => {
    const { state, currentUser } = useContext(AppContext);
    const [isDownloading, setIsDownloading] = useState(false);
    const [showReview, setShowReview] = useState(false);
    
    const subject = state.subjects.find(s => s.id === attempt.subjectId)!;
    
    // Updated grading logic to be out of 100
    const finalScore = attempt.totalQuestions > 0 ? ((attempt.score / attempt.totalQuestions) * 100).toFixed(0) : "0";
    const gradeDetails = getGradeDetails(attempt.score, attempt.totalQuestions);

    const handleDownloadPDF = async () => {
        if (isDownloading) return;
        setIsDownloading(true);
        try {
            await generatePDFFromElement("pdf-content", `Result_${currentUser!.username}.pdf`);
        } catch (error) {
            alert("Error generating PDF");
        } finally {
            setIsDownloading(false);
        }
    };
    
    return (
        <div className="max-w-4xl p-2 mx-auto sm:p-8">
            {/* Printable Certificate Area */}
            <div id="pdf-content" className="relative p-8 bg-white shadow-lg border-8 border-double border-brand-gold">
                <header className="flex items-center justify-between pb-6 border-b-2 border-gray-200">
                    <div className="text-right">
                        <h2 className="text-2xl font-bold text-brand-navy">كلية الحقوق بقنا</h2>
                        <p className="text-lg text-gray-600">الفرقة الأولى ({currentUser?.enrollmentType === EnrollmentType.INTIZAM ? 'انتظام' : 'انتساب'})</p>
                    </div>
                    <div className="opacity-80">
                        <svg className="w-24 h-24 text-brand-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 14l9-5-9-5-9 5 9 5z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 14l6.16-3.422A12.083 12.083 0 0112 21a12.083 12.083 0 01-6.16-10.422L12 14z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 14l-9 5 9 5 9-5-9-5z" /></svg>
                    </div>
                </header>

                <div className="py-10 text-center">
                    <h1 className="mb-2 text-3xl font-bold text-brand-navy">شهادة إتمام اختبار</h1>
                    <p className="text-gray-500">
                        {attempt.examType === 'trial' ? 'نسخة امتحان تجريبي' : 'نسخة رسمية - امتحان آخر العام'}
                    </p>
                </div>
                
                <div className="space-y-6 text-center">
                    <p className="text-xl text-gray-800">تشهد إدارة النظام بأن الطالب/ة</p>
                    <div className="my-4">
                        <h3 className="text-3xl font-bold text-brand-navy decoration-brand-gold underline decoration-4 underline-offset-8">
                            {currentUser?.fullName || "اسم غير متوفر"}
                        </h3>
                    </div>
                    <p className="text-xl text-gray-800">قد أتم اختبار مادة <span className="font-bold text-brand-gold">{subject.name}</span></p>
                    <p className="text-gray-600">بتاريخ: {new Date(attempt.endTime).toLocaleString('ar-EG')}</p>
                </div>

                <section className="grid grid-cols-3 gap-4 p-6 my-10 border rounded-lg bg-gray-50 border-brand-gold">
                    <div className="text-center">
                        <p className="text-gray-500">الدرجة</p>
                        <p className="text-3xl font-bold text-brand-navy">{finalScore} / 100</p>
                    </div>
                    <div className="text-center border-r border-l border-gray-300">
                        <p className="text-gray-500">التقدير</p>
                        <p className={`text-3xl font-extrabold ${gradeDetails.color}`}>{gradeDetails.grade}</p>
                    </div>
                    <div className="text-center">
                        <p className="text-gray-500">نسبة النجاح</p>
                        <p className="text-3xl font-bold text-brand-navy">{Math.round((attempt.score / attempt.totalQuestions) * 100)}%</p>
                    </div>
                </section>

                <div className="grid grid-cols-2 gap-16 mt-16 text-center">
                    <div className="pt-8 border-t border-gray-300">
                        <p className="font-bold text-gray-700">يعتمد، عميد الكلية</p>
                    </div>
                    <div className="pt-8 border-t border-gray-300">
                        <p className="font-bold text-gray-700">شؤون الطلاب</p>
                    </div>
                </div>

                <footer className="pt-6 mt-12 text-center border-t border-gray-200">
                    <p className="text-lg font-bold text-brand-navy">هذا العمل لوجه الله تعالى، وجعله الله صدقة جارية على روح أمي.</p>
                    <p className="mt-1 text-lg font-bold text-brand-gold">أسألكم الدعاء لها بالرحمة والمغفرة.</p>
                    <p className="mt-2 text-xs text-gray-400">System ID: {attempt.id}</p>
                </footer>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-4 mt-8 md:flex-row md:justify-between no-print">
                <button onClick={onBack} className="px-6 py-3 font-bold text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300">
                    العودة للقائمة
                </button>
                <div className="flex flex-col gap-4 md:flex-row">
                    <button onClick={() => setShowReview(!showReview)} className="px-6 py-3 font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700">
                        {showReview ? 'إخفاء المراجعة' : 'مراجعة الإجابات والأسئلة'}
                    </button>
                    <button onClick={handleDownloadPDF} disabled={isDownloading} className="px-6 py-3 font-bold text-white bg-green-600 rounded-md hover:bg-green-700">
                        {isDownloading ? 'جاري التحميل...' : 'تحميل الشهادة PDF'}
                    </button>
                </div>
            </div>
            
            {showReview && <FullExamReview attempt={attempt} />}
        </div>
    );
};

const QuestionForm: React.FC<{
    question: Question;
    setQuestion: React.Dispatch<React.SetStateAction<Question | null>>;
    onSave: () => void;
    onCancel: () => void;
    subjects: Subject[];
}> = ({ question, setQuestion, onSave, onCancel, subjects }) => {
    const handleChange = (e: any) => {
        const { name, value } = e.target;
        setQuestion(prev => prev ? { ...prev, [name]: value } : null);
    };
    
    const handleOptionChange = (index: number, value: string) => {
        if (!question.options) return;
        const newOptions = [...question.options];
        newOptions[index] = value;
        setQuestion(prev => prev ? { ...prev, options: newOptions } : null);
    };

    return (
        <div className="p-6 mb-8 border border-gray-200 rounded-lg bg-gray-50">
             <h4 className="mb-4 text-lg font-semibold text-brand-navy">تعديل / إضافة سؤال</h4>
             <div className="space-y-4">
                 <div>
                    <label className="block mb-1 text-sm font-medium">المادة</label>
                    <select name="subjectId" value={question.subjectId} onChange={handleChange} className="w-full p-2 border rounded">
                        {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                 </div>
                 <div>
                    <label className="block mb-1 text-sm font-medium">نص السؤال</label>
                    <textarea name="text" value={question.text} onChange={handleChange} className="w-full p-2 border rounded" rows={3} />
                 </div>
                 
                 <div className="flex items-center space-x-4 rtl:space-x-reverse">
                    <label className="block mb-1 text-sm font-medium">نوع السؤال: </label>
                    <select name="type" value={question.type} onChange={handleChange} className="p-2 border rounded">
                        <option value={QuestionType.MCQ}>اختيار من متعدد</option>
                        <option value={QuestionType.TRUE_FALSE}>صح / خطأ</option>
                    </select>
                 </div>

                 {question.type === QuestionType.MCQ && (
                     <div className="space-y-2">
                         <label className="block mb-1 text-sm font-medium">الخيارات (حدد الإجابة الصحيحة)</label>
                         {question.options?.map((opt, idx) => (
                             <div key={idx} className="flex items-center gap-2">
                                 <input 
                                    type="radio" 
                                    name="correctAnswer" 
                                    checked={question.correctAnswer === String(idx)} 
                                    onChange={() => setQuestion(prev => prev ? {...prev, correctAnswer: String(idx)} : null)}
                                 />
                                 <input 
                                    type="text" 
                                    value={opt} 
                                    onChange={e => handleOptionChange(idx, e.target.value)} 
                                    className="flex-1 p-2 border rounded"
                                    placeholder={`الخيار ${idx + 1}`}
                                 />
                             </div>
                         ))}
                     </div>
                 )}

                 {question.type === QuestionType.TRUE_FALSE && (
                     <div className="flex gap-4">
                         <label className="flex items-center gap-2">
                             <input 
                                type="radio" 
                                name="correctAnswer" 
                                value="true"
                                checked={question.correctAnswer === 'true'} 
                                onChange={handleChange}
                             />
                             <span>صح</span>
                         </label>
                         <label className="flex items-center gap-2">
                             <input 
                                type="radio" 
                                name="correctAnswer" 
                                value="false"
                                checked={question.correctAnswer === 'false'} 
                                onChange={handleChange}
                             />
                             <span>خطأ</span>
                         </label>
                     </div>
                 )}

                 <div>
                    <label className="block mb-1 text-sm font-medium">توضيح الإجابة (اختياري)</label>
                    <textarea name="explanation" value={question.explanation || ''} onChange={handleChange} className="w-full p-2 border rounded" />
                 </div>

                 <div className="flex justify-end gap-2 pt-4 border-t">
                     <button onClick={onCancel} className="px-4 py-2 text-gray-700 bg-gray-300 rounded hover:bg-gray-400">إلغاء</button>
                     <button onClick={onSave} className="px-4 py-2 text-white bg-green-600 rounded hover:bg-green-700">حفظ السؤال</button>
                 </div>
             </div>
        </div>
    );
};

const AdminView: React.FC = () => {
    const { state, setState } = useContext(AppContext);
    const [tab, setTab] = useState<'monitor' | 'questions' | 'settings'>('monitor');

    // Monitor Tab State
    const [searchTerm, setSearchTerm] = useState('');
    const [filterSubject, setFilterSubject] = useState('all');
    const [filterType, setFilterType] = useState('all');

    // Questions Tab State
    const [selectedSubjectId, setSelectedSubjectId] = useState<string>(state.subjects[0]?.id);
    const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
    const [isCreating, setIsCreating] = useState(false);

    const handleSaveQuestion = () => {
        if (!editingQuestion) return;
        
        setState(prev => {
            const isNew = !prev.questions.find(q => q.id === editingQuestion.id);
            let newQuestions;
            if (isNew) {
                newQuestions = [...prev.questions, editingQuestion];
            } else {
                newQuestions = prev.questions.map(q => q.id === editingQuestion.id ? editingQuestion : q);
            }
            return { ...prev, questions: newQuestions };
        });
        setEditingQuestion(null);
        setIsCreating(false);
    };

    const handleDeleteQuestion = (id: string) => {
        if (window.confirm('هل أنت متأكد من حذف هذا السؤال؟')) {
            setState(prev => ({
                ...prev,
                questions: prev.questions.filter(q => q.id !== id)
            }));
        }
    };

    const createNewQuestion = () => {
        setEditingQuestion({
            id: `q_${Date.now()}`,
            subjectId: selectedSubjectId,
            type: QuestionType.MCQ,
            text: '',
            options: ['', '', '', ''],
            correctAnswer: '0',
            explanation: ''
        });
        setIsCreating(true);
    };

    const handleUnlockUser = (userId: string) => {
        if (!window.confirm('هل أنت متأكد من فك حظر هذا الطالب؟')) return;
        setState(prev => ({
            ...prev,
            users: prev.users.map(u => u.id === userId ? { ...u, isLocked: false, failedLoginAttempts: 0 } : u)
        }));
        alert('تم فك الحظر بنجاح.');
    };

    const handleResetPassword = (userId: string) => {
        const newPass = prompt('أدخل كلمة المرور الجديدة (4 أرقام):');
        if (!newPass || newPass.length < 4) return;
        
        setState(prev => ({
            ...prev,
            users: prev.users.map(u => u.id === userId ? { ...u, passwordHash: newPass, isLocked: false, failedLoginAttempts: 0 } : u)
        }));
        alert('تم تغيير كلمة المرور وفك الحظر إن وجد.');
    };

    // Settings Tab Logic
    const updateExamSetting = (subjectId: string, field: string, value: any) => {
        setState(prev => ({
            ...prev,
            examSettings: {
                ...prev.examSettings,
                [subjectId]: {
                    ...prev.examSettings[subjectId] || { isOpen: false, questionCount: 20, durationMinutes: 30, allowRetakes: false },
                    [field]: value
                }
            }
        }));
    };

    // Filter attempts logic
    const filteredAttempts = state.examAttempts.filter(attempt => {
        const user = state.users.find(u => u.id === attempt.userId);
        const matchesSearch = user ? user.fullName.toLowerCase().includes(searchTerm.toLowerCase()) : false;
        const matchesSubject = filterSubject === 'all' || attempt.subjectId === filterSubject;
        const matchesType = filterType === 'all' || attempt.examType === filterType;
        return matchesSearch && matchesSubject && matchesType;
    }).sort((a, b) => b.endTime - a.endTime);

    const filteredQuestions = state.questions.filter(q => q.subjectId === selectedSubjectId);

    const studentsList = state.users.filter(u => u.role === UserRole.STUDENT && u.fullName.includes(searchTerm));

    return (
        <>
            <Header />
            <div className="container p-4 mx-auto">
                {/* Tabs */}
                <div className="flex mb-6 space-x-1 bg-white rounded-lg shadow rtl:space-x-reverse p-1">
                    <button onClick={() => setTab('monitor')} className={`flex-1 py-3 text-sm font-bold rounded-md transition ${tab === 'monitor' ? 'bg-brand-navy text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
                        المراقبة والطلاب
                    </button>
                    <button onClick={() => setTab('questions')} className={`flex-1 py-3 text-sm font-bold rounded-md transition ${tab === 'questions' ? 'bg-brand-navy text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
                        بنك الأسئلة
                    </button>
                    <button onClick={() => setTab('settings')} className={`flex-1 py-3 text-sm font-bold rounded-md transition ${tab === 'settings' ? 'bg-brand-navy text-white shadow' : 'text-gray-600 hover:bg-gray-100'}`}>
                        إعدادات الامتحانات
                    </button>
                </div>

                {/* Content */}
                {tab === 'monitor' && (
                     <div className="space-y-6">
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <div className="p-6 bg-white rounded-lg shadow border-r-4 border-brand-navy">
                                <h3 className="text-gray-500">الطلاب المسجلين</h3>
                                <p className="text-4xl font-bold text-brand-navy">{state.users.filter(u => u.role === UserRole.STUDENT).length}</p>
                            </div>
                             <div className="p-6 bg-white rounded-lg shadow border-r-4 border-brand-gold">
                                <h3 className="text-gray-500">الامتحانات المكتملة</h3>
                                <p className="text-4xl font-bold text-brand-navy">{state.examAttempts.length}</p>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow p-4">
                            <h3 className="text-lg font-bold text-brand-navy mb-4 border-b pb-2">أدوات البحث والفلترة</h3>
                            <div className="flex flex-col md:flex-row gap-4 mb-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">بحث باسم الطالب</label>
                                    <input 
                                        type="text" 
                                        placeholder="بحث..." 
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full p-2 border rounded"
                                    />
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">تصفية حسب المادة</label>
                                    <select 
                                        value={filterSubject} 
                                        onChange={(e) => setFilterSubject(e.target.value)}
                                        className="w-full p-2 border rounded"
                                    >
                                        <option value="all">كل المواد</option>
                                        {state.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex-1">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">نوع الامتحان</label>
                                    <select 
                                        value={filterType} 
                                        onChange={(e) => setFilterType(e.target.value)}
                                        className="w-full p-2 border rounded"
                                    >
                                        <option value="all">الكل</option>
                                        <option value="trial">تجريبي</option>
                                        <option value="final">نهائي (رسمي)</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Students Management Table */}
                        <div className="bg-white rounded-lg shadow mb-8">
                            <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
                                <h3 className="font-bold text-brand-navy">إدارة الطلاب وحساباتهم</h3>
                            </div>
                            <div className="overflow-x-auto max-h-60 overflow-y-auto">
                                <table className="w-full text-right">
                                    <thead className="bg-gray-100 sticky top-0">
                                        <tr>
                                            <th className="p-3 text-sm font-bold">الاسم</th>
                                            <th className="p-3 text-sm font-bold">كلمة المرور</th>
                                            <th className="p-3 text-sm font-bold">الحالة</th>
                                            <th className="p-3 text-sm font-bold">إجراءات</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {studentsList.map(u => (
                                            <tr key={u.id} className="border-b hover:bg-gray-50">
                                                <td className="p-3">{u.fullName}</td>
                                                <td className="p-3 text-gray-500 font-mono">{u.passwordHash}</td>
                                                <td className="p-3">
                                                    {u.isLocked ? (
                                                        <span className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs font-bold">محظور (خطأ مرتين)</span>
                                                    ) : (
                                                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold">نشط</span>
                                                    )}
                                                </td>
                                                <td className="p-3 flex gap-2">
                                                    {u.isLocked && (
                                                        <button onClick={() => handleUnlockUser(u.id)} className="bg-orange-500 text-white px-2 py-1 rounded text-xs hover:bg-orange-600">فك الحظر</button>
                                                    )}
                                                    <button onClick={() => handleResetPassword(u.id)} className="bg-blue-500 text-white px-2 py-1 rounded text-xs hover:bg-blue-600">تغيير الباسورد</button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Exam Results Table */}
                        <div className="overflow-hidden bg-white rounded-lg shadow">
                            <div className="px-6 py-4 border-b bg-gray-50">
                                <h3 className="font-bold text-brand-navy">سجل درجات الامتحانات</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-right">
                                    <thead className="bg-gray-100">
                                        <tr>
                                            <th className="p-4 text-sm font-bold text-gray-600">اسم الطالب</th>
                                            <th className="p-4 text-sm font-bold text-gray-600">نوع القيد</th>
                                            <th className="p-4 text-sm font-bold text-gray-600">المادة</th>
                                            <th className="p-4 text-sm font-bold text-gray-600">نوع الامتحان</th>
                                            <th className="p-4 text-sm font-bold text-gray-600">الدرجة (من 100)</th>
                                            <th className="p-4 text-sm font-bold text-gray-600">الحالة</th>
                                            <th className="p-4 text-sm font-bold text-gray-600">التاريخ</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredAttempts.map(a => {
                                            const u = state.users.find(u => u.id === a.userId);
                                            const s = state.subjects.find(s => s.id === a.subjectId);
                                            const scorePercent = (a.score / a.totalQuestions) * 100;
                                            const isPass = scorePercent >= 50;
                                            return (
                                                <tr key={a.id} className="border-b hover:bg-gray-50">
                                                    <td className="p-4 font-bold text-brand-navy">{u?.fullName || 'غير معروف'}</td>
                                                    <td className="p-4 text-sm text-gray-600">{u?.enrollmentType === EnrollmentType.INTIZAM ? 'انتظام' : 'انتساب'}</td>
                                                    <td className="p-4">{s?.name}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-1 rounded text-xs text-white ${a.examType === 'trial' ? 'bg-blue-500' : 'bg-brand-gold text-gray-900'}`}>
                                                            {a.examType === 'trial' ? 'تجريبي' : 'نهائي'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 font-bold text-lg">{scorePercent.toFixed(0)}</td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-1 rounded text-xs font-bold ${isPass ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                            {isPass ? 'ناجح' : 'راسب'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-sm text-gray-500">{new Date(a.startTime).toLocaleString('ar-EG')}</td>
                                                </tr>
                                            );
                                        })}
                                        {filteredAttempts.length === 0 && (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-gray-500">لا توجد نتائج مطابقة للبحث</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {tab === 'questions' && (
                    <div className="bg-white rounded-lg shadow p-6">
                        <div className="flex justify-between items-center mb-6">
                             <div className="w-1/3">
                                <label className="block text-sm font-bold text-gray-700 mb-1">اختر المادة</label>
                                <select 
                                    value={selectedSubjectId} 
                                    onChange={e => setSelectedSubjectId(e.target.value)}
                                    className="w-full border rounded-md p-2"
                                >
                                    {state.subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                             </div>
                             <button 
                                onClick={createNewQuestion}
                                className="bg-green-600 text-white px-4 py-2 rounded-md font-bold hover:bg-green-700"
                             >
                                + إضافة سؤال جديد
                             </button>
                        </div>

                        {editingQuestion ? (
                            <QuestionForm 
                                question={editingQuestion} 
                                setQuestion={setEditingQuestion} 
                                onSave={handleSaveQuestion}
                                onCancel={() => { setEditingQuestion(null); setIsCreating(false); }}
                                subjects={state.subjects}
                            />
                        ) : (
                            <div className="space-y-4">
                                {filteredQuestions.length === 0 ? (
                                    <p className="text-center text-gray-500 py-8">لا يوجد أسئلة مضافة لهذه المادة.</p>
                                ) : (
                                    filteredQuestions.map((q, idx) => (
                                        <div key={q.id} className="border p-4 rounded-lg flex justify-between items-start bg-gray-50">
                                            <div>
                                                <span className="font-bold text-brand-navy ml-2">#{idx + 1}</span>
                                                <span className="font-bold text-gray-800">{q.text}</span>
                                                <div className="mt-2 text-sm text-gray-600">
                                                    نوع: {q.type === QuestionType.MCQ ? 'اختيار من متعدد' : 'صح/خطأ'} | 
                                                    الإجابة الصحيحة: {q.type === QuestionType.MCQ ? (q.options ? q.options[parseInt(q.correctAnswer)] : '') : (q.correctAnswer === 'true' ? 'صح' : 'خطأ')}
                                                </div>
                                            </div>
                                            <div className="flex space-x-2 rtl:space-x-reverse">
                                                <button 
                                                    onClick={() => { setEditingQuestion(q); setIsCreating(false); }}
                                                    className="text-blue-600 hover:text-blue-800 font-bold px-2"
                                                >
                                                    تعديل
                                                </button>
                                                <button 
                                                    onClick={() => handleDeleteQuestion(q.id)}
                                                    className="text-red-600 hover:text-red-800 font-bold px-2"
                                                >
                                                    حذف
                                                </button>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                )}

                {tab === 'settings' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {state.subjects.map(subject => {
                            const settings = state.examSettings[subject.id] || { isOpen: false, questionCount: 60, durationMinutes: 60, allowRetakes: true };
                            return (
                                <div key={subject.id} className="bg-white rounded-lg shadow p-6 border-t-4 border-brand-navy">
                                    <div className="flex justify-between items-center mb-4">
                                        <h3 className="font-bold text-lg text-brand-navy">{subject.name}</h3>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                            <input 
                                                type="checkbox" 
                                                checked={settings.isOpen} 
                                                onChange={(e) => updateExamSetting(subject.id, 'isOpen', e.target.checked)}
                                                className="sr-only peer"
                                            />
                                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                            <span className="mr-3 text-sm font-medium text-gray-900">{settings.isOpen ? 'مفعل' : 'مغلق'}</span>
                                        </label>
                                    </div>
                                    <div className="space-y-4">
                                        <p className="text-sm text-gray-500">إعدادات الامتحان النهائي</p>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">مدة الامتحان (دقيقة)</label>
                                            <input 
                                                type="number" 
                                                value={settings.durationMinutes} 
                                                onChange={(e) => updateExamSetting(subject.id, 'durationMinutes', parseInt(e.target.value))}
                                                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-300 focus:ring focus:ring-indigo-200 focus:ring-opacity-50 p-2 border" 
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </>
    );
}

export default App;
