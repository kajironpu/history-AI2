export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { keyword } = req.body;
  if (!keyword) {
    return res.status(400).json({ error: "keyword is required" });
  }

  const prompt = `
中学生向けの歴史クイズを作ってください。
正解は「${keyword}」です。
絶対にJSON形式のみで返してください。余計な文章や説明、マークダウン(\`\`\`)は不要です。

出力フォーマット:
{
  "question": "問題文",
  "answerOptions": [
    {"text":"選択肢1","isCorrect":false,"rationale":"理由"},
    {"text":"選択肢2","isCorrect":true,"rationale":"理由"},
    {"text":"選択肢3","isCorrect":false,"rationale":"理由"}
  ],
  "keyword_explanation": "キーワードの解説"
}
`;

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": process.env.GEN_API_KEY,
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        }),
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      return res.status(500).json({ error: "No text response from Gemini", raw: data });
    }

    // マークダウン除去
    const cleaned = text.replace(/```json|```/g, "").trim();

    let quiz;
    try {
      quiz = JSON.parse(cleaned);
    } catch (e) {
      return res.status(500).json({ error: "Invalid JSON from Gemini", raw: cleaned });
    }

    // バリデーション（最低限）
    if (
      !quiz.question ||
      !Array.isArray(quiz.answerOptions) ||
      quiz.answerOptions.length < 3
    ) {
      return res.status(500).json({ error: "Quiz missing required fields", raw: quiz });
    }

    res.status(200).json(quiz);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
