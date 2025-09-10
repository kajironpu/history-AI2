let questionsByEra = {};
let selectedKeywords = [];
let currentQuizIndex = 0;
let correctCount = 0; // 正解数

// CSV読み込み
async function loadDataFromCSV() {
    const res = await fetch('data.csv');
    const text = await res.text();
    const lines = text.trim().split('\n');
    const headers = lines[0].split(',').map(h => h.trim());
    const eraIndex = headers.indexOf('時代');
    const keywordIndex = headers.indexOf('キーワード');

    questionsByEra = {};
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim());
        if (!cols[eraIndex] || !cols[keywordIndex]) continue;
        const era = cols[eraIndex];
        const keyword = cols[keywordIndex];
        if (!questionsByEra[era]) questionsByEra[era] = [];
        questionsByEra[era].push(keyword);
    }
    populateEraSelect();
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

// クイズ開始
async function startQuiz() {
    const selectedEra = document.getElementById('era-select').value;
    if (!selectedEra || !questionsByEra[selectedEra]) return alert('時代を選択してください');

    selectedKeywords = shuffle([...questionsByEra[selectedEra]]);
    currentQuizIndex = 0;
    correctCount = 0; // 正解数リセット
    updateProgress();
    await generateNextQuestion();
}

// 進捗表示
function updateProgress() {
    const remaining = selectedKeywords.length - (currentQuizIndex + 1);
    const rate = ((correctCount / (currentQuizIndex + 1)) * 100).toFixed(1);
    document.getElementById('progress-area').textContent = `残り問題: ${remaining}問 | 現在の正解率: ${rate}%`;
}

// 選択肢をクリックしたときの処理
function checkAnswer(option, element, quiz) {
    const optionItems = document.querySelectorAll('.option-item');
    optionItems.forEach(item => item.style.pointerEvents = 'none');

    element.className = option.isCorrect ? 'option-item correct' : 'option-item incorrect';

    if (option.isCorrect) correctCount++; // 正解数更新

    if (!option.isCorrect) {
        optionItems.forEach((item, index) => {
            if (quiz.answerOptions[index].isCorrect) item.className = 'option-item correct';
        });
    }

    const rationaleBox = document.getElementById('rationale-box');
    rationaleBox.style.display = 'block';
    document.getElementById('next-question-btn').style.display = 'block';

    const result = option.isCorrect ? '正解！' : '不正解';
    rationaleBox.innerHTML = `<strong>${result}</strong><br><br><strong>解説:</strong><br>${quiz.keyword_explanation}`;

    updateProgress(); // 進捗を更新
}

document.getElementById('start-quiz-btn').addEventListener('click', startQuiz);
document.getElementById('next-question-btn').addEventListener('click', () => {
    currentQuizIndex++;
    generateNextQuestion();
});

document.addEventListener('DOMContentLoaded', () => loadDataFromCSV().catch(err => console.error(err)));
