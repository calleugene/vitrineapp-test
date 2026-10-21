import React from 'react';
import {UI} from '../config';
import {safeHtml} from '../html';

/* Тест: вопрос и варианты. Блокировка после ответа — часть формы, а не навигации. */
export function QuizScreen({title, text, options, quizAnswer, quizResult, correctAnswer, onAnswer}) {
  return (
    <>
      <span className="story-kicker">
        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" aria-hidden="true"><circle cx="5" cy="5" r="5" /></svg>
        {UI.quizKicker}
      </span>
      <h2 className="story-title" dangerouslySetInnerHTML={{__html: safeHtml(title)}} />
      {text && <p className="story-text">{text}</p>}
      <div className="story-quiz">
        {(options || []).map((option) => {
          let cls = 'story-quiz-btn';
          if (quizAnswer === option) {
            cls += quizResult === 'correct' ? ' is-correct' : ' is-wrong';
          } else if (quizAnswer && option === correctAnswer && quizResult === 'wrong') {
            cls += ' is-correct-reveal';
          } else if (quizAnswer) {
            cls += ' is-dim';
          }
          return (
            <button
              key={option}
              type="button"
              className={cls}
              onClick={() => onAnswer(option)}
              disabled={Boolean(quizAnswer)}
            >
              {quizAnswer && option === correctAnswer && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{flexShrink: 0}}>
                  <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
              {quizAnswer === option && quizResult === 'wrong' && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" style={{flexShrink: 0}}>
                  <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
              )}
              {option}
            </button>
          );
        })}
      </div>
    </>
  );
}
