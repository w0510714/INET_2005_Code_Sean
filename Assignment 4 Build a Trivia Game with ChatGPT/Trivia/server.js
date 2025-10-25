const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const { render } = require('ejs');

dotenv.config();

const app = express();
const port = 3001;

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// State
let triviaQuestions = [];
let maxTriviaQuestions = 100;
let userScore = {};
let questionNumber = {};

// Function to store trivia question and answer - unsure if this is doing anything
function storeTriviaQuestion(question, answer) {
  const exists = triviaQuestions.some(q => q.question === question);
  if (exists) return; // This Avoids the duplicates

  triviaQuestions.push({ question, answer });

  if (triviaQuestions.length > maxTriviaQuestions) {
    triviaQuestions.shift(); // Remove oldest
  }
}

// Tracking current questions and answers
let currentQuestion = null;
let currentAnswer = null;

// A Function to update the user's score
function updateUserScore(userId, correct) {
  if (!userScore[userId]) userScore[userId] = 0;
  if (correct) userScore[userId] += 1;
}

// A Function to update the question number
function updateQuestionNumber(userId) {
  if (!questionNumber[userId]) questionNumber[userId] = 0;
  questionNumber[userId] += 1;
}

// Helper function to render chat with defaults
function renderChat(res, overrides = {}) {
  const defaults = {
    response: null,
    question: null,
    answer: null,
    userAnswer: null,
    correct: null,
    error: null
  };
  return res.render('chat', { ...defaults, ...overrides });
}

// All my get and post routes
app.get('/', (req, res) => {
  res.render('start_screen', { response: null });
});

app.get('/game', (req, res) => {
  renderChat(res);
});

app.get('/question', async (req, res) => {
  try {
    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content:
              'You are a trivia generator. Reply with exactly one question and its answer in this format:\nQuestion: <question text>\nAnswer: <answer text>'
          },
          { role: 'user', content: 'Generate one trivia question and its answer.' }
        ],
        max_tokens: 200,
        temperature: 0.7
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        }
      }
    );

    // AI Assisted with the OpenAI response parsing
    const text = (response.data?.choices?.[0]?.message?.content || '').trim();

    const match = text.match(/Question:\s*([\s\S]*?)\s*Answer:\s*([\s\S]*)/i);
    let question = null;
    let answer = null;

    if (match) {
      question = match[1].trim();
      answer = match[2].trim();
    } else {
      // fallback if OpenAI formats differently
      const parts = text.split(/Answer:/i);
      if (parts.length >= 2) {
        question = parts[0].replace(/Question:/i, '').trim();
        answer = parts.slice(1).join('Answer:').trim();
      }
    }

    if (!question || !answer) {
      console.error('Failed to parse QA from OpenAI response:', text);
      return res.status(500).json({ error: 'Could not parse question/answer from AI response' });
    }

    storeTriviaQuestion(question, answer);
    currentQuestion = question;
    currentAnswer = answer;

    return renderChat(res, { question });
  } catch (err) {
    console.error('Error fetching trivia question from OpenAI:', err?.response?.data || err.message || err);

    // fallback to stored question
    if (triviaQuestions.length > 0) {
      const randomIndex = Math.floor(Math.random() * triviaQuestions.length);
      const { question } = triviaQuestions[randomIndex];
      return renderChat(res, { question });
    }

    return res.status(500).json({ error: 'Unable to get trivia question' });
  }
});

app.post('/answer', (req, res) => {
  const userAnswer = req.body.answer;
  const userId = req.body.userId || 'default';

  if (!currentQuestion || !currentAnswer) {
    return renderChat(res, {
      question: 'Please get a new question first!',
      error: 'No active question found'
    });
  }

  const correct = userAnswer.toLowerCase().trim() === currentAnswer.toLowerCase().trim();

  if (correct) updateUserScore(userId, true);
  updateQuestionNumber(userId);

  return renderChat(res, {
    question: currentQuestion,
    answer: currentAnswer,
    userAnswer,
    correct
  });
});

app.get('/score', (req, res) => {
  const userId = req.query.userId || 'default';
  return res.json({
    score: userScore[userId] || 0,
    questionsAnswered: questionNumber[userId] || 0
  });
});

app.listen(port, () => {
  console.log(`✅ Server is running on http://localhost:${port}`);
});