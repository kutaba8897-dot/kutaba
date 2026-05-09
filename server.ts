import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Route for DeepSeek Quiz Generation
  app.post("/api/generate-quiz", async (req, res) => {
    const { text, count = 10 } = req.body;
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "DEEPSEEK_API_KEY is not configured" });
    }

    try {
      const prompt = `أنت خبير تعليمي. قم بإنشاء اختبار أكاديمي عالي الجودة يتكون من ${count} أسئلة اختيار من متعدد بناءً على النص التالي.
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

      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "deepseek-reasoner", // This maps to R1
          messages: [
            { role: "system", content: "You are a helpful educational assistant that outputs JSON." },
            { role: "user", content: prompt }
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
      
      // Attempt to parse JSON if it's returned as a string in content
      const quizData = typeof quizContent === 'string' ? JSON.parse(quizContent) : quizContent;
      
      res.json(quizData);
    } catch (error: any) {
      console.error("DeepSeek Error:", error);
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
