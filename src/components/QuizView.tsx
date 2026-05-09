import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, XCircle, ArrowRight, RefreshCw, Trophy, User, ShieldAlert, ChevronLeft } from 'lucide-react';
import { Quiz } from '../services/quizService';
import { submitQuizResult, checkExistingSubmission } from '../services/firestoreService';
import { useAuth } from './FirebaseProvider';
import { cn } from '../lib/utils';

interface QuizViewProps {
  quiz: Quiz;
  onReset: () => void;
  isStudentMode?: boolean;
  studentName?: string;
  studentEmail?: string;
}

export default function QuizView({ quiz, onReset, isStudentMode = false, studentName, studentEmail }: QuizViewProps) {
  const { user, login } = useAuth();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  const currentQuestion = quiz.questions[currentQuestionIndex];

  useEffect(() => {
    if (user && (quiz as any).id) {
       checkSubmission();
    } else {
      setIsLoading(false);
    }
  }, [user, quiz]);

  const checkSubmission = async () => {
    setIsLoading(true);
    const existing = await checkExistingSubmission((quiz as any).id);
    if (existing) {
      setAlreadySubmitted(existing);
    }
    setIsLoading(false);
  };

  const handleOptionSelect = (index: number) => {
    if (showResult) return;
    setSelectedOption(index);
    setShowResult(true);
    if (index === currentQuestion.correctAnswer) {
      setScore(s => s + 1);
    }
  };

  const handleNext = async () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOption(null);
      setShowResult(false);
    } else {
      setIsFinished(true);
      // Automatically save result if it's a shared quiz
      if ((quiz as any).id && user) {
        setIsSubmitting(true);
        try {
          await submitQuizResult({
            quizId: (quiz as any).id,
            studentName: studentName || user.displayName || 'طالب مجهول',
            studentEmail: studentEmail || user.email || 'no-email@student.com',
            score: score,
            totalQuestions: quiz.questions.length
          });
        } catch (err) {
          console.error("Failed to submit result:", err);
        } finally {
          setIsSubmitting(false);
        }
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 min-h-[400px]">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-500 font-bold">جاري التحقق من حالة الاختبار...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-md mx-auto bg-white p-12 rounded-3xl text-center border border-slate-100 shadow-xl shadow-blue-500/5" dir="rtl">
        <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto mb-8">
          <ShieldAlert className="w-10 h-10 text-blue-600" />
        </div>
        <h3 className="text-2xl font-bold text-slate-900 mb-4">الدخول مقيد للطلاب فقط</h3>
        <p className="text-slate-500 mb-8">يجب عليك تسجيل الدخول بحسابك لضمان نزاهة الاختبار وتسجيل نتيجتك رسمياً.</p>
        <button onClick={login} className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20">
          <User className="w-5 h-5" /> تسجيل الدخول للبدء
        </button>
        <button onClick={onReset} className="w-full mt-4 text-slate-400 font-medium hover:text-slate-600 transition-colors">إلغاء</button>
      </div>
    );
  }

  if (alreadySubmitted) {
    return (
      <div className="max-w-md mx-auto bg-white p-12 rounded-3xl text-center border border-slate-100 shadow-xl shadow-blue-500/5" dir="rtl">
        <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-8">
          <CheckCircle2 className="w-10 h-10 text-green-600" />
        </div>
        <h3 className="text-2xl font-bold text-slate-900 mb-4">لقد أجبت على هذا الاختبار مسبقاً!</h3>
        <p className="text-slate-500 mb-8">لا يسمح النظام بإعادة المحاولة لضمان عدالة التقييم لجميع الطلاب.</p>
        <div className="bg-slate-50 p-6 rounded-2xl mb-8">
          <p className="text-sm text-slate-500 mb-1">نتيجتك السابقة</p>
          <p className="text-3xl font-black text-slate-900">{alreadySubmitted.score} / {alreadySubmitted.totalQuestions}</p>
        </div>
        <button onClick={onReset} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-all">العودة للرئيسية</button>
      </div>
    );
  }

  if (isFinished) {
    const percentage = Math.round((score / quiz.questions.length) * 100);
    return (
      <div className="w-full max-w-2xl mx-auto p-6" dir="rtl" id="quiz-results">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-12 text-center shadow-xl shadow-blue-500/5"
        >
          <div className="w-24 h-24 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-8">
            <Trophy className="w-12 h-12 text-blue-600" />
          </div>
          <h2 className="text-3xl font-extrabold text-slate-900 mb-2">أحسنت يا {studentName || 'بطل'}!</h2>
          <p className="text-slate-500 mb-8">لقد تم حفظ نتيجتك بنجاح وإرسالها للمعلم.</p>
          
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div className="bg-slate-50 rounded-2xl p-6">
              <p className="text-sm text-slate-500 mb-1">النتيجة</p>
              <p className="text-3xl font-bold text-slate-900">{score} / {quiz.questions.length}</p>
            </div>
            <div className="bg-slate-50 rounded-2xl p-6">
              <p className="text-sm text-slate-500 mb-1">النسبة</p>
              <p className="text-3xl font-bold text-slate-900">{percentage}%</p>
            </div>
          </div>

          <button
            onClick={onReset}
            className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 group"
            id="restart-quiz-btn"
          >
            إغلاق الاختبار
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-6" dir="rtl" id="quiz-container">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <span className="text-sm font-bold text-blue-600 uppercase tracking-wider mb-1 block">السؤال {currentQuestionIndex + 1} من {quiz.questions.length}</span>
          <h2 className="text-xl font-bold text-slate-900 truncate max-w-[250px]">{quiz.title}</h2>
        </div>
        <div className="text-left">
           <p className="text-xs font-bold text-slate-400 mb-1">الممتحن: {studentName}</p>
           <div className="h-2 w-32 bg-slate-100 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-blue-500" 
              initial={{ width: 0 }}
              animate={{ width: `${((currentQuestionIndex + 1) / quiz.questions.length) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuestionIndex}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          className="space-y-6"
        >
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100">
            <h3 className="text-2xl font-bold text-slate-900 leading-tight mb-8">
              {currentQuestion.question}
            </h3>

            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedOption === index;
                const isCorrect = index === currentQuestion.correctAnswer;
                const isWrong = isSelected && !isCorrect;

                return (
                  <button
                    key={index}
                    onClick={() => handleOptionSelect(index)}
                    disabled={showResult}
                    className={cn(
                      "w-full p-5 rounded-2xl border-2 text-right transition-all flex items-center justify-between group",
                      !showResult && "border-slate-100 hover:border-blue-200 hover:bg-blue-50/50",
                      showResult && isCorrect && "border-green-500 bg-green-50 text-green-700",
                      showResult && isWrong && "border-red-500 bg-red-50 text-red-700 font-medium",
                      showResult && !isCorrect && !isWrong && "border-slate-100 opacity-50"
                    )}
                    id={`option-${index}`}
                  >
                    <span className="text-lg">{option}</span>
                    {showResult && isCorrect && <CheckCircle2 className="w-6 h-6 text-green-500 shrink-0" />}
                    {showResult && isWrong && <XCircle className="w-6 h-6 text-red-500 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {showResult && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "p-6 rounded-2xl",
                selectedOption === currentQuestion.correctAnswer ? "bg-green-50 text-green-800" : "bg-blue-50 text-blue-800"
              )}
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "p-2 rounded-xl shrink-0",
                  selectedOption === currentQuestion.correctAnswer ? "bg-green-100" : "bg-blue-100"
                )}>
                  {selectedOption === currentQuestion.correctAnswer ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <ArrowRight className="w-5 h-5 text-blue-600" />}
                </div>
                <div>
                  <p className="font-bold mb-1">
                    {selectedOption === currentQuestion.correctAnswer ? "أحسنت! إجابة صحيحة" : "توضيح الإجابة الصحيحة:"}
                  </p>
                  <p className="text-sm opacity-90 leading-relaxed">
                    {currentQuestion.explanation}
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {showResult && (
            <button
              onClick={handleNext}
              disabled={isSubmitting}
              className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 group shadow-lg shadow-slate-900/10"
              id="next-question-btn"
            >
               {isSubmitting ? 'جاري حفظ نتيجتك...' : (currentQuestionIndex === quiz.questions.length - 1 ? 'عرض النتيجة النهائية' : 'السؤال التالي')}
              <ArrowRight className="w-5 h-5 rotate-180" />
            </button>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
