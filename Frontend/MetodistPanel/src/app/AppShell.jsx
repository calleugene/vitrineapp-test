import React from 'react';
import {BellDot, CircleChevronRight} from '@gravity-ui/icons';
import {Button} from '@gravity-ui/uikit';
import {ARTIFACT_WIZARD_VIEWS, NAV_ITEMS, ROUTE_WIZARD_VIEWS} from './constants';

export function AppShell({
  sidebarCollapsed,
  mobileNavOpen,
  userMenuOpen,
  notificationsOpen,
  notificationUnreadCount,
  notificationItems,
  currentUser,
  view,
  headerAction,
  children,
  onNavigate,
  onToggleSidebar,
  onToggleMobileNav,
  onCloseMobileNav,
  onToggleUserMenu,
  onOpenUserProfile,
  onLogout,
  onToggleNotifications,
}) {
  const handleNavigate = (nextView) => {
    onNavigate(nextView);
    onCloseMobileNav?.();
  };

  return (
    <div className="desktop-app-shell">
      <header className="mobile-topbar">
        <button
          type="button"
          className="mobile-nav-toggle"
          onClick={onToggleMobileNav}
          aria-label="Открыть меню"
          aria-expanded={mobileNavOpen ? 'true' : 'false'}
        >
          <span />
          <span />
          <span />
        </button>
        <button
          type="button"
          className="mobile-topbar-brand"
          onClick={() => handleNavigate('dashboard')}
          aria-label="На главную"
        >
          <div className="brand-logo">Я</div>
          <div className="brand-title">Витрина</div>
        </button>
      </header>

      <div
        className={`app-shell ${view.startsWith('editor-') ? 'is-artifact-editor' : ''} ${ARTIFACT_WIZARD_VIEWS.includes(view) ? 'is-artifact-flow' : ''} ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''} ${
          mobileNavOpen ? 'is-mobile-nav-open' : ''
        }`}
      >
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Закрыть меню"
          onClick={onCloseMobileNav}
        />
        <aside className={`sidebar ${sidebarCollapsed ? 'is-collapsed' : ''}`}>
          <div className="sidebar-header">
            <button type="button" className="brand brand-button" onClick={() => handleNavigate('dashboard')} aria-label="На главную">
              <div className="brand-logo">Я</div>
              <div className="brand-copy">
                <div className="brand-title">Витрина</div>
                <div className="brand-subtitle">Кабинет методиста</div>
              </div>
            </button>
            <button
              type="button"
              className={`sidebar-toggle ${sidebarCollapsed ? 'is-collapsed' : ''}`}
              onClick={onToggleSidebar}
              aria-label={sidebarCollapsed ? 'Развернуть меню' : 'Свернуть меню'}
            >
              <CircleChevronRight />
            </button>
          </div>

          <nav className="nav">
            {NAV_ITEMS.map((item) => {
              const NavIcon = item.icon;
              const active =
                (item.id === 'artifacts' &&
                  (view === 'artifacts' || ARTIFACT_WIZARD_VIEWS.includes(view) || view.startsWith('editor-'))) ||
                (item.id === 'museum' && view === 'museum') ||
                (item.id === 'visitors' && view === 'visitors') ||
                (item.id === 'stats' && view === 'stats') ||
                (item.id === 'feedback' && view === 'feedback') ||
                (item.id === 'routes' && (view === 'routes' || ROUTE_WIZARD_VIEWS.includes(view))) ||
                (item.id === 'dashboard' && view === 'dashboard');

              return (
                <button
                  key={item.id}
                  className={`nav-item ${active ? 'is-active' : ''}`}
                  title={sidebarCollapsed ? item.label : undefined}
                  onClick={() => handleNavigate(item.id)}
                  type="button"
                >
                  <span className="nav-icon">
                    <NavIcon />
                  </span>
                  <span className="nav-label">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="profile-menu-shell">
            <button
              type="button"
              className={`profile-card profile-card-button ${userMenuOpen ? 'is-open' : ''}`}
              title={sidebarCollapsed ? (currentUser?.full_name || currentUser?.email || 'Методист') : undefined}
              onClick={onToggleUserMenu}
            >
              <div className="avatar" />
              <div className="profile-copy">
                <div className="profile-name">{currentUser?.full_name || currentUser?.email || 'Методист'}</div>
                <div className="profile-role">Методист</div>
              </div>
              <span className="profile-chevron">▾</span>
            </button>

            {userMenuOpen && (
              <div className="profile-dropdown">
                <button type="button" className="profile-dropdown-item" onClick={onOpenUserProfile}>
                  Настройки пользователя
                </button>
                <button type="button" className="profile-dropdown-item is-danger" onClick={onLogout}>
                  Выйти
                </button>
              </div>
            )}
          </div>
        </aside>

        <main className={`workspace ${view.startsWith('editor-') ? 'is-artifact-editor' : ''} ${ARTIFACT_WIZARD_VIEWS.includes(view) ? 'is-artifact-flow' : ''}`}>
          <div className="workspace-tools">
            <div className="workspace-tools-actions">
              <div className="notification-shell">
                <button
                  type="button"
                  className={`notification-trigger ${notificationsOpen ? 'is-open' : ''}`}
                  aria-label="Оповещения"
                  onClick={onToggleNotifications}
                >
                  <BellDot />
                  <span className="notification-badge">{notificationUnreadCount}</span>
                </button>
                {notificationsOpen && (
                  <div className="notification-popover">
                    <div className="notification-popover-header">
                      <strong>Оповещения</strong>
                      <span>{notificationUnreadCount} новых</span>
                    </div>
                    <div className="notification-popover-list">
                      {notificationItems.map((item) => (
                        <button type="button" className="notification-popover-item" key={item.id}>
                          <strong>{item.title}</strong>
                          <span>{item.meta}</span>
                        </button>
                      ))}
                    </div>
                    <Button view="flat" size="m" width="max">Открыть все</Button>
                  </div>
                )}
              </div>
              {headerAction}
            </div>
          </div>

          <div className="content-area">{children}</div>
        </main>

      </div>
    </div>
  );
}
