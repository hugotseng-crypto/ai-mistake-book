import { GoogleGenerativeAI } from '@google/generative-ai';

function stripLatex(text) {
  if (!text) return '';
  return String(text)
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/\$([^$]+)\$/g, '$1')
    .replace(/\\triangle\s*/g, '△')
    .replace(/\\perp\s*/g, '⟂')
    .replace(/\\angle\s*/g, '∠')
    .replace(/\\circ\s*/g, '°')
    .replace(/\\degree\s*/g, '°')
    .replace(/\\times\s*/g, '×')
    .replace(/\\div\s*/g, '÷')
    .replace(/\\cdot\s*/g, '·')
    .replace(/\\leq\s*/g, '≤')
    .replace(/\\geq\s*/g, '≥')
    .replace(/\\neq\s*/g, '≠')
    .replace(/\\approx\s*/g, '≈')
    .replace(/\\infty\s*/g, '∞')
    .replace(/\\pm\s*/g, '±')
    .replace(/\\overline\{([^}]+)\}/g, '$1')
    .replace(/\\vec\{([^}]+)\}/g, '$1')
    .replace(/\\hat\{([^}]+)\}/g, '$1')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1)/($2)')
    .replace(/\\sqrt\{([^}]+)\}/g, '√($1)')
    .replace(/\\sqrt\s*/g, '√')
    .replace(/\\left\s*/g, '')
    .replace(/\\right\s*/g, '')
    .replace(/\\text\{([^}]+)\}/g, '$1')
    .replace(/\\mathrm\{([^}]+)\}/g, '$1')
    .replace(/\\,/g, ' ')
    .replace(/\\\\/g, '\n')
    .replace(/[{}]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanItem(item) {
  if (!item || typeof item !== 'object') return item;
  return {
    ...item,
    content: stripLatex(item.content || ''),
    solution: stripLatex(item.solution || ''),
    tags: Array.isArray(item.tags) ? item.tags.map((t) => stripLatex(String(t))) : []
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { fileBase64, mimeType, subject, myAnswer, note } = req.body || {};
    if (!fileBase64) return res.status(400).json({ error: '找不到檔案' });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.6-flash',
      generationConfig: { responseMimeType: 'application/json' }
    });
    const base64Data = fileBase64.replace(/^data:(.*?);base64,/, '');

    const extra = [
      subject ? `科目：${subject}` : '',
      myAnswer ? `學生當時的答案或狀況：${myAnswer}` : '',
      note ? `學生備註：${note}` : ''
    ].filter(Boolean).join('\n');

    const prompt = `你是台灣國高中老師，正在幫學生整理「一題」錯題。
圖片裡主要是單一題目（可能含圖形）。請完整辨識題目並講解。

寫作規定（一定要遵守）：
- 使用繁體中文。
- 不要使用 LaTeX、不要使用 $、$$、\\triangle、\\perp、\\overline 這類指令。
- 數學符號請直接寫成人看懂的字：△、⟂、∠、°、√、×、÷、≤、≥、≠、π，線段直接寫 AB、DE。
- content 必須是完整題目，包含最後的空格或「＝____」，不可寫到一半就停。
- solution 開頭第一行必須是「答案：…」，接著空一行再寫步驟解析。解析要短、針對這題。
- 若學生有寫自己的答案，指出可能錯在哪。
- tags 用短知識點，例如「正三角形」「面積」「垂線」。
- 只回傳 JSON，不要其他文字。

${extra ? `補充資訊：\n${extra}\n` : ''}
JSON 格式：
[
  {
    "id": "題號或重點編號，沒有就寫 1",
    "content": "完整題目原文（人看懂的符號）",
    "solution": "答案：…\\n\\n解析步驟",
    "tags": ["知識點"]
  }
]
`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: mimeType || 'image/jpeg' } }
    ]);
    const responseText = result.response.text();
    const match = responseText.match(/\[[\s\S]*\]/) || responseText.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('AI 未回傳有效 JSON');
    const parsed = JSON.parse(match[0]);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    res.status(200).json({ data: list.map(cleanItem) });
  } catch (error) {
    console.error('Gemini API Error:', error);
    const raw = error && error.message ? String(error.message) : '未知錯誤';
    const shortMsg = raw.includes('404') ? '模型不可用，請稍後再試' : raw.slice(0, 120);
    res.status(500).json({ error: '分析失敗：' + shortMsg });
  }
}
