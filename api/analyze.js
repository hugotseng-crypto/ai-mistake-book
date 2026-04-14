import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  // 只允許 POST 請求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) return res.status(400).json({ error: '找不到圖片' });

    // 初始化 Gemini API (使用 Vercel 環境變數中的金鑰)
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    // 使用 Gemini 1.5 Flash (速度最快，支援視覺辨識)
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 去除前端傳來的 Base64 標頭
    const base64Data = imageBase64.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");

    // 強制 AI 輸出 JSON 的 Prompt
    const prompt = `
      你是一位專業的各科教師。請仔細閱讀這張考卷或講義的圖片。
      請辨識出圖中的「每一道獨立的題目」，並針對每題進行分析。
      
      請務必嚴格使用以下 JSON 陣列格式回傳，不要包含其他說明文字，也不要包含 \`\`\`json 標記：
      [
        {
          "id": "題號 (例如: 第1題)",
          "content": "完整的題目文字內容",
          "solution": "詳細的解題步驟與正確答案",
          "tags": ["知識點1", "知識點2"]
        }
      ]
    `;

    const imageParts = [{
      inlineData: { data: base64Data, mimeType: "image/jpeg" }
    }];

    // 呼叫 Gemini
    const result = await model.generateContent([prompt, ...imageParts]);
    const responseText = result.response.text();
    
    // 清理可能殘留的 Markdown 標記，確保能被 JSON.parse 解析
    const cleanJsonString = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // 將結果回傳給前端
    res.status(200).json({ data: JSON.parse(cleanJsonString) });

  } catch (error) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: 'AI 分析失敗，請確認圖片清晰度或稍後再試。' });
  }
}