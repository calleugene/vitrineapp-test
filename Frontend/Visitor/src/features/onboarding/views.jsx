import React, {useState} from 'react';
import './onboarding.css';

const SLIDES = [
  {
    icon: (
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 9.5 12 4l8 5.5M6 10v8m4-8v8m4-8v8m4-8v8M3 20h18"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
    title: 'Откройте музей\nпо-новому',
    text: 'Витрина превращает экспонаты в интерактивные истории. Сканируйте QR — и экспонат оживёт прямо на вашем экране.',
  },
  {
    icon: (
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M4 9V5h4M20 9V5h-4M4 15v4h4M20 15v4h-4"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <rect x="8" y="8" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
        <rect x="13" y="8" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
        <rect x="8" y="13" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
        <rect x="13" y="13" width="3" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.3" />
      </svg>
    ),
    title: 'Наведите камеру\nна QR-код',
    text: 'Каждый экспонат снабжён QR-кодом. Отсканируйте — и откроется мини-история с AR-моментами и интерактивными вопросами.',
  },
  {
    icon: (
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
        <path d="m13 17 2.5 2.5L20 14" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    title: 'Собирайте\nколлекцию',
    text: 'Найденные артефакты сохраняются в личную коллекцию. Открывайте достижения и следите за прогрессом по маршруту.',
  },
];

export function OnboardingView({actions}) {
  const [step, setStep] = useState(0);
  const isLast = step === SLIDES.length - 1;

  return (
    <section className="app-view onboarding-view is-active" aria-label="Добро пожаловать">
      <div className="onboarding-body">
        <div
          className="onboarding-track"
          style={{transform: `translateX(-${step * 100}vw)`}}
        >
          {SLIDES.map((slide, i) => (
            <div key={i} className="onboarding-slide" aria-hidden={i !== step}>
              <div className="onboarding-icon" aria-hidden="true">
                {slide.icon}
              </div>
              <h1 className="onboarding-title">{slide.title}</h1>
              <p className="onboarding-text">{slide.text}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="onboarding-footer">
        <div className="onboarding-dots" aria-hidden="true">
          {SLIDES.map((_, i) => (
            <span key={i} className={`onboarding-dot ${i === step ? 'is-active' : ''}`} />
          ))}
        </div>
        <button
          className="onboarding-cta"
          type="button"
          onClick={isLast ? actions.completeOnboarding : () => setStep((s) => s + 1)}
        >
          {isLast ? 'Начать!' : 'Далее'}
        </button>
        {!isLast && (
          <button className="onboarding-skip" type="button" onClick={actions.completeOnboarding}>
            Пропустить
          </button>
        )}
      </div>
    </section>
  );
}
