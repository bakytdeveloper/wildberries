import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, isAdmin }) => {
    const token = sessionStorage.getItem('token');

    if (!token) {
        return <Navigate to="/" replace />;
    }

    // Если это защищенный маршрут для админа, проверяем isAdmin
    if (isAdmin && !JSON.parse(sessionStorage.getItem('isAdmin'))) {
        return <Navigate to="/" replace />;
    }

    return children;
};

export default ProtectedRoute;