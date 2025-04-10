import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Table, Button, Modal, Spinner } from 'react-bootstrap';
import Toastify from 'toastify-js';

const AdminPanel = ({ API_HOST }) => {
    const [users, setUsers] = useState([]);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false); // Новое состояние для отслеживания процесса удаления

    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

    useEffect(() => {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        fetchUsers().then(r => r);
    }, []);

    const fetchUsers = async () => {
        try {
            const token = sessionStorage.getItem('token');
            if (!token) {
                console.error('Токен отсутствует');
                return;
            }

            const response = await axios.get(`${API_HOST}/api/admin/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(response.data);
        } catch (error) {
            console.error('Ошибка при получении списка пользователей:', error);
        }
    };

    const toggleBlockUser = async (userId) => {
        try {
            const token = sessionStorage.getItem('token');
            await axios.post(`${API_HOST}/api/admin/users/${userId}/toggle-block`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchUsers();
        } catch (error) {
            console.error('Ошибка при блокировке/разблокировке пользователя:', error);
        }
    };

    const handleDeleteClick = (userId) => {
        setSelectedUserId(userId);
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        setIsDeleting(true); // Начинаем процесс удаления
        try {
            const token = sessionStorage.getItem('token');
            await axios.delete(`${API_HOST}/api/admin/users/${selectedUserId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchUsers(); // Обновляем список пользователей после удаления
            setShowDeleteModal(false);
            Toastify({
                text: 'Пользователь и все связанные данные успешно удалены',
                duration: 3000,
                gravity: 'top',
                position: 'right',
                style: { background: '#00c851' }
            }).showToast();
        } catch (error) {
            console.error('Ошибка при удалении пользователя:', error);
            Toastify({
                text: 'Ошибка при удалении пользователя',
                duration: 3000,
                gravity: 'top',
                position: 'right',
                style: { background: '#ff0000' }
            }).showToast();
        } finally {
            setIsDeleting(false); // Завершаем процесс удаления (в любом случае)
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('token'); // Удаляем токен
        window.location.href = '/'; // Перенаправляем на страницу входа
    };

    return (
        <div className="container">
            <div className="logout-container" >
                <Button
                    className="admin-panel-logout-container"
                    variant="danger"
                    onClick={handleLogout} // Добавляем обработчик выхода
                >
                    Выход
                </Button>

                <h2 className="query-form-title">Админ панель</h2>
            </div>
            <table id="productsTable">
                <thead>
                <tr>
                    <th className="th_table">Имя</th>
                    <th className="th_table">Email</th>
                    <th className="th_table">Дата регистрации</th>
                    <th className="th_table">Статус</th>
                    <th className="th_table">Дата блокировки/разблокировки</th>
                    <th className="th_table">Разрешение</th>
                    <th className="th_table">Удаление</th>
                </tr>
                </thead>
                <tbody>
                {users.map(user => (
                    <tr key={user._id}>
                        <td className="td_table">{user.username}</td>
                        <td className="td_table">{user.email}</td>
                        <td className="td_table">{new Date(user.createdAt).toLocaleString()}</td>
                        <td className="td_table">{user.isBlocked ? <span style={{color:"red"}}>Заблокирован</span> : <span style={{color:"green", fontWeight:"bold"}}>Активен</span>}</td>
                        <td className="td_table">
                            {user.isBlocked
                                ? new Date(user.blockedAt).toLocaleString()
                                : user.unblockedAt
                                    ? new Date(user.unblockedAt).toLocaleString()
                                    : 'Нет данных'}
                        </td>
                        <td className="td_table">
                            <Button
                                variant={user.isBlocked ? 'success' : 'primary'}
                                onClick={() => toggleBlockUser(user._id)}
                            >
                                {user.isBlocked ? 'Разблокировать' : 'Заблокировать'}
                            </Button>
                        </td>
                        <td className="td_table">
                            <Button variant="danger" onClick={() => handleDeleteClick(user._id)}>
                                Удалить
                            </Button>
                        </td>
                    </tr>
                ))}
                </tbody>
            </table>
            <Modal show={showDeleteModal} onHide={() => !isDeleting && setShowDeleteModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Подтверждение удаления</Modal.Title>
                </Modal.Header>
                <Modal.Body>Вы уверены, что хотите удалить этого пользователя?</Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDeleteModal(false)} disabled={isDeleting}>
                        Отменить
                    </Button>
                    <Button variant="danger" onClick={handleDeleteConfirm} disabled={isDeleting}>
                        {isDeleting ? (
                            <>
                                <Spinner
                                    as="span"
                                    animation="border"
                                    size="sm"
                                    role="status"
                                    aria-hidden="true"
                                />
                                <span className="ms-2">Удаление...</span>
                            </>
                        ) : 'Удалить'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default AdminPanel;