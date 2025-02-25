import React, { useState } from 'react';
import { Form, Button } from 'react-bootstrap';
import Toastify from 'toastify-js';
import axios from 'axios';

const ForgotPasswordForm = ({ setShowForgotPasswordForm }) => {
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [showOtpInput, setShowOtpInput] = useState(false);
    const API_HOST = process.env.REACT_APP_API_HOST;

    const handleForgotPassword = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post(`${API_HOST}/api/auth/forgot-password`, { email });
            Toastify({ text: 'Пароль сброшен, проверьте ваш email', duration: 3000, gravity: 'top', position: 'right', style: { background: '#00cc00' } }).showToast();
        } catch (error) {
            Toastify({ text: 'Ошибка сброса пароля', duration: 3000, gravity: 'top', position: 'right', style: { background: '#ff0000' } }).showToast();
        }
    };

    const handleSendOtp = async () => {
        try {
            const response = await axios.post(`${API_HOST}/api/auth/send-otp`, { email });
            if (response.status === 200) {
                setShowOtpInput(true);
                Toastify({ text: 'OTP отправлен на ваш email', duration: 3000, gravity: 'top', position: 'right', style: { background: '#00cc00' } }).showToast();
            }
        } catch (error) {
            Toastify({ text: 'Ошибка отправки OTP', duration: 3000, gravity: 'top', position: 'right', style: { background: '#ff0000' } }).showToast();
        }
    };

    return (
        <Form onSubmit={handleForgotPassword} className="auth-form">
            <h2>Восстановление пароля</h2>
            <Form.Group controlId="email">
                <Form.Label>Email</Form.Label>
                <Form.Control type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </Form.Group>
            {showOtpInput && (
                <Form.Group controlId="otp">
                    <Form.Label>OTP</Form.Label>
                    <Form.Control type="text" value={otp} onChange={(e) => setOtp(e.target.value)} required />
                </Form.Group>
            )}
            <Button type="submit">Обновить пароль</Button>
            <Button variant="link" onClick={() => setShowForgotPasswordForm(false)}>Авторизация</Button>
        </Form>
    );
};

export default ForgotPasswordForm;
