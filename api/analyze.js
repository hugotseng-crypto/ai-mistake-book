import { GoogleGenerativeAI } from '@google/generative-ai';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { fileBase64, mimeType } = req.body;
    if (!fileBase64) return res.status(400).json({ error: '找不到檔案' });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.6-flash' });
    const base64Data = fileBase64.replace(/^data:(.*?);base64,/, '');

    const prompt = `你是老師。圖片裡主要是「一題」錯題或不會的題。
請辨識題目、給出解答與解析、並標記知識點。
只回傳 JSON 陣列，不要其他文字：
[
  {
    "id": "題號",
    "content": "題目原文",
    "solution": "解答與解析",
    "tags": ["知識點"]
  }
]
`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: mimeType || 'image/jpeg' } }
    ]);
    const responseText = result.response.text();
    const match = responseText.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('AI 未回傳有效 JSON');
    res.status(200).json({ data: JSON.parse(match[0]) });
  } catch (error) {
    console.error('Gemini API Error:', error);
    const raw = error && error.message ? String(error.message) : '未知錯誤';
    const shortMsg = raw.includes('404') ? '模型不可用，請稍後再試' : raw.slice(0, 120);
    res.status(500).json({ error: '分析失敗：' + shortMsg });
  }
}
