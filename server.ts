import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { OpenAI } from "openai";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Generic Quiz Generation Logic
  const generatePrompt = (text: string, count: number) => `أنت خبير تعليمي. قم بإنشاء اختبار أكاديمي عالي الجودة يتكون من ${count} أسئلة اختيار من متعدد بناءً على النص التالي.
      يجب أن يكون الاختبار باللغة العربية الفصحى.
      كل سؤال يجب أن يحتوي على 4 خيارات بالضبط.
      يجب أن تكون الإجابات دقيقة ومنطقية.
      ارجع النتيجة بصيغة JSON فقط بالهيكل التالي:
      {
        "title": "عنوان الاختبار",
        "questions": [
          {
            "question": "السؤال؟",
            "options": ["خيار 1", "خيار 2", "خيار 3", "خيار 4"],
            "correctAnswer": 0,
            "explanation": "شرح الإجابة"
          }
        ]
      }
      
      النص: ${text.substring(0, 20000)}`;

  // API Route for DeepSeek/OpenAI Quiz Generation
  app.post("/api/generate-quiz", async (req, res) => {
    const { text, count = 10, provider = 'openai' } = req.body;
    
    try {
      if (provider === 'openai') {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: "You are a helpful educational assistant that outputs JSON." },
            { role: "user", content: generatePrompt(text, count) }
          ],
          response_format: { type: "json_object" }
        });

        const quizData = JSON.parse(completion.choices[0].message.content || "{}");
        return res.json(quizData);
      }

      if (provider === 'deepseek') {
        const apiKey = process.env.DEEPSEEK_API_KEY;
        if (!apiKey) throw new Error("DEEPSEEK_API_KEY is not configured");

        const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model: "deepseek-reasoner",
            messages: [
              { role: "system", content: "You are a helpful educational assistant that outputs JSON." },
              { role: "user", content: generatePrompt(text, count) }
            ],
            response_format: { type: "json_object" }
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || "Failed to call DeepSeek API");
        }

        const data = await response.json();
        const quizContent = data.choices[0].message.content;
        const quizData = typeof quizContent === 'string' ? JSON.parse(quizContent) : quizContent;
        return res.json(quizData);
      }

      res.status(400).json({ error: "Invalid provider" });
    } catch (error: any) {
      console.error("AI Generation Error:", error);
      res.status(500).json({ error: error.message || "Failed to generate quiz" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
