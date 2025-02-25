import React, { useState } from 'react';
import { Form, Button, InputGroup } from 'react-bootstrap';
import { FaEye, FaEyeSlash } from 'react-icons/fa';
import Toastify from 'toastify-js';
import axios from 'axios';

const LoginForm = ({ setIsAuthenticated, setShowProfile, setShowForgotPasswordForm, setShowRegisterForm }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const API_HOST = process.env.REACT_APP_API_HOST;

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post(`${API_HOST}/api/auth/login`, { email, password });
            sessionStorage.setItem('token', response.data.token);
            setIsAuthenticated(true);
            setShowProfile(true);
        } catch (error) {
            Toastify({ text: 'Ошибка авторизации', duration: 3000, gravity: 'top', position: 'right', style: { background: '#ff0000' } }).showToast();
        }
    };

    return (
        <Form onSubmit={handleLogin} className="auth-form">
            <h2>Авторизация</h2>
            <Form.Group controlId="email">
                <Form.Label>Email</Form.Label>
                <Form.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Form.Group>
            <Form.Group controlId="password">
                <Form.Label>Пароль</Form.Label>
                <InputGroup>
                    <Form.Control type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} required />
                    <InputGroup.Text className="FaEye-button" onClick={() => setShowPassword(!showPassword)} >
                        {showPassword ? <FaEyeSlash /> : <FaEye />}
                    </InputGroup.Text>
                </InputGroup>
            </Form.Group>
            <Button type="submit">Войти</Button>
            <Button variant="link" onClick={() => setShowForgotPasswordForm(true)}>Забыли пароль?</Button>
            <Button variant="link" className="registration-button" onClick={() => setShowRegisterForm(true)}>Регистрация</Button>
        </Form>
    );
};

export default LoginForm;
