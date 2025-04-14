import React, { useState } from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import Toastify from 'toastify-js';
import axios from 'axios';

const LoginForm = ({ API_HOST, setIsAuthenticated, setShowProfile, setShowForgotPasswordForm, setShowRegisterForm }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const response = await axios.post(`${API_HOST}/api/auth/login`, { email, password });

            sessionStorage.setItem('token', response.data.token);
            setIsAuthenticated(true);
            setShowProfile(true);

            if (response.data.isAdmin) {
                window.location.href = '/admin';
            } else {
                window.location.reload();
            }
        } catch (error) {
            if (error.response && error.response.status === 403) {
                Toastify({
                    text: 'Ваш аккаунт заблокирован. Обратитесь в службу поддержки.',
                    duration: 3000,
                    close: true,
                    gravity: 'top',
                    position: 'right',
                    backgroundColor: '#FF0000',
                }).showToast();
            } else {
                Toastify({
                    text: 'Ошибка авторизации. Проверьте свои данные.',
                    duration: 3000,
                    close: true,
                    gravity: 'top',
                    position: 'right',
                    backgroundColor: '#FF0000',
                }).showToast();
            }
        } finally {
            setLoading(false);
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
                    disabled={loading}
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
            <div className="forgot-registration-button">
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
            </div>
        </Form>
    );
};

export default LoginForm;
