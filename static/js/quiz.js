// Master question bank containing diverse, high-fidelity questions
const MASTER_QUESTIONS = [
    {
        question: "Which method is also known as the Synchronous Impedance Method?",
        options: ["EMF Method", "MMF Method", "ZPF Method", "ASA Method"],
        answerText: "EMF Method"
    },
    {
        question: "The regulation calculated by the EMF method is generally:",
        options: ["More than actual regulation", "Equal to actual regulation", "Less than actual regulation", "Zero"],
        answerText: "More than actual regulation"
    },
    {
        question: "In the MMF method, the armature leakage reactance drop is treated as:",
        options: ["An additional MMF", "An EMF drop", "A power loss", "A resistance drop"],
        answerText: "An additional MMF"
    },
    {
        question: "Which test is specifically required for the ZPF method in addition to OCC and SCC?",
        options: ["Zero Power Factor Test", "Slip Test", "Retardation Test", "Blocked Rotor Test"],
        answerText: "Zero Power Factor Test"
    },
    {
        question: "The Potier triangle is used to find:",
        options: ["Leakage reactance and armature reaction MMF", "Armature resistance and synchronous reactance", "Field current and terminal voltage", "Core loss and friction loss"],
        answerText: "Leakage reactance and armature reaction MMF"
    },
    {
        question: "Which method is also known as the Ampere-Turn Method?",
        options: ["MMF Method", "EMF Method", "ZPF Method", "ASA Method"],
        answerText: "MMF Method"
    },
    {
        question: "The EMF method is called 'pessimistic' because:",
        options: ["It gives higher regulation value than actual", "It gives lower regulation value than actual", "It neglects the armature resistance", "It overestimates the magnetic saturation"],
        answerText: "It gives higher regulation value than actual"
    },
    {
        question: "The MMF method is called 'optimistic' because:",
        options: ["It gives lower regulation value than actual", "It gives higher regulation value than actual", "It overestimates saturation", "It assumes zero armature resistance"],
        answerText: "It gives lower regulation value than actual"
    },
    {
        question: "Why does the EMF method yield higher regulation than the actual machine performance?",
        options: ["It neglects the effect of magnetic saturation", "It overestimates armature resistance", "It underestimates leakage reactance", "It is only valid for leading power factors"],
        answerText: "It neglects the effect of magnetic saturation"
    },
    {
        question: "In a synchronous machine, the ZPF (Potier) method is highly accurate because:",
        options: ["It treats magnetic saturation and leakage reactance separately", "It relies entirely on analytical formulas", "It neglects armature reaction", "It does not require short circuit tests"],
        answerText: "It treats magnetic saturation and leakage reactance separately"
    },
    {
        question: "The slope of the initial linear portion of the Open Circuit Characteristic (OCC) represents:",
        options: ["Air Gap Line", "Synchronous Impedance", "Short Circuit Ratio", "Armature Reactance"],
        answerText: "Air Gap Line"
    },
    {
        question: "Short Circuit Ratio (SCR) of a synchronous machine is defined as the ratio of:",
        options: ["Field current for rated Voc on open circuit to field current for rated current on short circuit", "Field current for rated current on short circuit to field current for rated Voc on open circuit", "Armature short circuit current to field current", "Open circuit phase voltage to short circuit phase current"],
        answerText: "Field current for rated Voc on open circuit to field current for rated current on short circuit"
    },
    {
        question: "The vertical leg (SP) of the Potier triangle represents:",
        options: ["Armature leakage reactance voltage drop", "Armature resistance drop", "Armature reaction MMF equivalent voltage", "Generated EMF behind leakage reactance"],
        answerText: "Armature leakage reactance voltage drop"
    },
    {
        question: "The horizontal base (projection of RS) of the Potier triangle represents:",
        options: ["Field current equivalent of armature reaction MMF", "Field current for leakage reactance drop", "No-load excitation field current", "Short circuit excitation field current"],
        answerText: "Field current equivalent of armature reaction MMF"
    },
    {
        question: "In the ZPF phasor diagram, the field current If1 and armature reaction MMF Far are added as:",
        options: ["Phasors with an angle depending on the power factor", "Scalar quantities directly", "Subtractively in all cases", "They are not combined"],
        answerText: "Phasors with an angle depending on the power factor"
    }
];

let questions = []; // Active questions sliced for the current quiz round
let currentQuestion = 0;
let score = 0;
let userAnswers = [];
let timer;
let timeLeft = 300; // 5 minutes
let askedIndices = []; // track indices of questions asked across rounds

function initQuiz() {
    // Initial setup will run when the user clicks 'Start Quiz'
    document.getElementById('btnStartQuiz').addEventListener('click', startQuiz);
    document.getElementById('btnNext').addEventListener('click', nextQuestion);
    document.getElementById('btnPrev').addEventListener('click', prevQuestion);
    document.getElementById('btnSubmit').addEventListener('click', submitQuiz);
    document.getElementById('btnRestartQuiz').addEventListener('click', restartQuiz);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQuiz);
} else {
    initQuiz();
}

