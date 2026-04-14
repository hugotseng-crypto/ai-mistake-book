import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    // 接收前端傳來的檔案資料與格式
    const { fileBase64, mimeType } = req.body;
    if (!fileBase64) return res.status(400).json({ error: '找不到檔案' });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // 【關鍵修改】：切換回免費額度最高（每分鐘15次）的 gemini-1.5-flash 模型
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    // 去除 Base64 標頭
    const base64Data = fileBase64.replace(/^data:(.*?);base64,/, "");

    const prompt = `
      你是一位專業的各科教師。請仔細閱讀這份考卷或講義內容。
      請辨識出文件中的「每一道獨立的題目」，並針對每題進行分析。
      
      請務必嚴格使用以下 JSON 陣列格式回傳，不要包含任何其他說明文字：
      [
        {
          "id": "題號 (例如: 第1題)",
          "content": "完整的題目文字內容",
          "solution": "詳細的解題步驟與正確答案",
          "tags": ["知識點1", "知識點2"]
        }
      ]
    `;

    // 動態設定 mimeType (圖片或 PDF)
    const fileParts = [{
      inlineData: { data: base64Data, mimeType: mimeType || "image/jpeg" }
    }];

    const result = await model.generateContent([prompt, ...fileParts]);
    const responseText = result.response.text();
    
    // 強化版 JSON 提取邏輯
    const match = responseText.match(/\[[\s\S]*\]/);
    if (!match) {
        throw new Error("AI 未回傳有效的 JSON 陣列格式");
    }
    
    const cleanJsonString = match[0];
    res.status(200).json({ data: JSON.parse(cleanJsonString) });

  } catch (error) {
    console.error("Gemini API Error:", error);
    res.status(500).json({ error: '分析失敗: ' + (error.message || '未知錯誤') });
  }
}
