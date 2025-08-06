let pyodide;
async function initPyodide() {
  // 加载工作流构建的Pyodide资源（路径不变，但内容由CI自动生成）
  pyodide = await loadPyodide({
    indexURL: "static/pyodide/",  // 与工作流output-dir对应
  });
  // 无需手动加载packages，工作流已预装matplotlib等
  console.log("Pyodide初始化完成（工作流构建版）");
}
window.onload = initPyodide;
let currentQuestionIndex = 0;
let score = 0;
let questions = [];

// Fetch questions from JSON file
async function loadQuestions() {
    try {
        const response = await fetch('static/py/questions.json');
        questions = await response.json();
        showQuestion(currentQuestionIndex);
    } catch (error) {
        console.error('Error loading questions:', error);
        document.getElementById('question-text').textContent = 'Error loading questions. Please try again later.';
    }
}

function showQuestion(index) {
    const question = questions[index];
    const questionText = document.getElementById('question-text');
    const optionsContainer = document.getElementById('options-container');
    const nextButton = document.getElementById('next-btn');

    questionText.textContent = question.question;
    optionsContainer.innerHTML = '';
    nextButton.classList.add('hidden');

    question.options.forEach((option, i) => {
        const button = document.createElement('button');
        button.textContent = option;
        button.addEventListener('click', () => checkAnswer(i, question.correct));
        optionsContainer.appendChild(button);
    });
}

function checkAnswer(selectedIndex, correctIndex) {
    const options = document.querySelectorAll('#options-container button');
    const nextButton = document.getElementById('next-btn');
    
    // Disable all options after answer is selected
    options.forEach(button => button.disabled = true);
    
    // Show correct/incorrect feedback
    options[correctIndex].classList.add('correct');
    if (selectedIndex !== correctIndex) {
        options[selectedIndex].classList.add('incorrect');
    } else {
        score++;
        document.getElementById('score').textContent = score;
    }

    nextButton.classList.remove('hidden');
    nextButton.onclick = () => {
        currentQuestionIndex++;
        if (currentQuestionIndex < questions.length) {
            showQuestion(currentQuestionIndex);
        } else {
            endGame();
        }
    };
}

function endGame() {
    const gameArea = document.querySelector('.game-area');
    gameArea.innerHTML = `
        <h2>Game Over!</h2>
        <p>Your final score is: ${score} out of ${questions.length}</p>
        <button onclick="restartGame()">Play Again</button>
    `;
}

function restartGame() {
    currentQuestionIndex = 0;
    score = 0;
    document.getElementById('score').textContent = '0';
    showQuestion(currentQuestionIndex);
}
// 执行代码并返回事件列表
async function executeCode(code) {
  // 清空历史事件
  await pyodide.runPython("execution_events = []");
  // 执行用户代码（用monitor_variables装饰关键函数）
  const wrappedCode = `
    @monitor_variables
    def user_code():
        ${code.replace(/\n/g, '\n        ')}  # 缩进适配
    user_code()
  `;
  try {
    await pyodide.runPython(wrappedCode);
    // 获取执行事件（转换为JavaScript对象）
    const events = pyodide.globals.get("execution_events").toJs();
    return { success: true, events };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
// 生成变量变化图表（以列表为例）
async function generateVariablePlot(events) {
  // 提取所有步骤中的列表变量
  const listData = events.filter(e => e.type === "post_exec")
    .map(e => e.vars.my_list || []);  // 假设变量名为my_list

  // 在Pyodide中用Matplotlib绘图
  await pyodide.runPython(`
    import matplotlib.pyplot as plt
    import numpy as np

    # 准备数据
    steps = ${JSON.stringify(listData.map((_, i) => i))}
    list_lengths = ${JSON.stringify(listData.map(l => l.length))}

    # 绘图
    plt.figure(figsize=(5, 3))
    plt.plot(steps, list_lengths, 'bo-', label='列表长度变化')
    plt.xlabel('执行步骤')
    plt.ylabel('长度')
    plt.title('列表动态变化')
    plt.legend()

    # 保存为图片（转为Base64 URL）
    from io import BytesIO, StringIO
    buf = BytesIO()
    plt.savefig(buf, format='png', bbox_inches='tight')
    buf.seek(0)
    import base64
    plot_url = base64.b64encode(buf.read()).decode('utf-8')
  `);

  // 获取图片URL并返回
  const plotUrl = pyodide.globals.get("plot_url");
  return `data:image/png;base64,${plotUrl}`;
}
// Canvas绘制执行流程
function renderExecutionFlow(canvas, codeLines, currentStep) {
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // 绘制代码行
  codeLines.forEach((line, index) => {
    ctx.fillStyle = index === currentStep ? "lightgreen" : "white";  // 高亮当前步骤
    ctx.fillRect(10, 30 + index*30, canvas.width - 20, 25);
    ctx.fillStyle = "black";
    ctx.fillText(`${index+1}: ${line}`, 20, 50 + index*30);
  });

  // 绘制箭头（指向下一步）
  if (currentStep < codeLines.length - 1) {
    const y = 45 + currentStep*30;
    ctx.beginPath();
    ctx.moveTo(canvas.width - 40, y);
    ctx.lineTo(canvas.width - 20, y);
    ctx.lineTo(canvas.width - 30, y - 10);
    ctx.lineTo(canvas.width - 20, y);
    ctx.lineTo(canvas.width - 30, y + 10);
    ctx.fill();
  }
}
// Start the game when the page loads
document.addEventListener('DOMContentLoaded', loadQuestions);