import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface QuizQuestion {
  question: string;
  options: string[];
  correctAnswer: number; // Index of the correct option
  explanation: string;
}

export interface Quiz {
  title: string;
  questions: QuizQuestion[];
}

export async function generateQuizFromText(text: string, count: number = 10, provider: 'gemini' | 'deepseek' | 'openai' = 'gemini'): Promise<Quiz> {
  if (provider === 'deepseek' || provider === 'openai') {
    try {
      const response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, count, provider })
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `فشل طلب ${provider}`);
      }
      return await response.json();
    } catch (err: any) {
      console.error(`${provider} Client Error:`, err);
      throw new Error(`عذراً، فشل استخدام ${provider}. تأكد من إعداد مفتاح API الخاص بك.`);
    }
  }

  const prompt = `أنت خبير تعليمي. قم بإنشاء اختبار أكاديمي عالي الجودة يتكون من ${count} أسئلة اختيار من متعدد بناءً على النص التالي.
  يجب أن يكون الاختبار باللغة العربية الفصحى.
  كل سؤال يجب أن يحتوي على 4 خيارات بالضبط.
  يجب أن تكون الإجابات دقيقة ومنطقية.
  ارجع النتيجة بصيغة JSON فقط.
  
  النص: ${text.substring(0, 20000)}
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            questions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  question: { type: Type.STRING },
                  options: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    minItems: 4,
                    maxItems: 4,
                  },
                  correctAnswer: { type: Type.INTEGER, description: "Index of correct option (0-3)" },
                  explanation: { type: Type.STRING }
                },
                required: ["question", "options", "correctAnswer", "explanation"]
              }
            }
          },
          required: ["title", "questions"]
        }
      }
    });

    const quizText = response.text;
    if (!quizText) {
      throw new Error("لم يتم تلقي استجابة من الذكاء الاصطناعي.");
    }

    const quizData = JSON.parse(quizText);
    return quizData as Quiz;
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    if (error.message?.includes("safety")) {
      throw new Error("عذراً، محتوى الملف قد تم حظره بواسطة مرشحات الأمان. يرجى محاولة ملف آخر.");
    }
    throw new Error("فشل توليد الاختبار. يرجى المحاولة مرة أخرى لاحقاً.");
  }
}
