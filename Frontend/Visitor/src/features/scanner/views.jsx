import React, {useEffect, useRef, useState} from 'react';
import {BackButton} from '../../components/ui.jsx';
import './scanner.css';

const DEMO_SEQUENCE = ['0', '0', '2', '0', '1'];
const IDLE_MS       = 5000;
const DEMO_ON_MS    = 340;
const DEMO_OFF_MS   = 130;

/* ---- Secret code entry view ---- */
export function SecretCodeView({data, navigate, actions}) {
  const [digits, setDigits]   = useState(['', '', '', '', '']);
  const [error, setError]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoKey, setDemoKey] = useState(null);

  const idleRef  = useRef(null);
  const demoRef  = useRef(null);
  const aliveRef = useRef(true);

  const museum         = data.museumDetail;
  const activeArtifact = museum?.artifacts?.find((a) => a.id === data.activeArtifactId);
  const filledCount    = digits.filter((d) => d !== '').length;
  const isComplete     = filledCount === 5;

  /* ── Demo playback ── */
  const stopDemo = () => {
    clearTimeout(demoRef.current);
    setDemoKey(null);
  };

  const playDemo = () => {
    if (!aliveRef.current) return;
    let i = 0;
    const step = () => {
      if (!aliveRef.current) return;
      if (i >= DEMO_SEQUENCE.length) {
        setDemoKey(null);
        demoRef.current = setTimeout(playDemo, 1200);
        return;
      }
      setDemoKey(DEMO_SEQUENCE[i]);
      demoRef.current = setTimeout(() => {
        setDemoKey(null);
        i++;
        demoRef.current = setTimeout(step, DEMO_OFF_MS);
      }, DEMO_ON_MS);
    };
    step();
  };

  const resetIdle = () => {
    clearTimeout(idleRef.current);
    stopDemo();
    idleRef.current = setTimeout(playDemo, IDLE_MS);
  };

  useEffect(() => {
    aliveRef.current = true;
    resetIdle();
    return () => {
      aliveRef.current = false;
      clearTimeout(idleRef.current);
      clearTimeout(demoRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Handlers ── */
  const handleKey = (key) => {
    resetIdle();
    if (filledCount >= 5) return;
    setError(false);
    const next = [...digits];
    next[filledCount] = key;
    setDigits(next);
  };

  const handleBackspace = () => {
    resetIdle();
    if (filledCount === 0) return;
    setError(false);
    const next = [...digits];
    next[filledCount - 1] = '';
    setDigits(next);
  };

  const handleReset = () => {
    resetIdle();
    setDigits(['', '', '', '', '']);
    setError(false);
  };

  const handleSubmit = async () => {
    if (!isComplete || loading) return;
    setLoading(true);
    const result = await actions.enterSecretCode(digits.join(''));
    if (!result.success) {
      setError(true);
      setLoading(false);
      setDigits(['', '', '', '', '']);
      resetIdle();
    }
  };

  return (
    <section className="app-view app-shell secret-code-view is-active" aria-label="Ввод кода экспоната">
      <div className="sc-screen">

        {/* Top bar */}
        <header className="sc-header">
          <BackButton onClick={() => navigate('museumDetail')} label="Назад" />
          <div className="sc-header-title">
            {activeArtifact && <span className="sc-header-artifact">{activeArtifact.title}</span>}
            {museum?.name  && <span className="sc-header-museum">{museum.name}</span>}
          </div>
          <button className="sc-reset-btn" type="button" aria-label="Сбросить код" onClick={handleReset}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </header>

        {/* Middle: display + keypad */}
        <div className="sc-middle">

          {/* Display — tap anywhere to erase last digit */}
          <div className="sc-code-section">
            <span className="sc-code-label">ВВЕДЁННЫЙ КОД</span>
            <div
              className={`sc-inputs${error ? ' is-error' : ''}`}
              role="button"
              tabIndex={0}
              aria-label="Удалить последнюю цифру"
              onClick={handleBackspace}
              onKeyDown={(e) => { if (e.key === 'Backspace' || e.key === 'Delete') handleBackspace(); }}
            >
              {digits.map((d, i) => (
                <div
                  key={i}
                  className={`sc-digit${d ? ' is-filled' : ''}${error ? ' is-error' : ''}`}
                >
                  {d}
                </div>
              ))}
            </div>
            {error && <p className="sc-error" role="alert">Неверный код. Проверьте ярлык экспоната.</p>}
          </div>

          {/* Functional keypad */}
          <div className="sc-illustration" aria-label="Числовая клавиатура">
            <div className="sc-keypad-grid">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`sc-key${demoKey === String(n) ? ' sc-key--demo' : ''}`}
                  onClick={() => handleKey(String(n))}
                  aria-label={String(n)}
                >
                  {n}
                </button>
              ))}
              {/* Bottom row: spacer · 0 · backspace */}
              <div className="sc-key-spacer" aria-hidden="true" />
              <button
                type="button"
                className={`sc-key${demoKey === '0' ? ' sc-key--demo' : ''}`}
                onClick={() => handleKey('0')}
                aria-label="0"
              >
                0
              </button>
              <button
                type="button"
                className="sc-key sc-key-del"
                onClick={handleBackspace}
                aria-label="Удалить"
              >
                <svg width="20" height="16" viewBox="0 0 24 18" fill="none" aria-hidden="true">
                  <path d="M9 3H21a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9L2 9l7-6Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
                  <path d="m14 7 4 4m0-4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
          </div>

        </div>

        {/* Bottom: prompt + actions */}
        <div className="sc-bottom">
          <div className="sc-prompt">
            <h2 className="sc-prompt-title">Введите код с этикетки</h2>
            <p className="sc-prompt-text">5-значный код нанесён на ярлык рядом с экспонатом</p>
          </div>
          <div className="sc-actions">
            <button
              className="sc-submit"
              type="button"
              disabled={!isComplete || loading}
              onClick={handleSubmit}
            >
              {loading ? 'Проверяем…' : 'Открыть историю'}
            </button>
            <button className="sc-skip" type="button" onClick={() => navigate('museumDetail')}>
              Вернуться к экспонатам
            </button>
          </div>
        </div>

      </div>
    </section>
  );
}