// Helper to shuffle array in-place
function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function generateRoundQuestions() {
    // Filter out already asked questions
    let availableIndices = [];
    for (let i = 0; i < MASTER_QUESTIONS.length; i++) {
        if (!askedIndices.includes(i)) {
            availableIndices.push(i);
        }
    }
    
    // If we have fewer than 5 left, reset history
    if (availableIndices.length < 5) {
        askedIndices = [];
        availableIndices = MASTER_QUESTIONS.map((_, i) => i);
    }
    
    // Shuffle the available indices
    shuffle(availableIndices);
    
    // Pick 5
    const selectedIndices = availableIndices.slice(0, 5);
    
    // Add to asked list
    askedIndices.push(...selectedIndices);
    
    // Map to active questions
    questions = selectedIndices.map(idx => {
        const q = MASTER_QUESTIONS[idx];
        const optionsClone = [...q.options];
        shuffle(optionsClone);
        const correctIdx = optionsClone.indexOf(q.answerText);
        return {
            question: q.question,
            options: optionsClone,
            answer: correctIdx
        };
    });
    
    // Update total question count in UI
    document.getElementById('totalQ').textContent = questions.length;
    userAnswers = new Array(questions.length).fill(null);
}

function startQuiz() {
    document.getElementById('quiz-intro').style.display = 'none';
    document.getElementById('quiz-container').style.display = 'block';
    
    generateRoundQuestions();
    
    currentQuestion = 0;
    score = 0;
    timeLeft = 300;
    
    startTimer();
    loadQuestion();
}

function startTimer() {
    clearInterval(timer);
    timer = setInterval(() => {
        timeLeft--;
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        document.getElementById('timer').textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 60) {
            document.getElementById('timer').style.color = 'var(--danger)';
        }
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            submitQuiz();
        }
    }, 1000);
}

function loadQuestion() {
    const q = questions[currentQuestion];
    document.getElementById('currentQ').textContent = currentQuestion + 1;
    document.getElementById('questionText').textContent = q.question;
    
    const optionsContainer = document.getElementById('optionsContainer');
    optionsContainer.innerHTML = '';
    
    q.options.forEach((opt, index) => {
        const optionDiv = document.createElement('div');
        optionDiv.className = 'option-item';
        optionDiv.style = `
            padding: 15px; 
            border: 1px solid var(--border); 
            border-radius: 8px; 
            cursor: pointer; 
            transition: var(--transition);
            background-color: var(--bg-color);
        `;
        
        if (userAnswers[currentQuestion] === index) {
            optionDiv.style.borderColor = 'var(--primary)';
            optionDiv.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
        }
        
        optionDiv.innerHTML = `
            <input type="radio" name="option" id="opt${index}" value="${index}" style="margin-right: 10px; cursor: pointer;" ${userAnswers[currentQuestion] === index ? 'checked' : ''}>
            <label for="opt${index}" style="cursor: pointer; width: 100%; display: inline-block;">${opt}</label>
        `;
        
        optionDiv.addEventListener('click', () => {
            const radio = optionDiv.querySelector('input');
            radio.checked = true;
            userAnswers[currentQuestion] = index;
            
            // update visual
            document.querySelectorAll('.option-item').forEach(el => {
                el.style.borderColor = 'var(--border)';
                el.style.backgroundColor = 'var(--bg-color)';
            });
            optionDiv.style.borderColor = 'var(--primary)';
            optionDiv.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
        });
        
        optionsContainer.appendChild(optionDiv);
    });
    
    // Buttons logic
    document.getElementById('btnPrev').disabled = currentQuestion === 0;
    
    if (currentQuestion === questions.length - 1) {
        document.getElementById('btnNext').style.display = 'none';
        document.getElementById('btnSubmit').style.display = 'inline-flex';
    } else {
        document.getElementById('btnNext').style.display = 'inline-flex';
        document.getElementById('btnSubmit').style.display = 'none';
    }
    
    // Progress bar
    const progress = ((currentQuestion + 1) / questions.length) * 100;
    document.getElementById('progressBar').style.width = `${progress}%`;
}

function nextQuestion() {
    if (currentQuestion < questions.length - 1) {
        currentQuestion++;
        loadQuestion();
    }
}

function prevQuestion() {
    if (currentQuestion > 0) {
        currentQuestion--;
        loadQuestion();
    }
}

function submitQuiz() {
    clearInterval(timer);
    
    score = 0;
    userAnswers.forEach((ans, idx) => {
        if (ans === questions[idx].answer) {
            score++;
        }
    });
    
    document.getElementById('quiz-container').style.display = 'none';
    const results = document.getElementById('quiz-results');
    results.style.display = 'block';
    
    document.getElementById('scoreText').textContent = `${score} / ${questions.length}`;
    
    const percentage = (score / questions.length) * 100;
    let msg = "";
    if (percentage === 100) msg = "Perfect! Excellent understanding.";
    else if (percentage >= 80) msg = "Great job! You have a good grasp of the concepts.";
    else if (percentage >= 60) msg = "Good effort, but review the methods again.";
    else msg = "You should study the theory before attempting the experiments.";
    
    document.getElementById('scoreMessage').textContent = msg;
}

function restartQuiz() {
    document.getElementById('quiz-results').style.display = 'none';
    startQuiz();
}
