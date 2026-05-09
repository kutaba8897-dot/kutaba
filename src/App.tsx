import React, { useState, useEffect, ReactNode } from 'react';
import { BookOpen, Sparkles, Layout, Settings, LogOut, User, GraduationCap, Clock, LogIn, Trash2, ChevronRight, Share2, Copy, Check, ArrowUp, X, Send, ExternalLink, Eye } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import FileUploader from './components/FileUploader';
import QuizView from './components/QuizView';
import { extractTextFromPDF } from './lib/pdfParser';
import { generateQuizFromText, Quiz } from './services/quizService';
import { useAuth } from './components/FirebaseProvider';
import { saveQuiz, getUserQuizzes, deleteQuiz, getQuizById, getQuizSubmissions } from './services/firestoreService';
import { cn } from './lib/utils';

export default function App() {
  const [view, setView] = useState<'home' | 'quiz' | 'history' | 'submissions'>('home');
  const [provider, setProvider] = useState<'gemini' | 'deepseek'>('gemini');
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingShared, setIsFetchingShared] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);
  const [userQuizzes, setUserQuizzes] = useState<(Quiz & { id: string })[]>([]);

  useEffect(() => {
    // Check for shared quiz ID in URL
    const params = new URLSearchParams(window.location.search);
    const sharedId = params.get('quizId');
    if (sharedId) {
      loadSharedQuiz(sharedId);
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    });
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBtn(false);
    }
    setDeferredPrompt(null);
  };
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [selectedQuizForStats, setSelectedQuizForStats] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [shareModalData, setShareModalData] = useState<{ url: string, id: string } | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [studentQuizStarted, setStudentQuizStarted] = useState(false);
  const { user, login, logout, loading: authLoading } = useAuth();

  const loadSharedQuiz = async (id: string) => {
    setIsFetchingShared(true);
    try {
      const sharedQuiz = await getQuizById(id);
      if (sharedQuiz) {
        setQuiz(sharedQuiz);
        setView('quiz');
      } else {
        alert("عذراً، لم يتم العثور على هذا الاختبار. قد يكون قد تم حذفه.");
        setView('home');
      }
    } catch (err) {
      console.error("Shared Quiz Error:", err);
      setView('home');
    } finally {
      setIsFetchingShared(false);
    }
  };

  const loadHistory = async () => {
    const history = await getUserQuizzes();
    setUserQuizzes(history);
  };

  const handleUpload = async (file: File) => {
    let isRequestFinished = false;
    let timeoutId: any;
    try {
      setIsLoading(true);
      
      // Safety timeout after 90 seconds
      timeoutId = setTimeout(() => {
        if (!isRequestFinished) {
          setIsLoading(false);
          alert("يبدو أن العملية تستغرق وقتاً طويلاً. يرجى التأكد من أن ملف PDF ليس ضخماً جداً (يفضل أقل من 30 صفحة) أو حاول تحديث الصفحة.");
        }
      }, 90000);

      const text = await extractTextFromPDF(file);
      const generatedQuiz = await generateQuizFromText(text, 10, provider);
      
      isRequestFinished = true;
      clearTimeout(timeoutId);
      
      if (user) {
        try {
          const id = await saveQuiz(generatedQuiz);
          if (id) {
            (generatedQuiz as any).id = id;
          }
          await loadHistory();
        } catch (saveError) {
          console.error("Failed to save quiz to history:", saveError);
        }
      }
      
      setQuiz(generatedQuiz);
      setView('quiz');

      const quizId = (generatedQuiz as any).id;
      if (quizId) {
        setTimeout(() => {
          handleShare(quizId);
        }, 800);
      }
    } catch (error: any) {
      console.error("Error generating quiz:", error);
      const errorMessage = error instanceof Error ? error.message : "حدث خطأ غير متوقع";
      alert(`عذراً، فشل معالجة الملف: ${errorMessage}`);
    } finally {
      isRequestFinished = true;
      if (timeoutId) clearTimeout(timeoutId);
      setIsLoading(false);
    }
  };

  const handleDeleteQuiz = async (id: string) => {
    if (confirm("هل أنت متأكد من حذف هذا الاختبار؟")) {
      await deleteQuiz(id);
      await loadHistory();
    }
  };

  const viewStats = async (quizId: string) => {
    setIsLoading(true);
    setSelectedQuizForStats(quizId);
    const results = await getQuizSubmissions(quizId);
    setSubmissions(results);
    setView('submissions');
    setIsLoading(false);
  };

  const handleShare = (id: string) => {
    try {
      const currentUrl = new URL(window.location.href);
      let hostname = currentUrl.hostname;
      
      // 1. Detect if we are in the editor frame (google.com)
      if (hostname.includes('aistudio.google.com')) {
        alert("⚠️ خطوة هامة لمشاركة الرابط:\n\nأنت الآن في 'بيئة البرمجة'. هذا الرابط لا يفتح عند الطلاب.\n\nالحل:\n1. اضغط على أيقونة السهم (↗️) في أعلى الصفحة (Open in new tab).\n2. ارفع الملف في الصفحة الجديدة التي ستفتح.\n3. اضغط مشاركة من هناك وسيعمل الرابط مع طلابك.");
        return;
      }

      // 2. Decide the base domain for sharing
      // If we're on a dev/shared preview, we use the public version (ais-pre)
      // Otherwise we use current origin (which is correct if user is on their own domain)
      let shareBase = window.location.origin;
      if (hostname.includes('ais-dev-')) {
        shareBase = `https://${hostname.replace('ais-dev-', 'ais-pre-')}`;
      }
      
      // 3. Construct clean share URL to the root
      // IMPORTANT: Using origin + "/" to avoid relative path issues or hex path 404s
      const shareUrl = `${shareBase}/?quizId=${id}`;
      
      // 4. Directly open the student link in a new tab
      window.open(shareUrl, '_blank');
      
      // Copy to clipboard with error handling
      try {
        navigator.clipboard.writeText(shareUrl).then(() => {
          setCopiedId(id);
          setTimeout(() => setCopiedId(null), 3000);
        }).catch(() => {
          // Silent catch for clipboard permission issues
          console.warn("Clipboard access denied. User can use manual copy button.");
        });
      } catch (e) {
        console.warn("Clipboard API not available.");
      }

      // Open custom share modal
      setShareModalData({ url: shareUrl, id });
      
    } catch (err) {
      alert("عذراً، حدث خطأ في إنشاء الرابط.");
    }
  };

  const resetQuiz = () => {
    // Clear URL param without reloading
    const url = new URL(window.location.href);
    url.searchParams.delete('quizId');
    window.history.pushState({}, '', url);
    
    setQuiz(null);
    setView('home');
  };

  // Check for student mode (direct quiz link)
  const isStudentMode = new URLSearchParams(window.location.search).has('quizId');

  if (isStudentMode && isFetchingShared) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-white" dir="rtl">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-2xl mb-10"
        >
          <GraduationCap className="w-10 h-10 text-white" />
        </motion.div>
        <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">إديوترانسفورم <span className="text-blue-600">AI</span></h2>
        <p className="text-slate-400 font-bold animate-pulse uppercase tracking-[0.2em] text-[10px]">جاري دخول منصة الطالب...</p>
      </div>
    );
  }

  // Display minimal student view if a quiz is loaded via shared link
  if (isStudentMode && quiz && view === 'quiz') {
    if (!studentQuizStarted) {
      return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center overflow-hidden relative" dir="rtl">
          {/* Background decoration */}
          <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 -z-10" />
          <div className="absolute bottom-0 left-0 w-[600px] h-[600px] bg-purple-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 -z-10" />

          <motion.div 
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-xl space-y-10 relative z-10"
          >
            <div className="flex flex-col items-center space-y-6">
              <motion.div 
                animate={{ 
                  y: [0, -12, 0],
                  rotate: [0, 8, -8, 0]
                }}
                transition={{ duration: 7, repeat: Infinity }}
                className="w-28 h-28 bg-blue-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-blue-500/30"
              >
                <GraduationCap className="text-white w-14 h-14" />
              </motion.div>
              <div>
                <h1 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter">إديوترانسفورم <span className="text-blue-600">AI</span></h1>
                <p className="text-slate-400 font-black mt-3 uppercase tracking-[0.3em] text-[10px]">المنصة التعليمية للطلاب</p>
              </div>
            </div>

            <div className="bg-white/90 backdrop-blur-2xl border border-white p-12 rounded-[3.5rem] shadow-2xl shadow-blue-900/5 space-y-10">
              <div className="space-y-4">
                <h2 className="text-3xl font-black text-slate-800">أهلاً بك في اختبارك!</h2>
                <p className="text-slate-500 font-medium leading-relaxed max-w-md mx-auto">أدخل بياناتك بالأسفل لتبدأ رحلتك التعليمية. سيتم إرسال نتيجتك فوراً إلى لوحة تحكم المعلم.</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-3 text-right">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-3">الاسم الثلاثي الكامل</label>
                  <div className="relative group">
                    <User className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-blue-600 transition-colors" />
                    <input 
                      type="text" 
                      placeholder="اكتب اسمك هنا..."
                      value={studentName}
                      onChange={(e) => setStudentName(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-50 rounded-3xl pr-16 pl-8 py-6 text-xl font-bold text-slate-900 focus:border-blue-600 focus:bg-white focus:ring-8 focus:ring-blue-100 transition-all outline-none"
                    />
                  </div>
                </div>
                <div className="space-y-3 text-right">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-3">بريد الطالب الإلكتروني</label>
                  <div className="relative group">
                    <Send className="absolute right-6 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5 group-focus-within:text-blue-600 transition-colors" />
                    <input 
                      type="email" 
                      placeholder="example@student.com"
                      value={studentEmail}
                      onChange={(e) => setStudentEmail(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-50 rounded-3xl pr-16 pl-8 py-6 text-xl font-bold text-slate-900 focus:border-blue-600 focus:bg-white focus:ring-8 focus:ring-blue-100 transition-all outline-none"
                    />
                  </div>
                </div>
                
                <button 
                  disabled={!studentName.trim() || studentName.trim().length < 3 || !studentEmail.trim() || !studentEmail.includes('@')}
                  onClick={() => setStudentQuizStarted(true)}
                  className="w-full bg-blue-600 text-white py-7 rounded-3xl font-black text-2xl shadow-2xl shadow-blue-600/40 hover:bg-blue-700 hover:scale-[1.02] transition-all active:scale-95 disabled:opacity-50 disabled:grayscale disabled:pointer-events-none flex items-center justify-center gap-4"
                >
                  ابدأ الاختبار الآن <ChevronRight className="w-8 h-8 rotate-180" />
                </button>
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 opacity-50">
               <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.5em] leading-none">AI EDU FUTURE</p>
               <div className="h-px bg-slate-200 w-32" />
            </div>
          </motion.div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 flex flex-col" dir="rtl">
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
              <GraduationCap className="text-white w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 leading-tight">إديوترانسفورم <span className="text-blue-600">للطلاب</span></h1>
              <p className="text-[10px] text-slate-400 font-bold uppercase">اختبار الطالب: {studentName}</p>
            </div>
          </div>
          <div className="flex flex-col items-end">
             <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full uppercase tracking-widest">مباشر الآن</span>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8">
          <div className="max-w-4xl mx-auto">
            <QuizView quiz={quiz} onReset={() => {}} isStudentMode={true} studentName={studentName} studentEmail={studentEmail} />
          </div>
        </main>
        
        <footer className="p-8 bg-white border-t border-slate-100">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-slate-400 text-xs font-bold">
            <p>© 2024 إديوترانسفورم AI - التعليم المستقبل</p>
            <div className="flex gap-6">
              <span>سياسة الخصوصية</span>
              <span>الدعم الفني</span>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  const openFullScreenApp = () => {
    const hostname = window.location.hostname;
    let shareBase = window.location.origin;
    if (hostname.includes('ais-dev-')) {
      shareBase = `https://${hostname.replace('ais-dev-', 'ais-pre-')}`;
    }
    window.open(shareBase, '_blank');
  };

  return (
    <div className="flex h-full font-sans antialiased bg-slate-50 overflow-hidden">
      {/* Sidebar - Professional Dashboard Look */}
      <aside className="w-72 bg-white border-r border-slate-200 hidden lg:flex flex-col shrink-0 shadow-2xl shadow-slate-200/50 relative z-40">
        <div className="p-8 border-b border-slate-50 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-2xl shadow-blue-600/40 transform -rotate-3 hover:rotate-0 transition-transform cursor-pointer">
              <GraduationCap className="text-white w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-black text-slate-900 tracking-tight">إديوترانسفورم <span className="text-blue-600">AI</span></h1>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mt-1">لوحة تحكم المعلم</p>
            </div>
          </div>
        </div>

          <nav className="flex-1 px-6 space-y-2">
            {/* Model Toggle */}
            <div className="bg-slate-50 p-2 rounded-2xl mb-4 border border-slate-100">
              <div className="flex p-1 gap-1">
                <button 
                  onClick={() => setProvider('gemini')}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2",
                    provider === 'gemini' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  Gemini Flash
                </button>
                <button 
                  onClick={() => setProvider('deepseek')}
                  className={cn(
                    "flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-2",
                    provider === 'deepseek' ? "bg-white text-blue-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                  )}
                >
                  DeepSeek R1
                </button>
              </div>
            </div>

          {/* Main Action: Go Full Screen (Independent Platform) */}
          <button 
            onClick={openFullScreenApp}
            className="w-full flex items-center justify-between gap-3 px-6 py-5 rounded-[2rem] bg-slate-900 text-white font-black hover:bg-black transition-all shadow-2xl shadow-slate-900/30 mb-10 group active:scale-95"
            dir="rtl"
          >
            <div className="p-2.5 bg-white/10 rounded-2xl group-hover:rotate-12 transition-transform">
              <ExternalLink className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-right">
              <span className="block text-sm">استخدام كمنصة كاملة</span>
              <span className="text-[10px] text-slate-500 font-bold">بوابة مستقلة للطلاب</span>
            </div>
          </button>
          {showInstallBtn && (
            <button 
              onClick={handleInstallClick}
              className="w-full flex items-center justify-end gap-3 px-4 py-3 rounded-xl bg-orange-50 text-orange-600 mb-4 border border-orange-100 hover:bg-orange-100 transition-all font-bold text-sm"
            >
              تحميل التطبيق على الجهاز
              <Sparkles className="w-5 h-5" />
            </button>
          )}
          <SidebarItem icon={<Layout className="w-5 h-5" />} label="لوحة التحكم" active={view === 'home'} onClick={() => setView('home')} />
          <SidebarItem icon={<BookOpen className="w-5 h-5" />} label="اختباراتي" active={view === 'history'} onClick={() => setView('history')} />
          <SidebarItem icon={<Sparkles className="w-5 h-5" />} label="تحليل ذكي" onClick={() => {}} />
          <SidebarItem icon={<Settings className="w-5 h-5" />} label="الإعدادات" onClick={() => {}} />
        </nav>

        <div className="p-4 border-t border-slate-100">
          {!user ? (
            <button 
              onClick={login}
              className="w-full bg-blue-600 text-white p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-all shadow-md shadow-blue-500/10"
            >
              <LogIn className="w-5 h-5" /> تسجيل الدخول
            </button>
          ) : (
            <div className="bg-slate-50 rounded-2xl p-4 flex items-center gap-3">
              {user.photoURL ? (
                <img src={user.photoURL} alt={user.displayName || ""} className="w-10 h-10 rounded-full border border-slate-200" />
              ) : (
                <div className="w-10 h-10 bg-white rounded-full border border-slate-200 flex items-center justify-center">
                  <User className="w-5 h-5 text-slate-400" />
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                <p className="text-sm font-bold text-slate-900 truncate">{user.displayName || 'مستخدم'}</p>
                <button 
                  onClick={logout}
                  className="text-xs text-red-500 font-bold flex items-center gap-1 hover:text-red-600 transition-colors"
                >
                  <LogOut className="w-3 h-3" /> خروج
                </button>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-slate-50 relative overflow-y-auto">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-10">
          <div dir="rtl">
            <h2 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
              {view === 'home' ? 'تحميل المحتوى' : view === 'quiz' ? 'الاختبار التفاعلي' : view === 'history' ? 'سجل الاختبارات' : 'إديوترانسفورم'}
            </h2>
          </div>
          <div className="flex items-center gap-4">
            {view === 'quiz' && quiz && (quiz as any).id && (
              <button 
                onClick={() => handleShare((quiz as any).id)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all",
                  copiedId === (quiz as any).id ? "bg-green-100 text-green-600" : "bg-blue-50 text-blue-600 hover:bg-blue-100"
                )}
              >
                {copiedId === (quiz as any).id ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                {copiedId === (quiz as any).id ? "تم النسخ" : "مشاركة الاختبار"}
              </button>
            )}
            {authLoading && <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />}
          </div>
        </header>

        <div className="flex-1 p-8">
          <AnimatePresence mode="wait">
            {isFetchingShared ? (
              <motion.div
                key="fetching-shared"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center justify-center p-20 min-h-[400px]"
              >
                <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-6" />
                <h3 className="text-2xl font-bold text-slate-900 mb-2">جاري تجهيز الاختبار...</h3>
                <p className="text-slate-500">يرجى الانتظار قليلاً بينما نقوم باستدعاء البيانات.</p>
              </motion.div>
            ) : view === 'home' && (
              <motion.div
                key="home"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="max-w-4xl mx-auto space-y-12"
              >
                <div className="text-center space-y-4" dir="rtl">
                  <span className="inline-block px-4 py-1.5 bg-blue-100 text-blue-600 rounded-full text-sm font-bold tracking-wide">مدعوم بالذكاء الاصطناعي</span>
                  <h2 className="text-4xl lg:text-5xl font-extrabold text-slate-900 tracking-tight">حوّل دروسك إلى تجربة ذكية</h2>
                  <p className="text-lg text-slate-500 max-w-2xl mx-auto">
                    ارفع ملفات PDF الخاصة بك، وسيقوم نظامنا بتحليلها فوراً لإنشاء اختبارات تقييمية مخصصة تساعدك على تثبيت المعلومة.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto" dir="rtl">
                  <StatCard icon={<Clock className="text-orange-500" />} title="ثواني" desc="لإنشاء الاختبار" />
                  <StatCard icon={<BookOpen className="text-green-500" />} title="+100" desc="نوع محتوى مدعوم" />
                  <StatCard icon={<Sparkles className="text-blue-500" />} title="99%" desc="دقة تحليل Gemini" />
                </div>

                <FileUploader onUpload={handleUpload} isLoading={isLoading} />

                <div className="mt-12 pt-8 border-t border-slate-200">
                  <div className="flex flex-col items-center gap-6">
                    <div className="text-center">
                      <p className="text-slate-900 font-bold mb-1">هل أنت طالب؟</p>
                      <p className="text-slate-400 text-sm">أدخل كود الاختبار الذي أرسله لك المعلم</p>
                    </div>
                    <div className="flex gap-2 w-full max-w-md">
                       <button 
                         onClick={() => {
                           const code = prompt("أدخل كود الاختبار (عدة حروف وأرقام):");
                           if (code && code.trim()) loadSharedQuiz(code.trim());
                         }}
                         className="flex-1 px-8 py-4 bg-white border-2 border-slate-200 text-slate-700 rounded-2xl font-black hover:border-blue-500 hover:text-blue-600 transition-all shadow-sm flex items-center justify-center gap-3"
                       >
                         <Copy className="w-5 h-5" /> أدخل الكود يدوياً
                       </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            {view === 'quiz' && quiz && (
              <motion.div
                key="quiz"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
              >
                {isLoading ? (
                  <div className="flex flex-col items-center justify-center p-20">
                     <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                     <p className="text-slate-500 font-bold">جاري تحميل الاختبار...</p>
                  </div>
                ) : (
                  <QuizView quiz={quiz} onReset={resetQuiz} />
                )}
              </motion.div>
            )}

            {view === 'history' && (
              <motion.div
                key="history"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="max-w-5xl mx-auto"
                dir="rtl"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-extrabold text-slate-900 mb-2">منصة إدارة الاختبارات</h2>
                    <p className="text-slate-500">إدارة شاملة لاختباراتك، مشاركتها مع الطلاب ومتابعة الأداء.</p>
                  </div>
                  <div className="flex gap-3">
                    <div className="bg-white px-4 py-2 rounded-2xl border border-slate-100 shadow-sm text-center">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">إجمالي الاختبارات</p>
                      <p className="text-xl font-black text-blue-600">{userQuizzes.length}</p>
                    </div>
                  </div>
                </div>

                {!user ? (
                  <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6">
                      <LogIn className="w-8 h-8 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">سجل الدخول لحفظ اختباراتك</h3>
                    <p className="text-slate-500 mb-8">تسجيل الدخول يتيح لك الوصول إلى اختباراتك من أي مكان وفي أي وقت.</p>
                    <button onClick={login} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">تسجيل الدخول عبر جوجل</button>
                  </div>
                ) : userQuizzes.length === 0 ? (
                  <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
                    <p className="text-slate-400 font-medium">لا توجد اختبارات محفوظة بعد. ابدأ برفع أول ملف PDF!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {userQuizzes.map((q) => (
                      <div key={q.id} className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm hover:border-blue-200 transition-all group relative">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex gap-2">
                             <button 
                              onClick={() => handleDeleteQuiz(q.id)}
                              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="حذف"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                             <button 
                              onClick={() => handleShare(q.id)}
                              className={cn(
                                "p-2 rounded-lg transition-all",
                                copiedId === q.id ? "bg-green-100 text-green-600" : "text-slate-300 hover:text-blue-500 hover:bg-blue-50"
                              )}
                              title="مشاركة الرابط"
                            >
                              {copiedId === q.id ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                            </button>
                            <button 
                              onClick={() => viewStats(q.id)}
                              className="p-2 text-slate-300 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition-colors"
                              title="عرض النتائج"
                            >
                              <Layout className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-600">
                            <BookOpen className="w-5 h-5" />
                          </div>
                        </div>
                        <h4 className="font-bold text-slate-900 mb-1 line-clamp-1">{q.title}</h4>
                        <div className="flex items-center gap-4 mb-6">
                          <p className="text-xs text-slate-400 font-medium leading-none flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {new Date((q as any).createdAt?.seconds * 1000).toLocaleDateString('ar-EG')}
                          </p>
                          <p className="text-xs text-slate-400 font-medium leading-none flex items-center gap-1">
                            <Sparkles className="w-3 h-3" /> {q.questions.length} سؤال
                          </p>
                        </div>
                        
                        <div className="flex gap-2">
                          <button 
                            onClick={() => { setQuiz(q); setView('quiz'); }}
                            className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-sm hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                          >
                            مراجعة الاختبار <ChevronRight className="w-4 h-4 rotate-180" />
                          </button>
                          <button 
                             onClick={() => viewStats(q.id)}
                             className="px-4 py-3 bg-slate-50 text-slate-600 rounded-xl font-bold text-sm hover:bg-slate-100 transition-all border border-slate-100"
                             title="عرض النتائج"
                          >
                            النتائج
                          </button>
                          <button 
                             onClick={() => {
                               const shareBase = window.location.hostname.includes('ais-dev-') 
                                 ? `https://${window.location.hostname.replace('ais-dev-', 'ais-pre-')}`
                                 : window.location.origin;
                               window.open(`${shareBase}/?quizId=${q.id}`, '_blank');
                             }}
                             className="px-4 py-3 bg-slate-50 text-blue-600 rounded-xl font-bold text-sm hover:bg-blue-50 transition-all border border-blue-100"
                             title="معاينة كطالب"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {view === 'submissions' && (
              <motion.div
                key="submissions"
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.02 }}
                className="max-w-4xl mx-auto"
                dir="rtl"
              >
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-3xl font-extrabold text-slate-900 mb-2">نتائج الطلاب</h2>
                    <p className="text-slate-500">متابعة دقيقة لأداء الطلاب في الاختبار.</p>
                  </div>
                  <button 
                    onClick={() => setView('history')}
                    className="flex items-center gap-2 text-blue-600 font-bold hover:bg-blue-50 px-4 py-2 rounded-xl transition-all"
                  >
                    العودة للقائمة <ChevronRight className="w-4 h-4" />
                  </button>
                </div>

                {isLoading ? (
                  <div className="flex flex-col items-center justify-center p-20 bg-white rounded-3xl border border-slate-100">
                    <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-slate-500">جاري جلب النتائج...</p>
                  </div>
                ) : submissions.length === 0 ? (
                  <div className="bg-white rounded-3xl p-16 text-center border border-slate-100 shadow-sm">
                    <p className="text-slate-400 font-bold text-lg">لا توجد تسليمات بعد لهذا الاختبار.</p>
                    <p className="text-slate-400 text-sm mt-2">شارك الرابط مع طلابك لبدء استلام النتائج.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                    <table className="w-full text-right">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-100 font-bold text-slate-600 text-sm">
                          <th className="px-6 py-4">اسم الطالب</th>
                          <th className="px-6 py-4">البريد الإلكتروني</th>
                          <th className="px-6 py-4">الدرجة</th>
                          <th className="px-6 py-4">النسبة</th>
                          <th className="px-6 py-4">التوقيت</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {submissions.map((s) => (
                           <tr key={s.id} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4 font-bold text-slate-900">{s.studentName}</td>
                              <td className="px-6 py-4 text-xs text-slate-500 font-medium">{s.studentEmail}</td>
                              <td className="px-6 py-4 font-bold text-blue-600">{s.score} / {s.totalQuestions}</td>
                              <td className="px-6 py-4">
                                <span className={cn(
                                  "px-3 py-1 rounded-full text-xs font-black",
                                  (s.score / s.totalQuestions) >= 0.5 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                                )}>
                                  {Math.round((s.score / s.totalQuestions) * 100)}%
                                </span>
                              </td>
                              <td className="px-6 py-4 text-xs text-slate-400 font-medium">
                                {s.completedAt?.toDate().toLocaleString('ar-EG')}
                              </td>
                           </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 -z-10" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2 -z-10" />
      </main>

      {/* Custom Share Modal */}
      <AnimatePresence>
        {shareModalData && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl"
              dir="rtl"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-blue-600" /> مشاركة الاختبار مع الطلاب
                </h3>
                <button onClick={() => setShareModalData(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Visual success indicator */}
                <div className="bg-green-50 border border-green-100 rounded-2xl p-4 flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <Check className="w-5 h-5 text-white" />
                  </div>
                  <p className="text-sm font-bold text-green-700">تم نسخ الرابط تلقائياً!</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-1">رابط الطلاب المباشر</label>
                  <div className="flex gap-2">
                    <input 
                      type="text" 
                      readOnly 
                      value={shareModalData.url} 
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 focus:outline-none"
                    />
                    <button 
                      onClick={() => {
                        try {
                          navigator.clipboard.writeText(shareModalData.url);
                          setCopiedId(shareModalData.id);
                          alert("تم نسخ الرابط!");
                        } catch (err) {
                          const el = document.createElement('textarea');
                          el.value = shareModalData.url;
                          document.body.appendChild(el);
                          el.select();
                          document.execCommand('copy');
                          document.body.removeChild(el);
                          alert("تم نسخ الرابط!");
                        }
                      }}
                      className="bg-blue-600 text-white p-3 rounded-xl hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
                    >
                      <Copy className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 border border-dashed border-slate-200">
                  <p className="text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">كود الاختبار (للدخول اليدوي)</p>
                  <div className="flex items-center justify-between">
                    <code className="text-2xl font-black text-blue-600 tracking-wider">{shareModalData.id}</code>
                    <button 
                      onClick={() => navigator.clipboard.writeText(shareModalData.id)}
                      className="text-blue-600 text-xs font-bold hover:underline"
                    >
                      نسخ الكود
                    </button>
                  </div>
                </div>

                  <button 
                    onClick={() => {
                      // Use a cleaner URL for the manual button in case of permission issues
                      const studentUrl = shareModalData.url;
                      window.open(studentUrl, '_blank');
                    }}
                    className="flex items-center justify-center gap-3 bg-blue-600 text-white py-4 rounded-2xl font-black text-xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/30 active:scale-95"
                  >
                    دخول منصة الطالب الآن <ExternalLink className="w-6 h-6" />
                  </button>

                <div className="grid grid-cols-2 gap-3">
                  <a 
                    href={`https://wa.me/?text=${encodeURIComponent('بانتظارك اختبار جديد، اضغط للدخول والبدء مباشرة: ' + shareModalData.url)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-center gap-2 bg-[#25D366] text-white py-3 rounded-xl font-bold hover:opacity-90 transition-opacity"
                  >
                    واتساب <Send className="w-4 h-4" />
                  </a>
                  <button 
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: 'اختبار إديوترانسفورم AI',
                          text: 'بانتظارك اختبار جديد، اضغط للدخول والبدء!',
                          url: shareModalData.url,
                        });
                      } else {
                        navigator.clipboard.writeText(shareModalData.url);
                        alert("تم نسخ الرابط بنجاح!");
                      }
                    }}
                    className="flex items-center justify-center gap-2 bg-slate-900 text-white py-3 rounded-xl font-bold hover:bg-slate-800 transition-colors"
                  >
                    رابط آخر <Share2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 italic text-xs text-slate-400 leading-relaxed">
                ملاحظة: هذا الرابط مخصص للطلاب، سيطلب منهم كتابة أسمائهم فقط والبدء بالاختبار دون الحاجة لتسجيل دخول.
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }: { icon: ReactNode, label: string, active?: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-end gap-3 px-4 py-3 rounded-xl transition-all duration-200 group text-right",
        active ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      <span className={cn("text-sm font-bold", active ? "text-blue-600" : "text-slate-600")}>{label}</span>
      <div className={cn("transition-colors", active ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600")}>
        {icon}
      </div>
    </button>
  );
}

function StatCard({ icon, title, desc }: { icon: ReactNode, title: string, desc: string }) {
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-4">
      <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div>
        <p className="text-xl font-black text-slate-900 leading-none">{title}</p>
        <p className="text-xs text-slate-400 font-bold uppercase tracking-wider border-t border-slate-100 mt-2 pt-1">{desc}</p>
      </div>
    </div>
  );
}
