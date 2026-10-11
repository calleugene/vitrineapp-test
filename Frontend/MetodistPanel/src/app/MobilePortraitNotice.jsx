import React from 'react';

export function MobilePortraitNotice() {
  return (
    <div className="mobile-portrait-placeholder">
      <div className="mobile-portrait-glow" />
      <div className="mobile-portrait-illustration">
        <div className="mobile-monitor">
          <div className="mobile-monitor-screen">
            <div className="mobile-monitor-sidebar" />
            <div className="mobile-monitor-cards">
              <div />
              <div />
            </div>
            <div className="mobile-monitor-chart" />
          </div>
        </div>
        <div className="mobile-phone">
          <span>×</span>
        </div>
      </div>

      <div className="mobile-portrait-badge">🖥</div>
      <h1>Сайт доступен только с компьютера</h1>
      <p>
        Для комфортной работы используйте компьютер или ноутбук с большим экраном.
      </p>

      <div className="mobile-portrait-card">
        <div className="mobile-feature">
          <div className="mobile-feature-icon">⤢</div>
          <div>
            <strong>Полный функционал</strong>
            <span>Все возможности сайта доступны только на большом экране</span>
          </div>
        </div>
        <div className="mobile-feature">
          <div className="mobile-feature-icon">🛡</div>
          <div>
            <strong>Удобство и безопасность</strong>
            <span>Работайте с данными удобно и безопасно на компьютере</span>
          </div>
        </div>
        <div className="mobile-feature">
          <div className="mobile-feature-icon">▥</div>
          <div>
            <strong>Аналитика и отчёты</strong>
            <span>Просматривайте отчёты и аналитику без ограничений</span>
          </div>
        </div>
      </div>

      <div className="mobile-portrait-footer">
        Спасибо за понимание! <span>Команда Витрины</span>
      </div>
    </div>
  );
}
