export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { keyword, era } = req.body;
  if (!keyword || !era) {
    return res.status(400).json({ error: "keyword と era が必要です" });
  }

  // 改善したプロンプト
  const prompt = `
中学生向けの歴史クイズを作ってください。
対象の時代は「${era}」です。
正解は「${keyword}」です。
必ずその時代に沿った問題にしてください。
絶対にJSON形式のみで返してください。余計な文章やマークダウンは不要。

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

    const cleaned = text.replace(/```json|```/g, "").trim();

    let quiz;
    try {
      quiz = JSON.parse(cleaned);
    } catch (e) {
      return res.status(500).json({ error: "Invalid JSON from Gemini", raw: cleaned });
    }

    // 選択肢が3つ未満なら補完
    while (quiz.answerOptions.length < 3) {
      quiz.answerOptions.push({ text: "選択肢X", isCorrect: false, rationale: "" });
    }

    // 正解が1つだけになるよう補正
    const correctCount = quiz.answerOptions.filter(o => o.isCorrect).length;
    if (correctCount === 0) quiz.answerOptions[0].isCorrect = true;
    else if (correctCount > 1) {
      let found = false;
      quiz.answerOptions.forEach(o => {
        if (o.isCorrect) {
          if (!found) found = true;
          else o.isCorrect = false;
        }
      });
    }

    // 解説がない場合は補完
    if (!quiz.keyword_explanation) quiz.keyword_explanation = "解説が利用できません。";

    res.status(200).json(quiz);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
