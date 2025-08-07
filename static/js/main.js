class PythonQuiz {
  constructor() {
    // DOM选择器映射（解耦硬编码）
    this.selectors = {
      quizContainer: '#quiz-container',
      codeRunner: '#code-runner',
      codeInput: '#code-input',
      codeOutput: '#code-output',
      runCodeBtn: '#run-code',
      submitBtn: '#submit',
      resetBtn: '#reset',
      backBtn: '#back-to-full',
      timer: '#timer',
      wrongBtn: '#wrong-questions',
      filterBtn: '#filter-btn',
      categoryFilter: '#category-filter',
      difficultyFilter: '#difficulty-filter',
      result: '#result',
      loading: '#loading'
    };

    // 数据存储
    this.state = {
      originalQuestions: [], // 原始完整题库
      currentQuestions: [],  // 当前显示的题目（可能经过筛选）
      userAnswers: [],       // 用户答案
      score: 0,              // 得分
      pyodide: null,         // pyodide实例
      startTime: null,       // 计时开始时间
      timerInterval: null    // 计时器
    };

    // 初始化
   async init() {
    try {
    await this.initPyodide();  // 先初始化Pyodide
    await this.loadQuestions(); // 再加载题库
  } catch (error) {
    this.showErrorMessage('初始化失败: ' + error.message);
  }
}
    if (!this.state.pyodide) {
  this.showErrorMessage('Pyodide 未初始化');
  return;
}
    this.init();
  }

  // 初始化入口
  async init() {
    try {
      this.showLoading('加载题库与Python环境...');
      // 并行加载题库和pyodide
      const [questions] = await Promise.all([
        this.loadQuestions(),
        this.initPyodide()
      ]);
      this.state.originalQuestions = questions;
      this.state.currentQuestions = [...questions];
      this.state.userAnswers = new Array(questions.length).fill(null);
      
      this.renderQuestions();
      this.bindEvents();
      this.startTimer();
      this.hideLoading();
    } catch (error) {
      this.showError(`初始化失败：${error.message}`);
      this.hideLoading();
    }
  }

  // 加载题库（合并questions.json和questions-2.json）
  async loadQuestions() {
    try {
      const [res1, res2] = await Promise.all([
        fetch('static/py/questions.json'),
        fetch('static/py/questions-2.json')
      ]);
      if (!res1.ok || !res2.ok) throw new Error('题库加载失败');
      
      const q1 = await res1.json();
      const q2 = await res2.json();
      // 统一题库格式（处理字段不一致问题）
      return [...q1, ...q2].map(q => ({
        id: q.id || Date.now() + Math.random(), // 确保id唯一
        question: q.question,
        options: q.options || [],
        correctAnswer: q.correct !== undefined ? q.correct : q.correctAnswer, // 兼容两种字段
        explanation: q.explanation || '无解析',
        needCodeRunner: q.needCodeRunner || false, // 是否需要代码运行区
        category: q.category || '未分类',
        difficulty: q.difficulty || 'medium'
      }));
    } catch (error) {
      throw new Error(`题库错误：${error.message}`);
    }
  }

  // 初始化pyodide环境
  async initPyodide() {
    try {
      this.state.pyodide = await loadPyodide({
        indexURL: 'static/pyodide/' // 已部署的pyodide路径
      });
      // 重定向print输出到页面
      this.state.pyodide.globals.set('print', (text) => {
        this.updateCodeOutput(`> ${text}`);
      });
      return this.state.pyodide;
    } catch (error) {
      throw new Error(`Python环境错误：${error.message}`);
    }
  }

  // 渲染题目列表
  renderQuestions() {
    const container = document.querySelector(this.selectors.quizContainer);
    container.innerHTML = ''; // 清空容器
    
    this.state.currentQuestions.forEach((q, index) => {
      const questionEl = document.createElement('div');
      questionEl.className = 'question';
      questionEl.dataset.index = index;
      
      // 题目HTML
      questionEl.innerHTML = `
        <div class="question__title">
          第${index + 1}题（${q.difficulty === 'easy' ? '简单' : q.difficulty === 'medium' ? '中等' : '困难'}·${q.category}）
        </div>
        <div class="question__text">${q.question}</div>
        <div class="question__options">
          ${q.options.map((opt, optIdx) => `
            <label class="option">
              <input type="radio" name="q-${index}" value="${optIdx}" 
                ${this.state.userAnswers[index] === optIdx ? 'checked' : ''}>
              <span class="option__text">${opt}</span>
            </label>
          `).join('')}
        </div>
        <div class="question__result hidden"></div>
      `;
      container.appendChild(questionEl);
    });

    // 根据首题是否需要代码区，决定是否显示
    this.toggleCodeRunner(
      this.state.currentQuestions.length > 0 && 
      this.state.currentQuestions[0].needCodeRunner
    );
  }

  // 绑定所有事件
  bindEvents() {
    // 选项点击事件
    document.querySelector(this.selectors.quizContainer).addEventListener('change', (e) => {
      if (e.target.type === 'radio') {
        const index = parseInt(e.target.closest('.question').dataset.index);
        this.state.userAnswers[index] = parseInt(e.target.value);
      }
    });

    // 提交答案
    document.querySelector(this.selectors.submitBtn).addEventListener('click', () => this.submitAnswers());

    // 重新答题
    document.querySelector(this.selectors.resetBtn).addEventListener('click', () => this.resetQuiz());

    // 查看错题本
    document.querySelector(this.selectors.wrongBtn).addEventListener('click', () => this.showWrongQuestions());

    // 返回全题库
    document.querySelector(this.selectors.backBtn).addEventListener('click', () => this.backToFull());

    // 筛选题目
    document.querySelector(this.selectors.filterBtn).addEventListener('click', () => this.filterQuestions());

    // 运行代码
    document.querySelector(this.selectors.runCodeBtn).addEventListener('click', () => this.runCode());
  }

  // 提交答案并评分
  submitAnswers() {
    // 检查未答题
    const unAnswered = this.state.userAnswers.findIndex(ans => ans === null);
    if (unAnswered !== -1) {
      return this.showError(`第${unAnswered + 1}题未作答`);
    }

    // 计算得分
    this.state.score = this.state.currentQuestions.reduce((score, q, i) => {
      const isCorrect = this.state.userAnswers[i] === q.correctAnswer;
      // 显示每题结果
      this.showQuestionResult(i, isCorrect, q);
      return score + (isCorrect ? 1 : 0);
    }, 0);

    // 保存错题
    this.saveWrongQuestions();

    // 显示总分
    document.querySelector(this.selectors.result).innerHTML = `
      <div class="result__score">得分：${this.state.score}/${this.state.currentQuestions.length}</div>
      <div class="result__rate">正确率：${Math.round((this.state.score / this.state.currentQuestions.length) * 100)}%</div>
    `;

    // 切换按钮状态
    document.querySelector(this.selectors.submitBtn).classList.add('hidden');
    document.querySelector(this.selectors.resetBtn).classList.remove('hidden');
    this.stopTimer();
  }

  // 显示单题结果
  showQuestionResult(index, isCorrect, question) {
    const resultEl = document.querySelector(`.question[data-index="${index}"] .question__result`);
    resultEl.classList.remove('hidden');
    resultEl.className = `question__result ${isCorrect ? 'correct' : 'incorrect'}`;
    resultEl.innerHTML = isCorrect 
      ? '✅ 正确' 
      : `❌ 错误<br>正确答案：${question.options[question.correctAnswer]}<br>解析：${question.explanation}`;
  }

  // 代码运行功能
  runCode() {
    const code = document.querySelector(this.selectors.codeInput).value.trim();
    if (!code) return this.showError('请输入代码');
    if (!this.state.pyodide) return this.showError('Python环境未就绪');

    this.updateCodeOutput('运行中...');
    try {
      // 执行代码（5秒超时保护）
      const timeout = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('代码运行超时')), 5000)
      );
      const runCode = this.state.pyodide.runPythonAsync(code);
      
      Promise.race([runCode, timeout]).then(result => {
        if (result !== undefined) this.updateCodeOutput(`结果：${result}`);
      }).catch(error => {
        this.updateCodeOutput(`错误：${error.message}`);
      });
    } catch (error) {
      this.updateCodeOutput(`执行错误：${error.message}`);
    }
  }

  // 更新代码输出区
  updateCodeOutput(text) {
    document.querySelector(this.selectors.codeOutput).textContent = text;
  }

  // 切换代码运行区显示
  toggleCodeRunner(show) {
    const runner = document.querySelector(this.selectors.codeRunner);
    show ? runner.classList.remove('hidden') : runner.classList.add('hidden');
  }

  // 错题本功能
  saveWrongQuestions() {
    const wrongs = this.state.currentQuestions.filter((q, i) => 
      this.state.userAnswers[i] !== q.correctAnswer
    );
    const existingWrongs = JSON.parse(localStorage.getItem('pythonQuizWrongs') || '[]');
    // 去重后保存（按id）
    const uniqueWrongs = [...new Map([...existingWrongs, ...wrongs].map(q => [q.id, q])).values()];
    localStorage.setItem('pythonQuizWrongs', JSON.stringify(uniqueWrongs));
  }

  // 显示错题本
  showWrongQuestions() {
    const wrongs = JSON.parse(localStorage.getItem('pythonQuizWrongs') || '[]');
    if (wrongs.length === 0) {
      return this.showError('暂无错题，继续加油！');
    }
    this.state.currentQuestions = wrongs;
    this.state.userAnswers = new Array(wrongs.length).fill(null);
    this.renderQuestions();
    document.querySelector(this.selectors.backBtn).classList.remove('hidden');
    this.resetTimer();
  }

  // 返回全题库
  backToFull() {
    this.state.currentQuestions = [...this.state.originalQuestions];
    this.state.userAnswers = new Array(this.state.originalQuestions.length).fill(null);
    this.renderQuestions();
    document.querySelector(this.selectors.backBtn).classList.add('hidden');
    this.resetTimer();
  }

  // 筛选题目
  filterQuestions() {
    const category = document.querySelector(this.selectors.categoryFilter).value;
    const difficulty = document.querySelector(this.selectors.difficultyFilter).value;
    
    this.state.currentQuestions = this.state.originalQuestions.filter(q => {
      const matchCategory = !category || q.category === category;
      const matchDifficulty = !difficulty || q.difficulty === difficulty;
      return matchCategory && matchDifficulty;
    });

    if (this.state.currentQuestions.length === 0) {
      return this.showError('没有符合条件的题目');
    }

    this.state.userAnswers = new Array(this.state.currentQuestions.length).fill(null);
    this.renderQuestions();
    this.resetTimer();
  }

  // 重新答题
  resetQuiz() {
    this.state.userAnswers = new Array(this.state.currentQuestions.length).fill(null);
    document.querySelectorAll('.question__result').forEach(el => el.classList.add('hidden'));
    document.querySelector(this.selectors.result).innerHTML = '';
    document.querySelector(this.selectors.submitBtn).classList.remove('hidden');
    document.querySelector(this.selectors.resetBtn).classList.add('hidden');
    this.resetTimer();
  }

  // 计时功能
  startTimer() {
    this.state.startTime = new Date().getTime();
    this.state.timerInterval = setInterval(() => {
      const elapsed = Math.floor((new Date().getTime() - this.state.startTime) / 1000);
      const minutes = Math.floor(elapsed / 60);
      const seconds = elapsed % 60;
      document.querySelector(this.selectors.timer).textContent = `用时：${minutes}分${seconds}秒`;
    }, 1000);
  }

  // 停止计时
  stopTimer() {
    clearInterval(this.state.timerInterval);
  }

  // 重置计时
  resetTimer() {
    this.stopTimer();
    this.startTimer();
  }

  // 加载提示
  showLoading(text) {
    document.querySelector(this.selectors.loading).querySelector('.loading__text').textContent = text;
    document.querySelector(this.selectors.loading).classList.remove('hidden');
  }

  hideLoading() {
    document.querySelector(this.selectors.loading).classList.add('hidden');
  }

  // 错误提示
  showError(message) {
    alert(message); // 简单实现，可替换为toast组件
  }
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => new PythonQuiz());