
let questionsByEra = {};
let selectedKeywords = [];
let currentQuizIndex = 0;
let correctCount = 0; // 現在の正解数

// CSV読み込み
async function loadDataFromCSV() {
    try {
        const res = await fetch('data.csv');
        if (!res.ok) throw new Error(`HTTP ${res.status}: CSVファイルが見つかりません`);

        const text = await res.text();
        const lines = text.trim().split('\n');
        if (lines.length < 2) throw new Error('CSVデータが空です');

        const headers = lines[0].split(',').map(h => h.trim());
        const eraIndex = headers.indexOf('時代');
        const keywordIndex = headers.indexOf('キーワード');

        if (eraIndex === -1 || keywordIndex === -1) {
            throw new Error('CSVヘッダーに「時代」または「キーワード」が見つかりません');
        }

        questionsByEra = {};
        let validRowCount = 0;

        for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.trim());
            if (cols.length <= eraIndex || cols.length <= keywordIndex) continue;
            if (!cols[eraIndex] || !cols[keywordIndex]) continue;

            const era = cols[eraIndex];
            const keyword = cols[keywordIndex];
            if (!questionsByEra[era]) questionsByEra[era] = [];
            questionsByEra[era].push(keyword);
            validRowCount++;
        }

        if (validRowCount === 0) throw new Error('有効なデータ行が見つかりません');

        populateEraSelect();

    } catch (error) {
        let userMessage = error.message;
        if (error.message.includes('NetworkError') && window.location.protocol === 'file:') {
            userMessage = 'ローカルファイルでは動作しません。ローカルサーバー（例: VS Code Live Server）で開いてください。';
        }
        alert(`アプリを起動できません。\n${userMessage}\n\n"data.csv" ファイルを確認してください。`);
        throw error;
    }
}

function populateEraSelect() {
    const select = document.getElementById('era-select');
    select.innerHTML = '<option value="">時代を選択...</option>';
    Object.keys(questionsByEra).forEach(era => {
        const option = document.createElement('option');
        option.value = era;
        option.textContent = era;
        select.appendChild(option);
    });
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function getFallbackQuiz(keyword) {
    return {
        question: `"${keyword}"に関する問題（APIエラー）`,
        answerOptions: [
            { text: "選択肢A", isCorrect: false, rationale: "" },
            { text: "選択肢B（正解）", isCorrect: true, rationale: "" },
            { text: "選択肢C", isCorrect: false, rationale: "" }
        ],
        keyword_explanation: `※APIエラーのため、仮の問題です。キーワード「${keyword}」について学習しましょう。`
    };
}

// クイズ開始
async function startQuiz() {
    const selectedEra = document.getElementById('era-select').value;
    if (!selectedEra) return;

    if (!questionsByEra[selectedEra] || questionsByEra[selectedEra].length === 0) {
        alert('選択された時代にキーワードが登録されていません');
        return;
    }

    selectedKeywords = shuffle([...questionsByEra[selectedEra]]);
    currentQuizIndex = 0;
    correctCount = 0;
    window.retryCount = 0;

    updateProgress();
    await generateNextQuestion();
}

// 進捗表示
function updateProgress() {
    const remaining = selectedKeywords.length - (currentQuizIndex + 1);
    const rate = ((correctCount / (currentQuizIndex + 1)) * 100).toFixed(1);
    document.getElementById('progress-area').textContent =
        `残り問題: ${remaining}問 | 現在の正解率: ${rate}%`;
}

// 問題生成
async function generateNextQuestion() {
    if (currentQuizIndex >= selectedKeywords.length) {
        alert('全問終了！お疲れ様でした！');
        return;
    }

    const keyword = selectedKeywords[currentQuizIndex];

    document.getElementById('loading').style.display = 'block';
    document.getElementById('quiz-area').style.display = 'none';

    try {
        const res = await fetch('/api/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ keyword: keyword })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

        const quiz = await res.json();

        while (quiz.answerOptions.length < 3) {
            quiz.answerOptions.push({ text: "選択肢X", isCorrect: false, rationale: "" });
        }

        let correctCountInOptions = quiz.answerOptions.filter(o => o.isCorrect).length;
        if (correctCountInOptions === 0) quiz.answerOptions[0].isCorrect = true;
        else if (correctCountInOptions > 1) {
            let found = false;
            quiz.answerOptions.forEach(o => {
                if (o.isCorrect) {
                    if (!found) found = true;
                    else o.isCorrect = false;
                }
            });
        }

        quiz.keyword_explanation = quiz.keyword_explanation || "解説が利用できません。";

        displayQuiz(quiz);
        window.retryCount = 0;

    } catch (error) {
        console.error("APIエラー:", error);
        if (window.retryCount < 3) {
            window.retryCount++;
            setTimeout(generateNextQuestion, 1500);
            return;
        }
        alert('API生成に3回失敗しました。フォールバック問題を表示します。');
        const fallbackQuiz = getFallbackQuiz(selectedKeywords[currentQuizIndex]);
        displayQuiz(fallbackQuiz);
        window.retryCount = 0;
    } finally {
        document.getElementById('loading').style.display = 'none';
    }
}

// 問題表示
function displayQuiz(quiz) {
    const questionText = document.getElementById('question-text');
    const optionsList = document.getElementById('options-list');
    const rationaleBox = document.getElementById('rationale-box');

    questionText.textContent = quiz.question;
    optionsList.innerHTML = '';
    rationaleBox.style.display = 'none';
    document.getElementById('next-question-btn').style.display = 'none';

    quiz.answerOptions.forEach(option => {
        const li = document.createElement('li');
        li.textContent = option.text;
        li.className = 'option-item';
        li.addEventListener('click', () => checkAnswer(option, li, quiz));
        optionsList.appendChild(li);
    });

    document.getElementById('quiz-area').style.display = 'block';
}

// 選択肢クリック時
function checkAnswer(option, element, quiz) {
    const optionItems = document.querySelectorAll('.option-item');
    optionItems.forEach(item => item.style.pointerEvents = 'none');

    element.className = option.isCorrect ? 'option-item correct' : 'option-item incorrect';

    if (option.isCorrect) correctCount++;

    if (!option.isCorrect) {
        optionItems.forEach((item, index) => {
            if (quiz.answerOptions[index].isCorrect) item.className = 'option-item correct';
        });
    }

    const rationaleBox = document.getElementById('rationale-box');
    rationaleBox.style.display = 'block';
    document.getElementById('next-question-btn').style.display = 'block';

    //const result = option.isCorrect ? '正解！' : '不正解';
    rationaleBox.innerHTML = `<strong>解説:</strong><br>${quiz.keyword_explanation}`;

    updateProgress();
}

// --- イベント ---
// 「次の問題」ボタン
document.getElementById('next-question-btn').addEventListener('click', () => {
    currentQuizIndex++;
    generateNextQuestion();
});

// 「時代を選んだら自動スタート」
document.getElementById('era-select').addEventListener('change', () => {
    const selectedEra = document.getElementById('era-select').value;
    if (selectedEra) {
        startQuiz();
    }
});

// 初期読み込み
document.addEventListener('DOMContentLoaded', () =>
    loadDataFromCSV().catch(err => console.error(err))
);
