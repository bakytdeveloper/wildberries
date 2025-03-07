import React, { useState } from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import Toastify from 'toastify-js';
import axios from 'axios';

const RegisterForm = ({ API_HOST, setIsAuthenticated, setShowProfile, setShowRegisterForm }) => {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false); // Добавлено состояние loading

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true); // Блокируем форму
        try {
            const response = await axios.post(`${API_HOST}/api/auth/register`, { username, email, password });
            sessionStorage.setItem('token', response.data.token);
            setIsAuthenticated(true);
            setShowProfile(true);
            Toastify({
                text: `Здравствуйте, ${username}!
                Вы успешно зарегистрированы. Таблица отправлена на Вашу эл.почту.`,
                duration: 3000,
                gravity: 'top',
                position: 'right',
                style: { background: '#00cc00' },
            }).showToast();
        } catch (error) {
            Toastify({
                text: error.response?.data?.message || 'Ошибка регистрации',
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
        <Form onSubmit={handleRegister} className="auth-form">
            <h2>Регистрация</h2>
            <Form.Group controlId="username">
                <Form.Label>Имя пользователя</Form.Label>
                <Form.Control
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={loading} // Делаем поле неактивным
                />
            </Form.Group>
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
                {loading ? 'Загрузка...' : 'Зарегистрироваться'}
            </Button>
            <Button
                variant="link"
                onClick={() => setShowRegisterForm(false)}
                disabled={loading} // Блокируем кнопку
            >
                Авторизация
            </Button>
        </Form>
    );
};

export default RegisterForm;
