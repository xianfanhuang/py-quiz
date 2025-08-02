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

// Start the game when the page loads
document.addEventListener('DOMContentLoaded', loadQuestions);