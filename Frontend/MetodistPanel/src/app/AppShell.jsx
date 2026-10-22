import React, {useEffect, useRef, useState} from 'react';
import {Lock, CircleChevronRight} from '@gravity-ui/icons';
import {Tooltip} from '@gravity-ui/uikit';
import {MuseumSwitcher} from './MuseumSwitcher';
import {PRODUCT_CAPABILITIES} from './capabilities';
import brandMark from '../../../shared/brand-mark.svg';
import {ARTIFACT_WIZARD_VIEWS, NAV_ITEMS, ROUTE_WIZARD_VIEWS} from './navigation';

function UnavailableNavigationItem({item}) {
  const [open, setOpen] = useState(false);
  const NavIcon = item.icon;
  return <Tooltip content="Доступно в следующих обновлениях" open={open} onOpenChange={setOpen} openDelay={250}>
    <button type="button" className="nav-item is-unavailable" aria-disabled="true" aria-label={item.label + '. Доступно в следующих обновлениях'} onClick={() => setOpen(true)} onBlur={() => setOpen(false)}>
      <span className="nav-icon"><NavIcon /></span><span className="nav-label">{item.label}</span><Lock className="nav-lock" />
    </button>
  </Tooltip>;
}

export function AppShell({
  sidebarCollapsed,
  mobileNavOpen,
  userMenuOpen,
  museumProfile,
  museums,
  museumState,
  museumSwitchBusy,
  onSelectMuseum,
  onRetryMuseums,
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

}) {
  const profileRef = useRef(null);
  const triggerRef = useRef(null);
  useEffect(() => {
    const close = (event) => {
      if (event.type === 'keydown' && event.key !== 'Escape') return;
      if (event.type === 'pointerdown' && profileRef.current?.contains(event.target)) return;
      if (userMenuOpen) { onToggleUserMenu(); if (event.type === 'keydown') triggerRef.current?.focus(); }
      if (event.type === 'keydown') onCloseMobileNav?.();
    };
    document.addEventListener('keydown', close);
    document.addEventListener('pointerdown', close);
    return () => { document.removeEventListener('keydown', close); document.removeEventListener('pointerdown', close); };
  }, [userMenuOpen, onToggleUserMenu, onCloseMobileNav]);
  useEffect(() => { if (userMenuOpen) profileRef.current?.querySelector('[role="menuitem"]')?.focus(); }, [userMenuOpen]);
  useEffect(() => {
    if (!mobileNavOpen) return undefined;
    const drawer = document.querySelector('.sidebar');
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    drawer?.querySelector('button')?.focus();
    const trap = (event) => {
      if (event.key !== 'Tab') return;
      const buttons = [...drawer.querySelectorAll('button')].filter((button) => button.offsetParent !== null);
      const first = buttons[0]; const last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', trap); previous?.focus(); };
  }, [mobileNavOpen]);
  const name = currentUser?.full_name || currentUser?.email || 'Методист';
  const initials = name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('');
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
          <img className="brand-logo" src={brandMark} alt="" />
          <div className="brand-title">Витрина</div>
        </button>
      </header>

      <div
        className={`app-shell ${ARTIFACT_WIZARD_VIEWS.includes(view) ? 'is-artifact-flow' : ''} ${sidebarCollapsed ? 'is-sidebar-collapsed' : ''} ${
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
          <MuseumSwitcher museumProfile={museumProfile} currentMuseumId={currentUser?.museum_id} museums={museums} state={museumState} busy={museumSwitchBusy} onSelect={async (id) => {if (await onSelectMuseum(id)) onCloseMobileNav?.();}} onRetry={onRetryMuseums} onManage={() => handleNavigate('user-profile')} />

          <nav className="nav" aria-label="Основная навигация">
            {NAV_ITEMS.map((item) => {
              const NavIcon = item.icon;
              const active =
                (item.id === 'artifacts' &&
                  (view === 'artifacts' || ARTIFACT_WIZARD_VIEWS.includes(view))) ||
                (item.id === 'museum' && view === 'museum') ||
                (item.id === 'visitors' && view === 'visitors') ||
                (item.id === 'stats' && view === 'stats') ||
                (item.id === 'feedback' && view === 'feedback') ||
                (item.id === 'routes' && (view === 'routes' || ROUTE_WIZARD_VIEWS.includes(view))) ||
                (item.id === 'dashboard' && view === 'dashboard');

              if (!PRODUCT_CAPABILITIES[item.id]) return <UnavailableNavigationItem key={item.id} item={item} />;
              return (
                <button
                  key={item.id}
                  className={`nav-item ${active ? 'is-active' : ''}`}
                  aria-current={active ? 'page' : undefined}
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


          <div className="sidebar-header sidebar-brand-footer">
            <button type="button" className="brand brand-button" onClick={() => handleNavigate('dashboard')} aria-label="На главную">
              <img className="brand-logo" src={brandMark} alt="" />
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

        </aside>

        <main className={`workspace ${ARTIFACT_WIZARD_VIEWS.includes(view) ? 'is-artifact-flow' : ''}`}>
          <div className="workspace-tools">
            <div className="workspace-tools-actions">
              <div className="account-menu" ref={profileRef}>
                <button ref={triggerRef} type="button" className="account-trigger" aria-label="Меню пользователя" aria-haspopup="menu" aria-expanded={userMenuOpen} onClick={onToggleUserMenu}>
                  {currentUser?.avatar_url ? <img className="account-avatar" src={currentUser.avatar_url} alt="" /> : <span className="account-avatar">{initials}</span>}<span aria-hidden="true">⌄</span>
                </button>
                {userMenuOpen && <div className="account-dropdown" role="menu" aria-label="Учётная запись" onKeyDown={(event) => {
                  const items = [...event.currentTarget.querySelectorAll('[role="menuitem"]')];
                  const index = items.indexOf(document.activeElement);
                  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); items[(index + (event.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus(); }
                  if (event.key === 'Tab') onToggleUserMenu();
                }}>
                  <div className="account-info"><strong>{name}</strong><span>{currentUser?.role === 'methodist' ? 'Методист' : currentUser?.role || 'Пользователь'}</span></div>
                  <button type="button" role="menuitem" onClick={onOpenUserProfile}>Мой профиль</button>
                  <button type="button" role="menuitem" onClick={onLogout}>Выйти из системы</button>
                </div>}
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
