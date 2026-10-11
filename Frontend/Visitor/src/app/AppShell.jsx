import React from 'react';
import {Icon} from '@gravity-ui/uikit';
import {House, HouseFill, Bookmark, BookmarkFill, Person, PersonFill} from '@gravity-ui/icons';
import {HIDDEN_CHROME_VIEWS, TAB_MAP, TABS} from './routes.js';

const INACTIVE_ICONS = {
  museumSelect: House,
  profileCollection: Bookmark,
  profileHome: Person,
};

const ACTIVE_ICONS = {
  museumSelect: HouseFill,
  profileCollection: BookmarkFill,
  profileHome: PersonFill,
};

export function AppShell({view, onNavigate}) {
  const hidden = HIDDEN_CHROME_VIEWS.has(view);
  const activeTab = TAB_MAP[view];

  return (
    <nav className={`app-tabbar ${hidden ? 'is-hidden' : ''}`} aria-label="Основная навигация">
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const IconComponent = isActive ? ACTIVE_ICONS[tab.id] : INACTIVE_ICONS[tab.id];
        return (
          <button
            key={tab.id}
            type="button"
            className={`tab-button ${isActive ? 'is-active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onNavigate(tab.id)}
          >
            <span className="tab-icon-wrap" aria-hidden="true">
              <Icon data={IconComponent} size={24} />
            </span>
            <span className="tab-label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
