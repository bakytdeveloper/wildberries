import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import AppRouter from "./AppRouter";

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
    <React.StrictMode>
        <AppRouter />
    </React.StrictMode>
);
