import React, {useCallback, useEffect, useRef, useState} from 'react';
import './story.css';
import {SCREEN_LABELS, SCREEN_LABEL, UI, MEDIA_LABEL, CONFETTI} from './config';
import {stripHtmlTags} from './html';
import {haptic} from './haptics';
import {useArIdle} from './useArIdle';
import {SlideMedia} from './screens/media';
import {CoverScreen} from './screens/cover';
import {FactScreen} from './screens/fact';
import {ArScreen} from './screens/ar';
import {QuizScreen} from './screens/quiz';
import {CollectScreen} from './screens/collect';

const AR_IDLE_MS = 3000;
const COLLECT_DELAY_MS = 620;
const QUIZ_SHAKE_MS = 550;
const VISIBLE_SLIDE_RATIO = 0.6;

function screenLabel(screen, index, isPublicStory) {
  if (!screen) return SCREEN_LABEL.default;
  if (isPublicStory) {
    if (screen.type === 'cover') return SCREEN_LABEL.cover;
    if (screen.type === 'final') return SCREEN_LABEL.final;
    return SCREEN_LABEL.default;
  }
  return SCREEN_LABELS[index] || SCREEN_LABEL.default;
}

/* Обложка и экран сбора — обвязка истории, а не контент методиста.
   Между ними лежат слайды, которые методист собирает сам: факты, 3D, тест. */
function buildScreensFromStory(story) {
  if (!story) return [];
  return [
    {
      type: 'cover',
      media: 'image',
      mediaLabel: MEDIA_LABEL.image.cover,
      imageUrl: story.coverImage || '',
      title: story.coverTitle,
      text: stripHtmlTags(story.coverSubtitle),
    },
    {
      type: 'fact',
      media: 'image',
      mediaLabel: MEDIA_LABEL.image.fact,
      imageUrl: story.factOneImage || '',
      title: story.factOneTitle,
      text: stripHtmlTags(story.factOneText),
      note: stripHtmlTags(story.factOneNote),
    },
    {
      type: 'fact',
      media: 'image',
      mediaLabel: MEDIA_LABEL.image.fact,
      imageUrl: story.factTwoImage || '',
      title: story.factTwoTitle,
      text: stripHtmlTags(story.factTwoText),
      note: stripHtmlTags(story.factTwoNote),
    },
    {
      type: 'ar',
      media: 'ar',
      mediaLabel: MEDIA_LABEL.ar.default,
      modelUrl: story.arModel || '',
      title: stripHtmlTags(story.arTitle),
      text: stripHtmlTags(story.arText),
    },
    {
      type: 'quiz',
      media: 'none',
      title: stripHtmlTags(story.quizQuestion),
      options: ['Да', 'Нет'],
      correctAnswer: story.quizCorrectAnswer || 'Нет',
      explanation: stripHtmlTags(story.explainTitle),
    },
    {
      type: 'final',
      media: 'none',
      badge: 'star',
      title: stripHtmlTags(story.finalTitle),
      text: stripHtmlTags(story.finalText),
    },
  ];
}

