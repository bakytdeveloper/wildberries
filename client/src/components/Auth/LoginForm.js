import React, { useState } from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import Toastify from 'toastify-js';
import axios from 'axios';

const LoginForm = ({ API_HOST, setIsAuthenticated, setShowProfile, setShowForgotPasswordForm, setShowRegisterForm }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false); // Добавлено состояние loading

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true); // Блокируем форму
        try {
            const response = await axios.post(`${API_HOST}/api/auth/login`, { email, password });
            sessionStorage.setItem('token', response.data.token);
            setIsAuthenticated(true);
            setShowProfile(true);

            // Программная перезагрузка страницы через 100 мс
            setTimeout(() => {
                window.location.reload();
            }, 100);
        } catch (error) {
            Toastify({
                text: 'Ошибка авторизации',
                duration: 3000,
                gravity: 'top',
                position: 'right',
                style: { background: '#ff0000' },
            }).showToast();
        } finally {
            setLoading(false); // Разблокируем форму
        }
    };


    return (
        <Form onSubmit={handleLogin} className="auth-form">
            <h2>Авторизация</h2>
            <Form.Group controlId="email">
                <Form.Label>Email</Form.Label>
                <Form.Control
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading} // Делаем поле неактивным
                />
            </Form.Group>
            <Form.Group controlId="password">
                <Form.Label>Пароль</Form.Label>
                <InputGroup>
                    <Form.Control
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading} // Делаем поле неактивным
                    />
                    <InputGroup.Text
                        className="FaEye-button"
                        onClick={() => setShowPassword(!showPassword)}
                        style={{ cursor: 'pointer' }}
                    >
                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </InputGroup.Text>
                </InputGroup>
            </Form.Group>
            <Button type="submit" disabled={loading}>
                {loading ? 'Загрузка...' : 'Войти'}
            </Button>
            <Button
                variant="link"
                onClick={() => setShowForgotPasswordForm(true)}
                disabled={loading} // Блокируем кнопку
            >
                Забыли пароль?
            </Button>
            <Button
                variant="link"
                className="registration-button"
                onClick={() => setShowRegisterForm(true)}
                disabled={loading} // Блокируем кнопку
            >
                Регистрация
            </Button>
        </Form>
    );
};

export default LoginForm;
