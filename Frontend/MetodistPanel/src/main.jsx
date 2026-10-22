import React from 'react';
import ReactDOM from 'react-dom/client';
import {ThemeProvider, Toaster, ToasterProvider, ToasterComponent, configure} from '@gravity-ui/uikit';

import '@gravity-ui/uikit/styles/fonts.css';
import '@gravity-ui/uikit/styles/styles.css';

import App from './App';
import {AuthScreen} from './app/AuthScreen';
import {LegalDocumentPage} from './app/LegalDocument';
import './styles.css';

configure({lang: 'ru'});
const toaster = new Toaster();

const publicPath = window.location.pathname.replace(import.meta.env.BASE_URL.replace(/\/$/, ''), '').replace(/\/$/, '');
const publicContent = publicPath.startsWith('/legal/') ? <LegalDocumentPage type={publicPath.split('/')[2]} /> : publicPath === '/forgot-password' ? <AuthScreen initialMode="forgot" /> : publicPath === '/reset-password' ? <AuthScreen initialMode="reset" /> : null;
if (publicPath === '/reset-password') {
  const meta = document.createElement('meta'); meta.name = 'referrer'; meta.content = 'no-referrer'; document.head.appendChild(meta);
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider theme="light">
      <ToasterProvider toaster={toaster}>{publicContent || <App />}<ToasterComponent /></ToasterProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
