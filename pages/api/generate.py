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
問題文と3つの選択肢、解説をJSON形式で返してください。
フォーマット例:
{
  "question": "問題文",
  "answerOptions": [
    {"text":"選択肢1","isCorrect":false,"rationale":"不正解の理由"},
    {"text":"選択肢2","isCorrect":true,"rationale":"正解の理由"},
    {"text":"選択肢3","isCorrect":false,"rationale":"不正解の理由"}
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
          "X-goog-api-key": process.env.GEN_API_KEY,
        },
        body: JSON.stringify({
          temperature: 0.7,
          candidate_count: 1,
          max_output_tokens: 500,
          contents: [{ parts: [{ text: prompt }] }],
        }),
      }
    );

    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
