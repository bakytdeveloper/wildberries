import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SearchByArticle from "./components/SearchByArticle";
import AdminPanel from "./components/AdminPanel";
import SearchByBrand from "./components/SearchByBrand";

function AppRouter() {
  return (
      <Router>
        <Routes>
          <Route path="/" element={<SearchByBrand />} />
          <Route path="/search-by-article" element={<SearchByArticle />} />
          <Route path="/admin" element={<AdminPanel API_HOST={process.env.REACT_APP_API_HOST} />} />
        </Routes>
      </Router>
  );
}

export default AppRouter;  SearchByArticle.js
