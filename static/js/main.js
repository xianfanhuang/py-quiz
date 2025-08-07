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
      // 优先加载题库，让用户快速看到题目
      await this.loadQuestions();
      this.renderQuestion();

      // 后台初始化 Pyodide（不阻塞界面）
      this.initPyodide().catch((err) => {
        console.warn("Pyodide 初始化失败（不影响基础答题）:", err);
        this.showErrorMessage("Pyodide 初始化失败（不影响基础答题）");
      });
    } catch (error) {
      this.showErrorMessage(`初始化失败: ${error.message}`);
    }
  }

  async initPyodide() {
    try {
      this.state.pyodide = await loadPyodide({
        indexURL: "/py-quiz/static/pyodide/", // 修正为小写路径
      });
      console.log("Pyodide 初始化成功");
    } catch (error) {
      throw new Error(`Pyodide 加载失败: ${error.message}`);
    }
  }

  async loadQuestions() {
    try {
      const response = await fetch(
        "/py-quiz/static/py/questions.json"
      );
      if (!response.ok) {
        throw new Error(`题库请求失败: ${response.status}`);
      }

      const data = await response.json();
      if (!data || data.length === 0) {
        throw new Error("题库为空或格式错误");
      }

      this.state.questions = data;
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

    const quizContainer = document.querySelector(".quiz-container");
    if (!quizContainer) {
      throw new Error("未找到题目容器");
    }

    const question = questions[currentQuestion];
    quizContainer.innerHTML = `
      <div class="question-item">
        <h3>${currentQuestion + 1}. ${question.question}</h3>
        <div class="options">
          ${question.options
            .map(
              (option, index) => `
            <div class="option">
              <input type="radio" name="q${currentQuestion}" id="opt${index}" value="${index}">
              <label for="opt${index}">${option}</label>
            </div>
          `
            )
            .join("")}
        </div>
        <button class="submit-answer">提交答案</button>
      </div>
    `;

    quizContainer
      .querySelector(".submit-answer")
      .addEventListener("click", () => {
        this.checkAnswer();
      });
  }

  checkAnswer() {
    const { questions, currentQuestion, score } = this.state;
    const selectedOption = document.querySelector(
      `input[name="q${currentQuestion}"]:checked`
    );

    if (!selectedOption) {
      this.showErrorMessage("请选择一个答案");
      return;
    }

    const isCorrect =
      parseInt(selectedOption.value) === questions[currentQuestion].correctAnswer;
    const newScore = isCorrect ? score + 1 : score;
    this.state.score = newScore;

    // 给用户反馈
    const feedback = document.createElement("div");
    feedback.className = isCorrect ? "correct-feedback" : "wrong-feedback";
    feedback.textContent = isCorrect
      ? "正确！"
      : `错误，正确答案是：${
          questions[currentQuestion].options[
            questions[currentQuestion].correctAnswer
          ]
        }`;
    const quizContainer = document.querySelector(".quiz-container");
    quizContainer.appendChild(feedback);

    // 延迟 1 秒跳转下一题
    setTimeout(() => {
      this.state.currentQuestion++;
      this.renderQuestion();
    }, 1000);
  }

  showResults() {
    const resultsContainer = document.getElementById("results-container");
    const totalResult = document.getElementById("total-result");
    if (!resultsContainer || !totalResult) {
      throw new Error("未找到结果容器");
    }

    totalResult.textContent = `你的得分: ${this.state.score}/${this.state.questions.length}`;
    resultsContainer.style.display = "block";
    document.querySelector(".quiz-container").innerHTML = "";

    document
      .getElementById("restart-quiz")
      .addEventListener("click", () => {
        this.state.currentQuestion = 0;
        this.state.score = 0;
        resultsContainer.style.display = "none";
        this.renderQuestion();
      });
  }

  showErrorMessage(message) {
    const errorDiv = document.createElement("div");
    errorDiv.className = "error-message";
    errorDiv.textContent = message;
    document.querySelector(".container").prepend(errorDiv);
  }
}

// 初始化 Quiz
document.addEventListener("DOMContentLoaded", () => new PythonQuiz());