export function QrScannerView({navigate, actions}) {
  const videoRef = useRef(null);
  const {resolveQrResult} = actions;
  const [phase, setPhase] = useState('priming');
  const [status, setStatus] = useState({
    title: 'Наведите камеру на QR-код',
    text: 'Держите код внутри рамки 1–2 секунды. После распознавания история откроется автоматически.',
  });

  useEffect(() => {
    if (phase !== 'scanning') return;
    const videoElement = videoRef.current;
    let stream = null;
    let detector = null;
    let raf = null;
    let locked = false;
    let active = true;

    const stopStream = () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        stream = null;
      }
    };

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus({title: 'Камера недоступна', text: 'В этом браузере нельзя открыть камеру. Можно продолжить вручную, чтобы проверить сценарий.'});
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: 'environment'}}, audio: false});
        if (!active) {
          stopStream();
          return;
        }
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
      } catch {
        setStatus({title: 'Не удалось открыть камеру', text: 'Проверьте разрешение на доступ к камере. Для прототипа можно продолжить вручную.'});
        return;
      }

      if (!('BarcodeDetector' in window)) {
        setStatus({title: 'Камера включена', text: 'Автораспознавание QR не поддерживается в этом браузере. Для демо можно продолжить вручную.'});
        return;
      }
      try {
        detector = new window.BarcodeDetector({formats: ['qr_code']});
      } catch {
        setStatus({title: 'Камера включена', text: 'Распознавание QR здесь недоступно. Для демо можно продолжить вручную.'});
        return;
      }

      const scanFrame = async () => {
        const video = videoRef.current;
        if (locked || !detector || !video || video.readyState < 2) {
          raf = requestAnimationFrame(scanFrame);
          return;
        }
        try {
          const codes = await detector.detect(video);
          if (codes.length) {
            locked = true;
            setStatus({title: 'QR-код считан', text: 'Экспонат найден. Переходим к экрану артефакта.'});
            setTimeout(() => {
              if (active) resolveQrResult(codes[0].rawValue || '');
            }, 420);
            return;
          }
        } catch {
          setStatus({title: 'Камера включена', text: 'Сканирование работает нестабильно в этом браузере. Можно продолжить вручную.'});
        }
        raf = requestAnimationFrame(scanFrame);
      };
      raf = requestAnimationFrame(scanFrame);
    }

    start();
    return () => {
      active = false;
      if (raf) cancelAnimationFrame(raf);
      stopStream();
      if (videoElement) {
        videoElement.pause();
        videoElement.srcObject = null;
      }
    };
  }, [resolveQrResult, phase]);

  if (phase === 'priming') {
    return (
      <section className="app-view qr-scanner-view is-active" aria-label="Доступ к камере">
        <div className="camera-priming">
          <div className="camera-priming-icon" aria-hidden="true">
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none">
              <path
                d="M14.5 4H9.5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3L14.5 4Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="12" cy="13" r="3.5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
          </div>
          <h2 className="camera-priming-title">Разрешите доступ к камере</h2>
          <p className="camera-priming-text">
            Для сканирования QR-кодов нужен доступ к камере. Нажмите «Разрешить» — браузер
            запросит подтверждение.
          </p>
          <button className="primary-button app-cta" type="button" onClick={() => setPhase('scanning')}>
            Разрешить доступ к камере
          </button>
          <button className="text-button" type="button" onClick={() => navigate('museumDetail')}>
            Пропустить
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="app-view qr-scanner-view is-active" aria-label="Сканирование QR-кода">
      <div className="qr-scanner-screen">
        <div className="qr-video-shell">
          <video className="qr-video" ref={videoRef} autoPlay playsInline muted />
          <div className="qr-overlay" aria-hidden="true" />
          <div className="qr-frame" aria-hidden="true">
            <div className="qr-scanline" aria-hidden="true" />
          </div>

          <div className="qr-topbar">
            <button className="icon-button" type="button" onClick={() => navigate('museumDetail')} aria-label="Закрыть сканер">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m15 5-7 7 7 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button className="icon-button" type="button" aria-label="Подсказка по сканированию">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 17v-6M12 8h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </div>

          <div className="qr-bottom">
            <div className="qr-status-card">
              <h2>{status.title}</h2>
              <p>{status.text}</p>
            </div>
            <button className="tech-button" type="button" onClick={() => resolveQrResult('')}>
              Открыть найденный артефакт вручную
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
