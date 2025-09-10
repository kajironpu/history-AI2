import os
import requests
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)
API_KEY = os.environ.get("GEN_API_KEY")  # ここにGemini APIキーを設定

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/generate", methods=["POST"])
def generate_quiz():
    data = request.json
    keyword = data.get("keyword")
    if not keyword:
        return jsonify({"error": "keyword is required"}), 400

    prompt = f"""
中学生向けの歴史クイズを作ってください。
正解は「{keyword}」です。
問題文と3つの選択肢、解説をJSON形式で返してください。
フォーマット例:
{{
  "question": "問題文",
  "answerOptions": [
    {{"text":"選択肢1","isCorrect":false,"rationale":"不正解の理由"}},
    {{"text":"選択肢2","isCorrect":true,"rationale":"正解の理由"}},
    {{"text":"選択肢3","isCorrect":false,"rationale":"不正解の理由"}}
  ],
  "keyword_explanation": "キーワードの解説"
}}
"""

    url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
    headers = {
        "Content-Type": "application/json",
        "X-goog-api-key": API_KEY
    }
    body = {
        "temperature": 0.7,
        "candidate_count": 1,
        "max_output_tokens": 500,
        "contents": [{"mime_type": "text/plain", "text": prompt}]
    }

    try:
        res = requests.post(url, headers=headers, json=body)
        res.raise_for_status()
        return jsonify(res.json())
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True)
