import React, {useEffect, useRef, useState} from 'react';
import {BackButton} from '../../components/ui.jsx';
import './scanner.css';

/* Code entry supports the on-screen keypad, keyboard and clipboard. */
export function SecretCodeView({data, navigate, actions}) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);
  const submittingRef = useRef(false);

  const museum = data.museumDetail;
  const digits = Array.from({length: 5}, (_, i) => code[i] || '');
  const isComplete = code.length === 5;

  const updateCode = (value) => {
    if (submittingRef.current) return;
    setCode(value.replace(/[^0-9]/g, '').slice(0, 5));
    setError('');
  };

  const handleKey = (key) => updateCode(code + key);
  const handleBackspace = () => updateCode(code.slice(0, -1));
  const handleReset = () => {
    updateCode('');
    inputRef.current?.focus();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!isComplete || submittingRef.current) return;
    submittingRef.current = true;
    setLoading(true);
    setError('');
    try {
      const result = await actions.enterSecretCode(code);
      if (!result.success) {
        setError('Код не найден в этом музее. Проверьте цифры на этикетке.');
        inputRef.current?.focus();
      }
    } catch {
      setError('Не удалось открыть историю. Проверьте соединение и попробуйте ещё раз.');
    } finally {
      submittingRef.current = false;
      setLoading(false);
    }
  };

  return (
    <section className="app-view app-shell secret-code-view is-active" aria-label="Ввод кода экспоната">
      <form className="sc-screen" onSubmit={handleSubmit} aria-busy={loading}>

        {/* Top bar */}
        <header className="sc-header">
          <BackButton onClick={() => navigate('museumDetail')} label="Назад" />
          <div className="sc-header-title">
            <span className="sc-header-artifact">Открыть историю</span>
            {museum?.name  && <span className="sc-header-museum">{museum.name}</span>}
          </div>
          <button className="sc-reset-btn" type="button" aria-label="Сбросить код" disabled={loading || !code} onClick={handleReset}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M3 3v5h5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </header>

        {/* Middle: display + keypad */}
        <div className="sc-middle">

          <div className="sc-code-section">
            <label className="sc-code-label" htmlFor="exhibit-code">КОД ЭКСПОНАТА</label>
            <div className={`sc-inputs${error ? ' is-error' : ''}`}>
              <input
                ref={inputRef}
                id="exhibit-code"
                className="sc-code-input"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={code}
                readOnly={loading}
                onChange={(event) => updateCode(event.target.value)}
                onPaste={(event) => {
                  event.preventDefault();
                  updateCode(event.clipboardData.getData('text'));
                }}
                aria-describedby={`code-hint${error ? ' code-error' : ''}`}
                aria-invalid={Boolean(error)}
              />
              {digits.map((digit, i) => (
                <div key={i} aria-hidden="true" className={`sc-digit${digit ? ' is-filled' : ''}${error ? ' is-error' : ''}`}>
                  {digit}
                </div>
              ))}
            </div>
            {error && <p id="code-error" className="sc-error" role="alert">{error}</p>}
          </div>

          {/* Functional keypad */}
          <div className="sc-illustration" aria-label="Числовая клавиатура">
            <div className="sc-keypad-grid">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                <button
                  key={n}
                  type="button"
                  className="sc-key" disabled={loading || isComplete}
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
                className="sc-key" disabled={loading || isComplete}
                onClick={() => handleKey('0')}
                aria-label="0"
              >
                0
              </button>
              <button
                type="button"
                className="sc-key sc-key-del"
                disabled={loading || !code}
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
            <p id="code-hint" className="sc-prompt-text">5-значный код нанесён на ярлык рядом с экспонатом</p>
          </div>
          <div className="sc-actions">
            <button
              className="sc-submit"
              type="submit"
              disabled={!isComplete || loading}
            >
              {loading ? 'Проверяем…' : 'Открыть историю'}
            </button>
            <button className="sc-skip" type="button" onClick={() => navigate('museumDetail')}>
              Вернуться к экспонатам
            </button>
          </div>
        </div>

      </form>
    </section>
  );
}

