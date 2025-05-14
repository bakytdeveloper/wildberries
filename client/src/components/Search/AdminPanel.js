import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {Button, Modal, Spinner, Form, InputGroup, ToggleButton} from 'react-bootstrap';
import Toastify from 'toastify-js';

const AdminPanel = ({ API_HOST }) => {
    const [users, setUsers] = useState([]);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
    const [showSubscriptionModal, setShowSubscriptionModal] = useState(false);
    const [subscriptionAmount, setSubscriptionAmount] = useState('');
    const [calculatedDate, setCalculatedDate] = useState('');
    const [isUpdatingSubscription, setIsUpdatingSubscription] = useState(false);
    const [sortBySubscription, setSortBySubscription] = useState(false);
    const [originalUsers, setOriginalUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState(''); // Состояние для поискового запроса
    const [filteredUsers, setFilteredUsers] = useState([]); // Добавлено состояние для отфильтрованных пользователей
    const [amountError, setAmountError] = useState('');

    useEffect(() => {
        // Проверка токена при монтировании
        checkToken();

        // Обработчик для кнопок назад/вперед в браузере
        const handlePopState = () => {
            checkToken();
        };

        // Обработчик для закрытия/перезагрузки страницы
        const handleBeforeUnload = () => {
            sessionStorage.removeItem('token');
        };

        window.addEventListener('popstate', handlePopState);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('popstate', handlePopState);
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, []);

    const checkToken = () => {
        const token = sessionStorage.getItem('token');
        if (!token) {
            window.location.href = '/';
        }
    };

    useEffect(() => {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    useEffect(() => {
        fetchUsers().then(r => r);
    }, []);

    // Эффект для фильтрации пользователей при изменении searchTerm или users
    useEffect(() => {
        const filtered = users.filter(user =>
            user.username.toLowerCase().includes(searchTerm.toLowerCase())
        );
        setFilteredUsers(filtered);
    }, [searchTerm, users]);

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
            setFilteredUsers(response.data); // Инициализируем filteredUsers
            setOriginalUsers(response.data); // Сохраняем исходный порядок
        } catch (error) {
            console.error('Ошибка при получении списка пользователей:', error);
        }
    };

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };


    const toggleSortBySubscription = () => {
        const newSortState = !sortBySubscription;
        setSortBySubscription(newSortState);

        console.log("toggleSortBySubscription")

        if (newSortState) {
            // Сортируем по подписке
            const sortedUsers = [...users].sort((a, b) => {
                const now = new Date();

                // Пользователи без подписки идут первыми
                if (!a.subscription?.subscriptionEndDate && !b.subscription?.subscriptionEndDate) return 0;
                if (!a.subscription?.subscriptionEndDate) return -1;
                if (!b.subscription?.subscriptionEndDate) return 1;

                // Проверяем, истекла ли подписка
                const aExpired = new Date(a.subscription.subscriptionEndDate) < now;
                const bExpired = new Date(b.subscription.subscriptionEndDate) < now;

                // Истекшие подписки идут перед активными
                if (aExpired && !bExpired) return -1;
                if (!aExpired && bExpired) return 1;
                if (aExpired && bExpired) {
                    return new Date(a.subscription.subscriptionEndDate) - new Date(b.subscription.subscriptionEndDate);
                }

                // Для активных подписок сортируем по оставшемуся времени
                return new Date(a.subscription.subscriptionEndDate) - new Date(b.subscription.subscriptionEndDate);
            });
            setUsers(sortedUsers);
        } else {
            // Возвращаем исходный порядок
            setUsers([...originalUsers]);
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
        setIsDeleting(true);
        try {
            const token = sessionStorage.getItem('token');
            await axios.delete(`${API_HOST}/api/admin/users/${selectedUserId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            await fetchUsers();
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
            setIsDeleting(false);
        }
    };

    const handleSubscriptionClick = (userId) => {
        setSelectedUserId(userId);
        setSubscriptionAmount('');
        setCalculatedDate('');
        setShowSubscriptionModal(true);
    };

    const calculateSubscriptionDate = () => {
        const amount = parseInt(subscriptionAmount);
        if (isNaN(amount) || amount < 1000) {
            setCalculatedDate('Сумма должна быть не менее 1000');
            return;
        }

        const months = Math.floor(amount / 1000);
        const currentDate = new Date();
        const endDate = new Date();
        endDate.setMonth(currentDate.getMonth() + months);

        setCalculatedDate(`Подписка будет действовать до: ${endDate.toLocaleDateString()}`);
    };

    const updateUserSubscription = async () => {
        setIsUpdatingSubscription(true);
        try {
            const token = sessionStorage.getItem('token');
            await axios.post(`${API_HOST}/api/admin/users/${selectedUserId}/subscription`,
                { amount: subscriptionAmount },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            await fetchUsers();
            setShowSubscriptionModal(false);
            Toastify({
                text: 'Подписка пользователя успешно обновлена',
                duration: 3000,
                gravity: 'top',
                position: 'right',
                style: { background: '#00c851' }
            }).showToast();
        } catch (error) {
            console.error('Ошибка при обновлении подписки:', error);
            Toastify({
                text: 'Ошибка при обновлении подписки',
                duration: 3000,
                gravity: 'top',
                position: 'right',
                style: { background: '#ff0000' }
            }).showToast();
        } finally {
            setIsUpdatingSubscription(false);
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('token');
        window.location.href = '/';
        sessionStorage.removeItem('token');
    };

    const handleSubscriptionAmountChange = (e) => {
        const value = e.target.value;
        setSubscriptionAmount(value);

        if (value === '') {
            setAmountError('');
            return;
        }

        const numValue = parseInt(value);
        if (isNaN(numValue) || numValue < 1000 || numValue % 1000 !== 0) {
            setAmountError('Введите сумму, кратную 1000 (1000, 2000, ...)');
        } else {
            setAmountError('');
        }
    };

    return (
        <div className="container">
            <div className="logout-container">
                <div className="logout-container-search-sort">
                <h2 className="query-form-title">Админ панель</h2>
               {/*<div className="logout-container-search-sort">*/}

                   <Button
                       className="admin-panel-logout-container"
                       variant="danger"
                       onClick={handleLogout}
                   >
                       Выход
                   </Button>
                   <div className="query-form-search-and-toggle" >

                       <Form.Control
                           className="admin-panel-search-container"
                           type="text"
                           placeholder="Поиск по имени"
                           value={searchTerm}
                           onChange={handleSearchChange}
                           // style={{ maxWidth: '300px' }}
                       />

                       <ToggleButton
                           className="admin-panel-sort-container"
                           type="checkbox"
                           variant={sortBySubscription ? 'outline-primary' : 'outline-primary'}
                           checked={sortBySubscription}
                           value="1"
                           onClick={toggleSortBySubscription}
                       >
                           {sortBySubscription ? 'Обычный порядок' : 'Сортировать по подписке'}
                       </ToggleButton>
                   </div>

               </div>
            </div>
            <table id="productsTable">
                <thead>
                <tr>
                    <th className="th_table">№</th>
                    <th className="th_table">Имя</th>
                    <th className="th_table">Email</th>
                    <th className="th_table">Дата регистрации</th>
                    <th className="th_table">Статус</th>
                    <th className="th_table">Блокировки/Разблокировки</th>
                    <th className="th_table">Подписка до</th>
                    <th className="th_table">Разрешение</th>
                    <th className="th_table">Подписка</th>
                    <th className="th_table">Удаление</th>
                </tr>
                </thead>
                <tbody>
                {filteredUsers.map((user, i) => (
                    <tr key={user._id}>
                        <td className="td_table">{i + 1}</td>
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
                            {user.subscription?.subscriptionEndDate
                                ? new Date(user.subscription.subscriptionEndDate).toLocaleDateString()
                                : 'Нет подписки'}
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
                            <Button
                                className="td_table_search"
                                variant="info" onClick={() => handleSubscriptionClick(user._id)}>
                                Подписка
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

            {/* Модальное окно удаления */}
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

            {/* Модальное окно подписки */}
            <Modal show={showSubscriptionModal} onHide={() => !isUpdatingSubscription && setShowSubscriptionModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Обновление подписки</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form.Group>
                        <Form.Label>Сумма оплаты (1000 = 1 месяц)</Form.Label>
                        <InputGroup>
                            <Form.Control
                                type="number"
                                value={subscriptionAmount}
                                onChange={handleSubscriptionAmountChange}
                                placeholder="Ввод от 1000"
                                min="1000"
                                step="1000"
                                isInvalid={!!amountError}
                                className="sum-check-input"
                            />
                            <Button variant="outline-secondary" onClick={calculateSubscriptionDate}>
                                Рассчитать
                            </Button>
                            <Form.Control.Feedback type="invalid">
                                {amountError}
                            </Form.Control.Feedback>
                        </InputGroup>
                    </Form.Group>
                    {calculatedDate && (
                        <div className="mt-3" style={{ fontWeight: 'bold' }}>
                            {calculatedDate}
                        </div>
                    )}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowSubscriptionModal(false)} disabled={isUpdatingSubscription}>
                        Отменить
                    </Button>
                    <Button variant="primary" onClick={updateUserSubscription} disabled={isUpdatingSubscription || !subscriptionAmount}>
                        {isUpdatingSubscription ? (
                            <>
                                <Spinner
                                    as="span"
                                    animation="border"
                                    size="sm"
                                    role="status"
                                    aria-hidden="true"
                                />
                                <span className="ms-2">Обновление...</span>
                            </>
                        ) : 'Обновить подписку'}
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
};

export default AdminPanel;