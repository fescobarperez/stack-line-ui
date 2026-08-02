import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './i18n/index.js';
import App from './App.jsx';
import Login from './modules/Login.jsx';
import { logout } from './api/auth.js';
import './styles/global.css';

function Root() {
  const [session, setSession] = useState(() => {
    try {
      const saved = sessionStorage.getItem('maya_session');
      return saved ? JSON.parse(saved) : null;
    } catch { return null; }
  });

  const handleLogin = (sess) => {
    sessionStorage.setItem('maya_session', JSON.stringify(sess));
    setSession(sess);
  };

  const handleLogout = () => {
    logout();
    setSession(null);
  };

  return (
    <Routes>
      <Route
        path="/login"
        element={session ? <Navigate to="/dashboard" replace /> : <Login onLogin={handleLogin} />}
      />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route
        path="/:module"
        element={session ? <App session={session} onLogout={handleLogout} /> : <Navigate to="/login" replace />}
      />
    </Routes>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Root />
    </BrowserRouter>
  </React.StrictMode>,
);
