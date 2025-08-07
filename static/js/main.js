class PythonQuiz {
    constructor() {
        this.state = {
            pyodide: null,
            questions: [],
            currentQuestion: 0,
            score: 0
        };
        this.init();
    }

    async init() {
        try {
            // 先初始化Pyodide，再加载题库
            await this.initPyodide();
            await this.loadQuestions();
            this.renderQuestion();
        } catch (error) {
            this.showErrorMessage(`初始化失败: ${error.message}`);
        }
    }

    // 修正Pyodide初始化路径
    async initPyodide() {
        try {
            this.state.pyodide = await loadPyodide({
                indexURL: '/py-quiz/static/pyodide/'  // 绝对子路径
            });
            console.log('Pyodide initialized successfully');
        } catch (error) {
            throw new Error(`Pyodide加载失败: ${error.message}`);
        }
    }

    // 修正题库加载路径
    async loadQuestions() {
        try {
            const response = await fetch('/py-quiz/static/py/questions.json');
            if (!response.ok) throw new Error(`题库请求失败: ${response.status}`);
            
            this.state.questions = await response.json();
            if (!this.state.questions.length) throw new Error('题库为空');
        } catch (error) {
            throw new Error(`题库加载失败: ${error.message}`);
        }
    }

    renderQuestion() {
        const { questions, currentQuestion } = this.state;
        if (currentQuestion >= questions.length) {
            this.showResults();
            return;
        }

        const quizContainer = document.querySelector('.quiz-container');
        if (!quizContainer) throw new Error('未找到题目容器');

        const question = questions[currentQuestion];
        quizContainer.innerHTML = `
            <div class="question-item">
                <h3>${currentQuestion + 1}. ${question.question}</h3>
                <div class="options">
                    ${question.options.map((option, index) => `
                        <div class="option">
                            <input type="radio" name="q${currentQuestion}" id="opt${index}" value="${index}">
                            <label for="opt${index}">${option}</label>
                        </div>
                    `).join('')}
                </div>
                <button class="submit-answer">提交答案</button>
            </div>
        `;

        quizContainer.querySelector('.submit-answer').addEventListener('click', () => {
            this.checkAnswer();
        });
    }

    checkAnswer() {
        const { currentQuestion, questions } = this.state;
        const selectedOption = document.querySelector(`input[name="q${currentQuestion}"]:checked`);
        
        if (!selectedOption) {
            this.showErrorMessage('请选择一个答案');
            return;
        }

        const isCorrect = parseInt(selectedOption.value) === questions[currentQuestion].correctAnswer;
        if (isCorrect) this.state.score++;

        this.state.currentQuestion++;
        this.renderQuestion();
    }

    showResults() {
        const resultsContainer = document.getElementById('results-container');
        const totalResult = document.getElementById('total-result');
        if (!resultsContainer || !totalResult) throw new Error('未找到结果容器');

        totalResult.textContent = `你的得分: ${this.state.score}/${this.state.questions.length}`;
        resultsContainer.style.display = 'block';
        document.querySelector('.quiz-container').innerHTML = '';

        document.getElementById('restart-quiz').addEventListener('click', () => {
            this.state.currentQuestion = 0;
            this.state.score = 0;
            resultsContainer.style.display = 'none';
            this.renderQuestion();
        });
    }

    showErrorMessage(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        document.querySelector('.container').prepend(errorDiv);
    }
}

// 初始化Quiz
document.addEventListener('DOMContentLoaded', () => new PythonQuiz());