export function QrScannerView({navigate, actions}) {
  const videoRef = useRef(null);
  const {resolveQrResult} = actions;
  const [phase, setPhase] = useState('priming');
  const [attempt, setAttempt] = useState(0);
  const [canRetry, setCanRetry] = useState(false);
  const [showHelp, setShowHelp] = useState(false);
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
        setStatus({title: 'Камера недоступна', text: 'Откройте сайт в браузере с доступом к камере или введите код с этикетки экспоната.'});
        return;
      }
      setCanRetry(false);
      setStatus({title: 'Подключаем камеру…', text: 'Если браузер запросит разрешение, разрешите доступ к камере.'});
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
        stopStream();
        if (!active) return;
        setCanRetry(true);
        setStatus({title: 'Не удалось открыть камеру', text: 'Разрешите доступ к камере в настройках браузера и повторите попытку. Или введите код с этикетки.'});
        return;
      }

      if (!active) { stopStream(); return; }
      if (!('BarcodeDetector' in window)) {
        stopStream();
        setStatus({title: 'Введите код с этикетки', text: 'Этот браузер не поддерживает распознавание QR. Введите 5-значный код с этикетки экспоната.'});
        return;
      }
      try {
        detector = new window.BarcodeDetector({formats: ['qr_code']});
      } catch {
        stopStream();
        setStatus({title: 'Введите код с этикетки', text: 'Введите 5-значный код с этикетки экспоната, чтобы открыть историю.'});
        return;
      }

      setStatus({title: 'Наведите камеру на QR-код', text: 'Держите код внутри рамки. После распознавания откроется экспонат.'});
      const scanFrame = async () => {
        if (!active) return;
        const video = videoRef.current;
        if (locked || !detector || !video || video.readyState < 2) {
          raf = requestAnimationFrame(scanFrame);
          return;
        }
        try {
          const codes = await detector.detect(video);
          if (!active) return;
          if (codes.length) {
            locked = true;
            setStatus({title: 'Проверяем QR-код…', text: 'Ищем экспонат.'});
            const result = await resolveQrResult(codes[0].rawValue || '');
            if (!active) return;
            if (!result?.success) {
              stopStream();
              setCanRetry(true);
              setStatus({title: 'Экспонат не найден', text: 'Отсканируйте QR-код рядом с экспонатом или введите код с его этикетки.'});
            }
            return;
          }
        } catch {
          if (!active) return;
          stopStream();
          setCanRetry(true);
          setStatus({title: 'Не удалось прочитать код', text: 'Попробуйте ещё раз при хорошем освещении или введите код с этикетки.'});
          return;
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
  }, [resolveQrResult, phase, attempt]);

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
          <button className="text-button" type="button" onClick={() => navigate('secretCode')}>
            Ввести код с этикетки
          </button>
          <button className="text-button" type="button" onClick={() => navigate('museumDetail')}>
            Вернуться к экспонатам
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
            <button className="icon-button" type="button" aria-label="Подсказка по сканированию" aria-expanded={showHelp} aria-controls="qr-help" onClick={() => setShowHelp((value) => !value)}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 17v-6M12 8h.01" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
          </div>

          <div className="qr-bottom">
            {showHelp && <div id="qr-help" className="qr-status-card"><p>Поместите QR-код целиком в рамку, держите телефон неподвижно и избегайте бликов на этикетке.</p></div>}
            <div className="qr-status-card" role="status" aria-live="polite">
              <h2>{status.title}</h2>
              <p>{status.text}</p>
            </div>
            {canRetry && <button className="tech-button" type="button" onClick={() => setAttempt((value) => value + 1)}>Попробовать снова</button>}
            <button className="tech-button" type="button" onClick={() => navigate('secretCode')}>
              Ввести код с этикетки
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
