/**
 * Python 题库交互逻辑核心文件
 * 功能：加载题库、渲染题目、处理答题交互、显示结果
 */

// 全局变量：存储题库数据和用户答案
let questions = [];
let userAnswers = [];

/**
 * 初始化函数：页面加载后执行
 */
document.addEventListener('DOMContentLoaded', init);

async function init() {
    try {
        // 1. 加载题库数据
        await loadQuestions();
        
        // 2. 渲染题目到页面
        renderQuestions();
        
        // 3. 绑定提交按钮事件
        bindSubmitEvent();
    } catch (error) {
        console.error('初始化失败：', error);
        showErrorMessage('页面加载失败，请刷新重试');
    }
}

/**
 * 加载题库数据（从 questions.json 获取）
 */
async function loadQuestions() {
    try {
        const response = await fetch('static/py/questions.json');
        if (!response.ok) {
            throw new Error(`题库请求失败（状态码：${response.status}）`);
        }
        questions = await response.json();
        
        // 初始化用户答案数组（与题目数量对应）
        userAnswers = new Array(questions.length).fill(null);
    } catch (error) {
        console.error('题库加载失败：', error);
        throw new Error('无法加载题目数据');
    }
}

/**
 * 渲染题目到页面
 */
function renderQuestions() {
    const quizContainer = document.getElementById('quiz');
    if (!quizContainer) {
        throw new Error('未找到题目容器（id="quiz"）');
    }

    // 清空容器
    quizContainer.innerHTML = '';

    // 遍历题库，生成HTML
    questions.forEach((question, index) => {
        const questionElement = document.createElement('div');
        questionElement.className = 'question-item';
        questionElement.dataset.index = index;

        // 题目HTML结构
        questionElement.innerHTML = `
            <h3 class="question-text">第 ${index + 1} 题：${question.question}</h3>
            <div class="options">
                ${question.options.map((option, optIndex) => `
                    <div class="option">
                        <input type="radio" 
                               name="question-${index}" 
                               id="q${index}-opt${optIndex}" 
                               value="${optIndex}"
                               ${userAnswers[index] === optIndex ? 'checked' : ''}>
                        <label for="q${index}-opt${optIndex}">${option}</label>
                    </div>
                `).join('')}
            </div>
            <div class="answer-result" style="display: none;"></div> <!-- 结果显示区域 -->
        `;

        quizContainer.appendChild(questionElement);

        // 绑定选项选择事件（实时记录用户答案）
        bindOptionChangeEvent(questionElement, index);
    });

    // 添加提交按钮
    const submitBtn = document.createElement('button');
    submitBtn.id = 'submit-answers';
    submitBtn.className = 'submit-btn';
    submitBtn.textContent = '提交答案';
    quizContainer.appendChild(submitBtn);
}

/**
 * 绑定选项选择事件（记录用户答案）
 */
function bindOptionChangeEvent(questionElement, questionIndex) {
    const options = questionElement.querySelectorAll('input[type="radio"]');
    options.forEach(option => {
        option.addEventListener('change', (e) => {
            userAnswers[questionIndex] = parseInt(e.target.value, 10);
        });
    });
}

/**
 * 绑定提交按钮事件
 */
function bindSubmitEvent() {
    const submitBtn = document.getElementById('submit-answers');
    if (!submitBtn) return;

    submitBtn.addEventListener('click', () => {
        // 检查是否有未答题
        const unAnswered = userAnswers.findIndex(answer => answer === null);
        if (unAnswered !== -1) {
            showErrorMessage(`第 ${unAnswered + 1} 题未作答，请完成所有题目`);
            return;
        }

        // 计算得分并显示结果
        calculateScore();
        showResults();

        // 禁用提交按钮
        submitBtn.disabled = true;
        submitBtn.textContent = '已提交';
    });
}

/**
 * 计算得分
 */
function calculateScore() {
    let score = 0;
    questions.forEach((question, index) => {
        if (userAnswers[index] === question.correctAnswer) {
            score++;
        }
    });
    return score;
}

/**
 * 显示答题结果（正确/错误标记）
 */
function showResults() {
    const total = questions.length;
    const score = calculateScore();

    // 显示总分
    const resultContainer = document.createElement('div');
    resultContainer.className = 'total-result';
    resultContainer.innerHTML = `<h2>答题完成！得分：${score}/${total}</h2>`;
    document.querySelector('.quiz-container').prepend(resultContainer);

    // 标记每道题的对错
    questions.forEach((question, index) => {
        const questionElement = document.querySelector(`.question-item[data-index="${index}"]`);
        const resultElement = questionElement.querySelector('.answer-result');
        const isCorrect = userAnswers[index] === question.correctAnswer;

        resultElement.style.display = 'block';
        if (isCorrect) {
            resultElement.className = 'answer-result correct';
            resultElement.textContent = '正确！';
        } else {
            resultElement.className = 'answer-result incorrect';
            resultElement.textContent = `错误！正确答案：${question.options[question.correctAnswer]}`;
        }
    });
}

/**
 * 显示错误信息
 */
function showErrorMessage(message) {
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.textContent = message;
    document.body.prepend(errorElement);
}