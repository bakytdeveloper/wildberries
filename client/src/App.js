import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import SearchByArticle from "./components/Search/SearchByArticle";
import AdminPanel from "./components/Search/AdminPanel";
import SearchByBrand from "./components/Search/SearchByBrand";
import ProtectedRoute from "./components/ProtectedRoute";

function App() {
  return (
      <Router>
        <Routes>
          <Route path="/" element={<SearchByBrand />} />
          <Route path="/search-by-article" element={<SearchByArticle />} />
            <Route
                path="/admin"
                element={
                    <ProtectedRoute isAdmin={true}>
                        <AdminPanel API_HOST={process.env.REACT_APP_API_HOST} />
                    </ProtectedRoute>
                }
            />
        </Routes>
      </Router>
  );
}

export default App;
