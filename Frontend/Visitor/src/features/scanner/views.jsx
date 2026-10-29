import React, {useEffect, useRef, useState} from 'react';
import './scanner.css';

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
        setStatus({title: 'Камера недоступна', text: 'Отсканируйте QR-код экспоната через приложение камеры телефона и откройте ссылку.'});
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
        setStatus({title: 'Не удалось открыть камеру', text: 'Разрешите доступ к камере в настройках браузера и повторите попытку.'});
        return;
      }

      if (!active) { stopStream(); return; }
      if (!('BarcodeDetector' in window)) {
        stopStream();
        setStatus({title: 'Сканирование недоступно', text: 'Этот браузер не поддерживает распознавание QR. Отсканируйте QR-код через приложение камеры телефона и откройте ссылку.'});
        return;
      }
      try {
        detector = new window.BarcodeDetector({formats: ['qr_code']});
      } catch {
        stopStream();
        setStatus({title: 'Сканирование недоступно', text: 'Отсканируйте QR-код экспоната через приложение камеры телефона и откройте ссылку.'});
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
              setStatus({title: 'Экспонат не найден', text: 'Отсканируйте QR-код рядом с экспонатом ещё раз.'});
            }
            return;
          }
        } catch {
          if (!active) return;
          stopStream();
          setCanRetry(true);
          setStatus({title: 'Не удалось прочитать код', text: 'Попробуйте ещё раз при хорошем освещении и избегайте бликов на этикетке.'});
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
          </div>
        </div>
      </div>
    </section>
  );
}
