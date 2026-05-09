import * as pdfjs from 'pdfjs-dist';

// Use standard Vite worker loading technique
// @ts-ignore
import pdfWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

export async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(arrayBuffer),
    useWorkerFetch: false,
    disableRange: true,
    disableAutoFetch: true,
  });

  try {
    // Add a race condition for the promise to handle stuck loading
    const pdf = await Promise.race([
      loadingTask.promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error("استغرق تحميل ملف PDF وقتاً طويلاً جداً.")), 60000))
    ]) as any;

    let fullText = '';
    const numPages = Math.min(pdf.numPages, 30);

    for (let i = 1; i <= numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => (item as any).str)
          .join(' ');
        fullText += pageText + ' ';
      } catch (pageError) {
        console.warn(`Error reading page ${i}:`, pageError);
      }
    }

    if (!fullText.trim()) {
      throw new Error("لم يتم العثور على نص قابل للقراءة في ملف PDF. قد يكون الملف عبارة عن صور (Scanned).");
    }

    return fullText.trim();
  } catch (error: any) {
    console.error("Detailed PDF Extraction Error:", error);
    // Cleanup if possible
    try { loadingTask.destroy(); } catch (e) {}
    
    throw new Error(error instanceof Error ? error.message : "فشل استخراج النص من ملف PDF.");
  }
}
