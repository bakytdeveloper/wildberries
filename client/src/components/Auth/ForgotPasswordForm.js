import React, { useState } from 'react';
import { Form, Button } from 'react-bootstrap';
import Toastify from 'toastify-js';
import axios from 'axios';

const ForgotPasswordForm = ({ API_HOST, setShowForgotPasswordForm }) => {
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const response = await axios.post(`${API_HOST}/api/auth/forgot-password`, { email });

            Toastify({
                text: 'Новый пароль отправлен на ваш email. Проверьте почту.',
                duration: 5000,
                gravity: 'top',
                position: 'right',
                style: { background: '#00cc00' }
            }).showToast();

            // После успешной отправки возвращаемся на форму логина
            setTimeout(() => {
                setShowForgotPasswordForm(false);
            }, 2000);

        } catch (error) {
            console.error('Ошибка сброса пароля:', error);

            const errorMessage = error.response?.data?.message ||
                'Ошибка при отправке нового пароля. Пожалуйста, попробуйте позже.';

            Toastify({
                text: errorMessage,
                duration: 5000,
                gravity: 'top',
                position: 'right',
                style: { background: '#ff0000' }
            }).showToast();
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Form onSubmit={handleForgotPassword} className="auth-form">
            <h2>Восстановление пароля</h2>
            <Form.Group controlId="email" className="mb-3">
                <Form.Label>Email</Form.Label>
                <Form.Control
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="Введите ваш email"
                />
            </Form.Group>

            <Button
                type="submit"
                variant="primary"
                disabled={isLoading}
                className="w-100 mb-3"
            >
                {isLoading ? 'Отправка...' : 'Отправить новый пароль'}
            </Button>

            <Button
                variant="link"
                onClick={() => setShowForgotPasswordForm(false)}
                className="w-100"
            >
                Вернуться к авторизации
            </Button>
        </Form>
    );
};

export default ForgotPasswordForm;