function Confetti({onDone}) {
  const [particles] = useState(() =>
    Array.from({length: CONFETTI.particleCount}, (_, i) => {
      const angle = (i / CONFETTI.particleCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const dist = 70 + Math.random() * 120;
      return {
        id: i,
        dx: Math.round(Math.cos(angle) * dist),
        dy: Math.round(Math.sin(angle) * dist - 80),
        rot: Math.round(Math.random() * 720 - 360),
        color: CONFETTI.colors[i % CONFETTI.colors.length],
        size: 5 + Math.floor(Math.random() * 7),
        delay: (Math.random() * 0.2).toFixed(2),
        isRect: i % 3 === 0,
      };
    }),
  );

  useEffect(() => {
    const timer = setTimeout(onDone, CONFETTI.durationMs);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="confetti-burst" aria-hidden="true">
      {particles.map((particle) => (
        <span
          key={particle.id}
          className="confetti-dot"
          style={{
            '--dx': `${particle.dx}px`,
            '--dy': `${particle.dy}px`,
            '--rot': `${particle.rot}deg`,
            '--color': particle.color,
            '--delay': `${particle.delay}s`,
            width: `${particle.size}px`,
            height: particle.isRect ? `${Math.round(particle.size * 0.5)}px` : `${particle.size}px`,
            borderRadius: particle.isRect ? '2px' : '50%',
          }}
        />
      ))}
    </div>
  );
}

/* Форма контента по типу экрана. Оркестратор знает только про типы,
   сами формы живут в ./screens и не управляют навигацией. */
function ScreenContent({
  screen,
  artifactNumber,
  quizAnswer,
  quizResult,
  onAnswer,
  onArActivate,
  isCollected,
  isCollecting,
  collectError,
  onCollect,
  onExit,
}) {
  switch (screen.type) {
    case 'cover':
      return <CoverScreen artifactNumber={artifactNumber} title={screen.title} text={screen.text} />;

    case 'quiz':
      return (
        <QuizScreen
          title={screen.title}
          options={screen.options}
          quizAnswer={quizAnswer}
          quizResult={quizResult}
          correctAnswer={screen.correctAnswer}
          onAnswer={onAnswer}
        />
      );

    case 'ar':
      return <ArScreen title={screen.title} text={screen.text} onActivate={onArActivate} />;

    /* 'final' приходит из публичной истории, 'collect' — имя типа для будущих сценариев. */
    case 'final':
    case 'collect':
      return (
        <CollectScreen
          badge={screen.badge}
          title={screen.title}
          text={screen.text}
          isCollected={isCollected}
          isCollecting={isCollecting}
          collectError={collectError}
          onCollect={onCollect}
          onExit={onExit}
        />
      );

    case 'fact':
    default:
      return <FactScreen title={screen.title} text={screen.text} note={screen.note} />;
  }
}

export function StoryExperienceView({data, navigate, actions, publicStory = null, onExit, onCollect}) {
  const scrollRef = useRef(null);
  const slideRefs = useRef([]);
  const [active, setActive] = useState(0);
  const [quizAnswer, setQuizAnswer] = useState(null);
  const [quizResult, setQuizResult] = useState(null);
  const [quizSlideIdx, setQuizSlideIdx] = useState(null);
  const [quizExplanation, setQuizExplanation] = useState('');
  const [quizShake, setQuizShake] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isCollected, setIsCollected] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectError, setCollectError] = useState('');
  const [arActive, setArActive] = useState(false);

  const story = publicStory || data?.storyData;
  const screens = publicStory?.screens || buildScreensFromStory(story);
  const count = screens.length;
  const quizIdx = screens.findIndex((screen) => screen.type === 'quiz');
  const activeType = screens[active]?.type;

  const exitStory = useCallback(() => {
    if (onExit) {
      onExit();
      return;
    }
    navigate?.('museumDetail');
  }, [navigate, onExit]);

  /* «Артефакт №N» показываем только внутри истории музея. */
  const artifactNumber = (() => {
    const artifacts = data?.artifactDetail?.artifacts;
    if (!artifacts || !data?.activeArtifactId) return null;
    const idx = artifacts.findIndex((artifact) => artifact.id === data.activeArtifactId);
    return idx >= 0 ? idx + 1 : null;
  })();

  /* Свежий ответ квиза нужен observer-у без пересоздания инстанса. */
  const quizAnswerRef = useRef(null);
  useEffect(() => { quizAnswerRef.current = quizAnswer; }, [quizAnswer]);

  const {activate: activateArIdle, reset: resetArIdle, deactivate: deactivateAr} = useArIdle({
    onDeactivate: () => setArActive(false),
    idleMs: AR_IDLE_MS,
  });

  /* AR-режим включает оркестратор, хук лишь держит idle-таймер. */
  const activateAR = useCallback(() => {
    setArActive(true);
    activateArIdle();
  }, [activateArIdle]);

  /* Касания модели продлевают AR-режим только пока он включён. */
  const handleArInteraction = useCallback(() => {
    if (arActive) resetArIdle();
  }, [arActive, resetArIdle]);

  /* AR-режим существует только на AR-слайде. */
  useEffect(() => {
    if (activeType !== 'ar') deactivateAr();
  }, [activeType, deactivateAr]);

  const scrollToSlide = useCallback((idx) => {
    const el = slideRefs.current[idx];
    if (el) el.scrollIntoView({behavior: 'smooth', block: 'start'});
  }, []);

  const nudgeBackToQuiz = useCallback(() => {
    if (quizIdx >= 0) scrollToSlide(quizIdx);
    setQuizShake(true);
    setTimeout(() => setQuizShake(false), QUIZ_SHAKE_MS);
  }, [quizIdx, scrollToSlide]);

  /* goNext/goPrev только прокручивают трек: активный слайд переключает
     IntersectionObserver, поэтому состояние не расходится с реальным скроллом. */
  const goNext = useCallback(() => {
    setActive((current) => {
      if (current < count - 1) scrollToSlide(current + 1);
      return current;
    });
  }, [count, scrollToSlide]);

  const goPrev = useCallback(() => {
    setActive((current) => {
      if (current > 0) scrollToSlide(current - 1);
      return current;
    });
  }, [scrollToSlide]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < VISIBLE_SLIDE_RATIO) return;
          const newIdx = Number(entry.target.dataset.index);
          /* Экран сбора не открывается, пока квиз без ответа. */
          if (quizIdx >= 0 && newIdx > quizIdx && !quizAnswerRef.current) {
            nudgeBackToQuiz();
            return;
          }
          haptic(8);
          setActive(newIdx);
        });
      },
      {root, threshold: [VISIBLE_SLIDE_RATIO]},
    );
    slideRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [count, quizIdx, nudgeBackToQuiz]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        if (activeType !== 'quiz') goNext();
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        goPrev();
      } else if (event.key === 'Escape') {
        exitStory();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, exitStory, activeType]);

  const handleQuiz = (option, idx, screen) => {
    if (quizAnswer) return;
    const isCorrect = option === screen.correctAnswer;
    setQuizAnswer(option);
    setQuizResult(isCorrect ? 'correct' : 'wrong');
    setQuizSlideIdx(idx);
    setQuizExplanation(screen.explanation || '');
    actions?.trackEvent?.('quiz_answer', {
      artifact_id: data?.activeArtifactId,
      answer: option,
      correct: isCorrect,
    });
    haptic(isCorrect ? [10, 40, 15] : [80]);
  };

  const handleQuizContinue = () => {
    if (quizSlideIdx !== null) scrollToSlide(quizSlideIdx + 1);
  };

  const handleCollect = async () => {
    if (isCollected || isCollecting) return;
    haptic([15, 30, 15, 30, 60]);
    setCollectError('');
    setIsCollecting(true);
    setShowConfetti(true);
    /* Небольшая задержка, чтобы конфетти успело вылететь до ответа API. */
    await new Promise((resolve) => setTimeout(resolve, COLLECT_DELAY_MS));
    try {
      if (onCollect) {
        await onCollect();
      } else {
        actions?.trackEvent?.('scene_complete', {artifact_id: data?.activeArtifactId});
        await actions?.collectActiveArtifact?.();
      }
      setIsCollected(true);
    } catch {
      setCollectError(UI.collectError);
    } finally {
      setIsCollecting(false);
    }
  };

  if (!story || count === 0) return null;

  const isQuizSlide = activeType === 'quiz';

  return (
    <section className={`app-view story-view is-active${arActive ? ' story-view--ar-active' : ''}`} aria-label="История артефакта">
      {/* Прогресс + верхняя панель */}
      <div className="story-topbar" data-chapter={activeType}>
        <div className="story-progress" aria-hidden="true">
          {screens.map((screen, idx) => {
            const isLocked = quizIdx >= 0 && idx > quizIdx && !quizAnswer;
            return (
              <button
                key={idx}
                type="button"
                className={`story-progress-seg story-progress-seg--${screen.type}${idx === active ? ' is-active' : ''}${idx < active ? ' is-done' : ''}${isLocked ? ' is-locked' : ''}`}
                onClick={() => {
                  if (isLocked) { nudgeBackToQuiz(); return; }
                  scrollToSlide(idx);
                }}
                tabIndex={-1}
                aria-label={UI.screen(idx)}
              />
            );
          })}
        </div>
        <div className="story-topbar-row">
          <span className="story-badge">{active + 1}<span className="story-badge-sep">/</span>{count}</span>
          <span className={`story-label story-label--${activeType}`}>
            <span className={`story-type-dot story-type-dot--${activeType}`} aria-hidden="true" />
            {screenLabel(screens[active], active, Boolean(publicStory))}
          </span>
          <button className="story-close" type="button" onClick={exitStory} aria-label={UI.closeStory}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Скролл-трек: медиа-слот, затем зоны тапа, затем форма контента. */}
      <div className={`story-scroll${arActive ? ' ar-locked' : ''}`} ref={scrollRef}>
        {screens.map((screen, idx) => {
          const isArSlide = screen.type === 'ar';
          const isFinalSlide = screen.type === 'final' || screen.type === 'collect';
          const hideForAr = isArSlide && arActive;
          return (
            <article
              key={idx}
              className={`story-slide${idx === active ? ' is-active' : ''} story-slide--${screen.type} story-slide--n${idx}${screen.type === 'quiz' && quizShake ? ' is-shaking' : ''}`}
              data-index={idx}
              ref={(el) => { slideRefs.current[idx] = el; }}
            >
              <SlideMedia screen={screen} onArInteraction={handleArInteraction} />
              <div className={`story-scrim${hideForAr ? ' is-ar-hidden' : ''}`} aria-hidden="true" />

              {/* Зоны тапа: quiz отдаёт навигацию кнопкам, активный AR и финал —
                  весь экран своим действиям. */}
              {screen.type !== 'quiz' && !hideForAr && (
                <div className="story-tap-prev" onClick={goPrev} aria-hidden="true" />
              )}
              {screen.type !== 'quiz' && !isArSlide && !isFinalSlide && (
                <div className="story-tap-next" onClick={goNext} aria-hidden="true" />
              )}

              <div className={`story-content${hideForAr ? ' is-ar-hidden' : ''}`}>
                <ScreenContent
                  screen={screen}
                  artifactNumber={artifactNumber}
                  quizAnswer={quizAnswer}
                  quizResult={quizResult}
                  onAnswer={(option) => handleQuiz(option, idx, screen)}
                  onArActivate={activateAR}
                  isCollected={isCollected}
                  isCollecting={isCollecting}
                  collectError={collectError}
                  onCollect={handleCollect}
                  onExit={exitStory}
                />
              </div>
            </article>
          );
        })}
      </div>

      {/* Выход из AR-режима — показывается только на AR-слайде */}
      {activeType === 'ar' && (
        <button className="story-ar-exit-btn" type="button" onClick={deactivateAr} aria-label={UI.finishInteraction}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          {UI.arExitButton}
        </button>
      )}

      {/* Подсказка «свайп вверх» */}
      {active < count - 1 && !isQuizSlide && !arActive && (
        <button className="story-next" type="button" onClick={goNext} aria-label={UI.nextScreen}>
          <span className="story-next-pulse" aria-hidden="true" />
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m6 15 6-6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {active === 0 && <span className="story-next-label">{UI.swipeUp}</span>}
        </button>
      )}

      {/* Фидбек квиза: панель уровня страницы, а не слайда */}
      {quizResult && active === quizSlideIdx && (
        <div className={`story-quiz-feedback story-quiz-feedback--${quizResult}`}>
          <div className="sqf-header">
            <span className="sqf-icon" aria-hidden="true">
              {quizResult === 'correct' ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="m5 12 4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
                </svg>
              )}
            </span>
            <strong className="sqf-title">
              {quizResult === 'correct' ? UI.quizCorrect : UI.quizWrong}
            </strong>
          </div>
          {quizExplanation && <p className="sqf-text">{quizExplanation}</p>}
          <button className="sqf-continue" type="button" onClick={handleQuizContinue}>
            {UI.quizContinue}
          </button>
        </div>
      )}

      {showConfetti && <Confetti onDone={() => setShowConfetti(false)} />}
    </section>
  );
}

