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
    // 1. 优先加载题库并渲染，不等待Pyodide
    await this.loadQuestions();
    this.renderQuestion();

    // 2. 后台初始化Pyodide（不阻塞主线程）
    this.initPyodide().catch(err => {
      console.warn('Pyodide初始化失败（不影响基础答题）:', err);
    });
  } catch (error) {
    this.showErrorMessage(`初始化失败: ${error.mes...
        }
    }

    // 修正Pyodide初始化路径
    async initPyodide() {
        try {
            this.state.pyodide = await loadPyodide({
                indexURL: '/py-quiz/static/pyodide/'  // 绝对子路径
            });
            console.log('pyodide initialized successfully');
        } catch (error) {
            throw new Error(`Pyodide加载失败: ${error.message}`);
        }
    }
async initPyodide() {
    const maxRetries = 3;
    let retries = 0;
    while (retries < maxRetries) {
        try {
            this.state.pyodide = await loadPyodide({
                indexURL: "/py-quiz/static/pyodide/", 
            });
            console.log("Pyodide 初始化成功");
            return;
        } catch (error) {
            retries++;
            if (retries === maxRetries) {
                throw new Error(`Pyodide 加载失败: ${error.message}`);
            }
            console.warn(`Pyodide 加载重试（第 ${retries} 次）: ${error.message}`);
            await new Promise((resolve) => setTimeout(resolve, 2000)); // 等待2秒后重试
        }
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