import React, {useState} from 'react';
import {Check, ChevronDown, Plus} from '@gravity-ui/icons';
import {DropdownMenu} from '@gravity-ui/uikit';
import {MuseumImage} from '../components/MuseumImage';
import './museum-switcher.css';

export function MuseumSwitcher({museumProfile, currentMuseumId, museums, state, busy, onSelect, onRetry, onManage}) {
  const [open,setOpen] = useState(false);
  const current = museums.find((museum) => museum.id === currentMuseumId);
  const name = current?.name || museumProfile?.name || 'Текущий музей';
  const roles = {owner:'Администратор',museum_admin:'Администратор',methodist:'Методист',moderator:'Модератор'};
  const items = state === 'loading'
    ? [{text:'Загружаем музеи…', disabled:true, action:() => {}}]
    : state === 'error'
      ? [{text:'Повторить загрузку музеев', action:onRetry}]
      : museums.length
        ? museums.map((museum) => ({
          text:<span className="museum-switcher-item-copy"><strong>{museum.name}</strong>{museum.role && <small>{roles[museum.role] || museum.role}</small>}{museum.id === currentMuseumId && <Check className="museum-switcher-selected" aria-hidden="true" />}</span>,
          iconStart:<MuseumImage src={museum.logo_url} className="museum-switcher-item-image" alt="" />,
          action:() => {if (museum.id !== currentMuseumId) onSelect(museum.id);},
          disabled:busy,
          selected:museum.id === currentMuseumId,
          'aria-current':museum.id === currentMuseumId ? 'true' : undefined,
        }))
        : [{text:'Нет подключённых музеев', disabled:true, action:() => {}}];

  return <DropdownMenu open={open} onOpenToggle={setOpen} size="l" disabled={busy} items={[items,[{text:'Мои музеи · Добавить музей', iconStart:<Plus />, action:onManage}]]} popupProps={{placement:['bottom-start','right-start']}} menuProps={{'aria-label':'Подключённые музеи',className:'museum-switcher-menu'}} switcherWrapperClassName="museum-switcher-wrapper" renderSwitcher={(props) => <button {...props} type="button" className="museum-context museum-switcher-trigger" aria-label={`Переключить музей. Текущий: ${name}`} aria-haspopup="menu" aria-expanded={open} disabled={busy} title={name}>
    <MuseumImage className="museum-context-image" src={current?.logo_url || museumProfile?.logoUrl} alt="" />
    <span className="museum-context-copy"><strong>{name}</strong><span>{busy ? 'Переключаем…' : 'Ваш музей'}</span></span>
    <ChevronDown className="museum-switcher-chevron" width={18} height={18} aria-hidden="true" />
  </button>} />;
}
