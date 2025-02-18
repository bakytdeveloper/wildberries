import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from './App';
import SearchByArticle from "./components/SearchByArticle";

function AppRouter() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<App />} />
                <Route path="/search-by-article" element={<SearchByArticle />} />
            </Routes>
        </Router>
    );
}

export default AppRouter;
