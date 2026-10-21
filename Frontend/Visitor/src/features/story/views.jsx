import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {analyticsEvents} from '../../app/analytics-events.js';
import './story.css';
import {UI, MEDIA_LABEL, CONFETTI} from './config';
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
const QUIZ_SHAKE_MS = 550;
const VISIBLE_SLIDE_RATIO = 0.6;

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
  artifactTitle,
  imageUrl,
  exitLabel,
  feedback,
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
      return <CoverScreen title={screen.title} text={screen.text} />;

    case 'quiz':
      return (
        <QuizScreen
          title={screen.title}
          text={screen.text}
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
          artifactTitle={artifactTitle}
          imageUrl={imageUrl}
          exitLabel={exitLabel}
          feedback={feedback}
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

export function StoryExperienceView({data, navigate, actions, publicStory = null, onExit, onCollect, onTrackEvent, onTrackEventOnce, feedback, exitLabel}) {
  const scrollRef = useRef(null);
  const progressRef = useRef(null);
  const slideRefs = useRef([]);
  const [active, setActive] = useState(0);
  const [hasNavigated, setHasNavigated] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState({});
  const quizAnswer = quizAnswers[active]?.answer;
  const quizResult = quizAnswers[active]?.result;
  const quizSlideIdx = active;
  const [quizShake, setQuizShake] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [isCollected, setIsCollected] = useState(false);
  const [isCollecting, setIsCollecting] = useState(false);
  const [collectError, setCollectError] = useState('');
  const [arActive, setArActive] = useState(false);

  const story = publicStory || data?.storyData;
  const screens = useMemo(() => publicStory?.screens || buildScreensFromStory(story), [publicStory, story]);
  const count = screens.length;
  const quizIdx = screens.findIndex((screen, index) => screen.type === 'quiz' && !quizAnswers[index]);
  const quizExplanation = screens[active]?.explanation || '';
  const activeType = screens[active]?.type;
  useEffect(() => {
    const progress = progressRef.current;
    const marker = progress?.children[active];
    if (progress && marker) progress.scrollTo({top: marker.offsetTop - (progress.clientHeight - marker.clientHeight) / 2});
  }, [active]);
  const eventArtifactId = publicStory?.artifactId || data?.activeArtifactId;
  const eventPublicCode = data?.museumDetail?.artifacts?.find((artifact) => artifact.id === eventArtifactId)?.publicCode || '';
  const trackerRef = useRef(null);
  const trackerOnceRef = useRef(null);
  useEffect(() => {
    trackerRef.current = onTrackEvent || (eventPublicCode ? (type, payload) => analyticsEvents.track(type, {public_code: eventPublicCode, artifact_id: eventArtifactId, source: 'route', ...payload}) : null);
    trackerOnceRef.current = onTrackEventOnce || (eventPublicCode ? (key, type, payload) => analyticsEvents.trackOnce(`${eventPublicCode}:${key}`, type, {public_code: eventPublicCode, artifact_id: eventArtifactId, source: 'route', ...payload}) : null);
    if (eventPublicCode) analyticsEvents.trackOnce(`visit:${data?.selectedMuseumId || eventPublicCode}`, 'visit_start', {public_code: eventPublicCode, artifact_id: eventArtifactId, source: 'route'});
  }, [onTrackEvent, onTrackEventOnce, eventPublicCode, eventArtifactId, data?.selectedMuseumId]);

  useEffect(() => {
    const screen = screens[active];
    if (!screen || !eventArtifactId) return undefined;
    const screenId = screen.id;
    const artifactId = eventArtifactId;
    if (document.visibilityState === 'visible') {
      trackerOnceRef.current?.(`screen:${artifactId}:${screenId}`, 'scene_view', {screen_id: screenId});
      if (screen.type === 'final') trackerOnceRef.current?.(`complete:${artifactId}`, 'scene_complete', {});
    }
    let since = document.visibilityState === 'visible' ? performance.now() : null;
    const commit = () => {
      if (since === null) return;
      const elapsed = Math.min(15000, Math.max(0, Math.round(performance.now() - since)));
      since = document.visibilityState === 'visible' ? performance.now() : null;
      if (elapsed >= 1000) trackerRef.current?.('engagement', {screen_id: screenId, properties: {active_ms: elapsed}});
    };
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') commit();
        else {
          since = performance.now();
          trackerOnceRef.current?.(`screen:${artifactId}:${screenId}`, 'scene_view', {screen_id: screenId});
          if (screen.type === 'final') trackerOnceRef.current?.(`complete:${artifactId}`, 'scene_complete', {});
        }
    };
    const interval = window.setInterval(commit, 15000);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', commit);
    return () => {
      commit();
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', commit);
    };
  }, [active, screens, eventArtifactId]);

  const exitStory = useCallback(() => {
    if (onExit) {
      onExit();
      return;
    }
    navigate?.('museumDetail');
  }, [navigate, onExit]);

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
    if (el) scrollRef.current?.scrollTo({top: el.offsetTop, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth'});
  }, []);

  const nudgeBackToQuiz = useCallback(() => {
    if (quizIdx >= 0) scrollToSlide(quizIdx);
    setQuizShake(true);
    setTimeout(() => setQuizShake(false), QUIZ_SHAKE_MS);
  }, [quizIdx, scrollToSlide]);

  /* goNext/goPrev только прокручивают трек: активный слайд переключает
     IntersectionObserver, поэтому состояние не расходится с реальным скроллом. */
  const goNext = useCallback(() => {
    if (active < count - 1) scrollToSlide(active + 1);
  }, [active, count, scrollToSlide]);

  const goPrev = useCallback(() => {
    if (active > 0) scrollToSlide(active - 1);
  }, [active, scrollToSlide]);

  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.intersectionRatio < VISIBLE_SLIDE_RATIO) return;
          const newIdx = Number(entry.target.dataset.index);
          /* Экран сбора не открывается, пока квиз без ответа. */
          if (quizIdx >= 0 && newIdx > quizIdx) {
            nudgeBackToQuiz();
            return;
          }
          haptic(8);
          setActive(newIdx);
          if (newIdx > 0) setHasNavigated(true);
        });
      },
      {root, threshold: [VISIBLE_SLIDE_RATIO]},
    );
    slideRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, [count, quizIdx, nudgeBackToQuiz]);

  useEffect(() => {
    const onKey = (event) => {
      // Let forms, dialogs, model controls and overflowing copy keep their keys.
      const target = event.target;
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey ||
          document.querySelector('[aria-modal="true"]')) return;
      if (event.key === 'Escape') {
        exitStory();
        return;
      }
      if (target instanceof Element && target.closest('button, a, input, textarea, select, [contenteditable="true"], model-viewer')) return;
      const copy = target instanceof Element ? target.closest('.story-copy') : null;
      if (copy && copy.scrollHeight > copy.clientHeight + 1) {
        const forward = ['ArrowDown', 'PageDown', ' '].includes(event.key);
        const backward = ['ArrowUp', 'PageUp'].includes(event.key);
        if ((forward && copy.scrollTop + copy.clientHeight < copy.scrollHeight - 1) ||
            (backward && copy.scrollTop > 1)) return;
      }
      if (arActive) return;
      if (event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ') {
        event.preventDefault();
        if (activeType !== 'quiz' || quizAnswer) goNext();
      } else if (event.key === 'ArrowUp' || event.key === 'PageUp') {
        event.preventDefault();
        goPrev();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, exitStory, activeType, arActive, quizAnswer]);

  const handleQuiz = (option, idx, screen) => {
    if (quizAnswers[idx]) return;
    const isCorrect = option === screen.correctAnswer;
    setQuizAnswers((answers) => ({...answers, [idx]: {answer: option, result: isCorrect ? 'correct' : 'wrong'}}));
    trackerRef.current?.('quiz_answer', {screen_id: screen.id, properties: {correct: isCorrect}});
    haptic(isCorrect ? [10, 40, 15] : [80]);
  };

  const handleQuizContinue = () => {
    if (quizSlideIdx !== null) scrollToSlide(quizSlideIdx + 1);
  };

  const handleCollect = async () => {
    if (isCollected || isCollecting) return;
    setCollectError('');
    setIsCollecting(true);
    try {
      if (onCollect) {
        await onCollect();
      } else {
        await actions?.collectActiveArtifact?.();
      }
      setIsCollected(true);
      setShowConfetti(true);
      haptic([15, 30, 60]);
    } catch {
      setCollectError(UI.collectError);
    } finally {
      setIsCollecting(false);
    }
  };

  if (!story || count === 0) return null;

  const isQuizSlide = activeType === 'quiz';

  return (
    <section className={`app-view story-view is-active${arActive ? ' story-view--ar-active' : ''}${activeType === 'final' || activeType === 'collect' ? ' story-view--complete' : ''}`} aria-label="История артефакта">
      <span className="story-sr-only" role="status" aria-live="polite">Экран {active + 1} из {count}</span>
      <div className="story-topbar" data-chapter={activeType}>
        {(activeType === 'final' || activeType === 'collect') && active > 0 && (
          <button className="story-back-to-content" type="button" onClick={goPrev}>
            <span aria-hidden="true">↑</span> К истории
          </button>
        )}
        <nav className="story-progress" ref={progressRef} aria-label="Экраны истории">
          {screens.map((screen, idx) => {
            const isLocked = quizIdx >= 0 && idx > quizIdx;
            return (
              <button
                key={idx}
                type="button"
                className={`story-progress-seg story-progress-seg--${screen.type}${idx === active ? ' is-active' : ''}${idx < active ? ' is-done' : ''}${isLocked ? ' is-locked' : ''}`}
                onClick={() => {
                  if (isLocked) { nudgeBackToQuiz(); return; }
                  scrollToSlide(idx);
                }}
                aria-current={idx === active ? 'step' : undefined}
                aria-disabled={isLocked || undefined}
                aria-label={`${UI.screen(idx)} из ${count}${isLocked ? ', сначала ответьте на вопрос' : ''}`}
              />
            );
          })}
        </nav>
        <div className="story-topbar-row">
          <button className="story-close" type="button" onClick={exitStory} aria-label={UI.closeStory}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </div>

      {/* Native vertical scroll keeps the slide attached to the gesture. */}
      <div className={`story-scroll${arActive ? ' ar-locked' : ''}`} ref={scrollRef}>
        {screens.map((screen, idx) => {
          const isArSlide = screen.type === 'ar';
          const hideForAr = isArSlide && arActive;
          return (
            <article
              key={idx}
              className={`story-slide${idx === active ? ' is-active' : ''} story-slide--${screen.type} story-slide--n${idx}${screen.type === 'quiz' && quizShake ? ' is-shaking' : ''}`}
              data-index={idx}
              inert={idx !== active}
              ref={(el) => { slideRefs.current[idx] = el; }}
            >
              <SlideMedia screen={screen} onArInteraction={handleArInteraction} />
              <div className={`story-scrim${hideForAr ? ' is-ar-hidden' : ''}`} aria-hidden="true" />

              <div className={`story-content${hideForAr ? ' is-ar-hidden' : ''}`}>
                <div className="story-copy" tabIndex={idx === active && !hideForAr ? 0 : -1} role="region" aria-label="Содержание экрана">
                <ScreenContent
                  screen={screen}
                  artifactTitle={screens[0]?.title}
                  imageUrl={screens.find((item) => item.imageUrl)?.imageUrl}
                  exitLabel={exitLabel}
                  feedback={feedback}
                  quizAnswer={quizAnswers[idx]?.answer}
                  quizResult={quizAnswers[idx]?.result}
                  onAnswer={(option) => handleQuiz(option, idx, screen)}
                  onArActivate={activateAR}
                  isCollected={isCollected}
                  isCollecting={isCollecting}
                  collectError={collectError}
                  onCollect={handleCollect}
                  onExit={exitStory}
                />
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {/* Выход из AR-режима — показывается только на AR-слайде */}
      {activeType === 'ar' && arActive && (
        <button className="story-ar-exit-btn" type="button" onClick={deactivateAr} aria-label={UI.finishInteraction}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
          {UI.arExitButton}
        </button>
      )}

      {!hasNavigated && active === 0 && count > 1 && !isQuizSlide && !arActive && (
        <div className="story-swipe-hint" aria-hidden="true">
          <span>Листайте вниз</span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M12 4v16m-6-6 6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
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

