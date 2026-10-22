import React from 'react';
import {MuseumImage} from '../components/MuseumImage';
import {Button} from '@gravity-ui/uikit';
import './museum-setup-screen.css';
import brandMark from '../../../shared/brand-mark.svg';

export function MuseumSetupScreen({error, loading, onCreate, onLogout}) {
  return (
    <main className="museum-setup-screen">
      <section className="museum-setup-card" aria-labelledby="museum-setup-title">
        <div className="museum-setup-brand"><img className="brand-logo" src={brandMark} alt="" /><span>Витрина</span></div>
        <MuseumImage className="museum-empty-illustration" alt="Универсальная иллюстрация музея" />
        <h1 id="museum-setup-title">Создайте свой музей</h1>
        <p>Ваш аккаунт ещё не связан с музеем. Создайте свой музей, затем заполните его профиль.</p>
        {error && <p className="museum-setup-error" role="alert">{error}</p>}
        <div className="museum-setup-actions">
          <Button view="action" size="l" loading={loading} disabled={loading} onClick={onCreate}>Создать свой музей</Button>
          <Button view="flat" size="l" disabled={loading} onClick={onLogout}>Выйти</Button>
        </div>
      </section>
    </main>
  );
}
