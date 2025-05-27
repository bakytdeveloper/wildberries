import Accordion from 'react-bootstrap/Accordion';
import "toastify-js/src/toastify.css";
import '../../styles.css';
import React, { useState, useEffect, useRef } from 'react';
import { Form, Button, InputGroup, DropdownButton, Dropdown, Alert, Spinner } from 'react-bootstrap'; // Добавлен Spinner
import Toastify from 'toastify-js';
import axios from 'axios';
import { Typeahead } from 'react-bootstrap-typeahead'; // Импортируем Typeahead
import cityDestinations from '../../utils/cityDestinations';
import RegisterForm from '../Auth/RegisterForm';
import LoginForm from '../Auth/LoginForm';
import ForgotPasswordForm from '../Auth/ForgotPasswordForm';
import ImageModal from '../ImageModal';
import { FaTimes } from 'react-icons/fa'; // Импортируем иконку "крестик"
import { Modal } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';


function SearchByBrand() {
    const [query, setQuery] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [loadingMessage, setLoadingMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');
    const [allQueries, setAllQueries] = useState([]);
    const [filteredQueries, setFilteredQueries] = useState([]);
    const [activeKey, setActiveKey] = useState(null);
    const [isRequesting, setIsRequesting] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [retryAttempted, setRetryAttempted] = useState(false);
    const [modalImage, setModalImage] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const [showForgotPasswordForm, setShowForgotPasswordForm] = useState(false);
    const accordionRef = useRef(null);
    const [showProfile, setShowProfile] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteQueryId, setDeleteQueryId] = useState(null);
    const [suggestions, setSuggestions] = useState([]);
    const [brandSuggestions, setBrandSuggestions] = useState([]);
    const [isExporting, setIsExporting] = useState(false); // Новое состояние для отслеживания выгрузки
    const [exportingStates, setExportingStates] = useState({});
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [requestForms, setRequestForms] = useState([{ id: Date.now(), query: '', brand: '', city: 'г.Москва', isMain: true }]);
    const queryTypeaheadRefs = useRef([]);
    const brandTypeaheadRefs = useRef([]);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
    const location = useLocation();
    const API_HOST = process.env.REACT_APP_API_HOST;
    const [showInitialForm, setShowInitialForm] = useState(true); // Состояние для управления видимостью начальной формы
    const [showResetButton, setShowResetButton] = useState(false);
    const [formsDisabled, setFormsDisabled] = useState(false);
    const [isExportingAll, setIsExportingAll] = useState(false);
    const [showExportModal, setShowExportModal] = useState(false);
    const [exportProgress, setExportProgress] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteForm, setDeleteForm] = useState({
        query: '',
        brand: '',
        city: 'г.Москва'
    });
    const [showDeleteByParamsModal, setShowDeleteByParamsModal] = useState(false);
    const [showExportConfirmation, setShowExportConfirmation] = useState(false);


    useEffect(() => {
        if (formsDisabled) {
            queryTypeaheadRefs.current.forEach(ref => {
                if (ref && ref.hideMenu) {
                    ref.hideMenu();
                }
            });
            brandTypeaheadRefs.current.forEach(ref => {
                if (ref && ref.hideMenu) {
                    ref.hideMenu();
                }
            });
        }
    }, [formsDisabled]);


    useEffect(() => {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    // Инициализируем refs для каждого Typeahead
    useEffect(() => {
        queryTypeaheadRefs.current = queryTypeaheadRefs.current.slice(0, requestForms.length);
        brandTypeaheadRefs.current = brandTypeaheadRefs.current.slice(0, requestForms.length);
    }, [requestForms]);

    const clearInput = (formId) => {
        setRequestForms(requestForms.map(f => f.id === formId ? { ...f, query: '', brand: '', city: 'г.Москва' } : f));

        // Очищаем Typeahead
        const formIndex = requestForms.findIndex(f => f.id === formId);
        if (queryTypeaheadRefs.current[formIndex]) {
            queryTypeaheadRefs.current[formIndex].clear();
        }
        if (brandTypeaheadRefs.current[formIndex]) {
            brandTypeaheadRefs.current[formIndex].clear();
        }
    };

    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
        };

        window.addEventListener('resize', handleResize);

        return () => {
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    const truncateText = (text, maxLength) => {
        return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchSavedQueries();
        }
    }, [isAuthenticated]);

    useEffect(() => {
        const token = sessionStorage.getItem('token');
        if (token) {
            setIsAuthenticated(true);
            setShowProfile(true);
        } else {
            setIsAuthenticated(false);
            setShowProfile(false);
        }
    }, []);

    useEffect(() => {
        if (searchTerm.trim() === '') {
            setFilteredQueries(allQueries);
        } else {
            const lowerCaseSearchTerm = searchTerm.toLowerCase();
            setFilteredQueries(allQueries.filter(query => query.query.toLowerCase().includes(lowerCaseSearchTerm)));
        }
    }, [searchTerm, allQueries]);

    const fetchSavedQueries = async () => {
        try {
            setLoadingMessage('Загрузка данных...');
            const token = sessionStorage.getItem('token');
            const response = await fetch(`${API_HOST}/api/queries`, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });
            const text = await response.text();
            try {
                const savedQueries = JSON.parse(text);
                if (Array.isArray(savedQueries)) {
                    setAllQueries(savedQueries);
                    setFilteredQueries(savedQueries);
                    setRetryAttempted(false);

                    const uniqueQueries = [...new Set(savedQueries.flatMap(query => query.query.split('; ')))];
                    setSuggestions(uniqueQueries.map(item => ({ label: item.toString() })));

                    const uniqueBrands = [...new Set(savedQueries.flatMap(query => query.brand.split('; ')))];
                    setBrandSuggestions(uniqueBrands.map(item => ({ label: item.toString() })));
                }
            } catch (jsonError) {
                console.error('Ошибка парсинга JSON:', jsonError);
                throw new Error('Ошибка загрузки данных');
            }
            setLoadingMessage('');
        } catch (error) {
            setErrorMessage('Не удалось загрузить данные.');
            console.error('Ошибка запроса:', error);
            if (!retryAttempted) {
                setRetryAttempted(true);
                setTimeout(fetchSavedQueries, 5000);
            }
        }
    };

    const handleLogout = () => {
        sessionStorage.removeItem('token');
        setIsAuthenticated(false);
        setShowProfile(false);
    };

    const handleQueryChange = (selected, formId) => {
        const value = selected.length > 0 ? selected[0].label : '';
        setRequestForms(requestForms.map(f => f.id === formId ? { ...f, query: value } : f));

        // Обновляем список suggestions
        if (value && !suggestions.some(suggestion => suggestion.label === value)) {
            setSuggestions(prevSuggestions => [...prevSuggestions, { label: value }]);
        }

    };

    const handleBrandChange = (selected, formId) => {
        // console.log('Brand selected:', selected);
        const value = selected.length > 0 ? selected[0].label : '';
        setRequestForms(requestForms.map(f => f.id === formId ? { ...f, brand: value } : f));

        // Обновляем список brandSuggestions
        if (value && !brandSuggestions.some(brand => brand.label === value)) {
            setBrandSuggestions(prevBrandSuggestions => [...prevBrandSuggestions, { label: value }]);
        }
    };

    const handleCityChange = (city, formId) => {
        setRequestForms(requestForms.map(f => f.id === formId ? { ...f, city: city } : f));
    };

    const handleSortInputChange = (e) => {
        const value = e.target.value;
        setSearchTerm(value);

        if (value.trim() !== '') {
            const lowerCaseSearchTerm = value.toLowerCase();

            setFilteredQueries(allQueries.filter(query => {
                // Проверяем совпадения в основном заголовке
                const queryMatch = query.query?.toLowerCase().includes(lowerCaseSearchTerm) || false;
                const brandMatch = query.brand?.toLowerCase().includes(lowerCaseSearchTerm) || false;
                const cityMatch = query.city?.toLowerCase().includes(lowerCaseSearchTerm) || false;

                // Проверяем совпадения в headerTextItems
                const headerItems = query.query.split('; ').map((q, i) => {
                    const b = query.brand.split('; ')[i] || '';
                    const c = query.city.split('; ')[i] || '';
                    return `${q} - ${b} (${c})`.toLowerCase();
                });

                const headerMatch = headerItems.some(item => item.includes(lowerCaseSearchTerm));

                // Проверяем совпадения в таблицах продуктов
                const tableMatch = query.productTables?.some(table => {
                    const tableQuery = (query.query.split('; ')[table.index] || '').toLowerCase();
                    const tableBrand = (query.brand.split('; ')[table.index] || '').toLowerCase();
                    const tableCity = (query.city.split('; ')[table.index] || '').toLowerCase();
                    return tableQuery.includes(lowerCaseSearchTerm) ||
                        tableBrand.includes(lowerCaseSearchTerm) ||
                        tableCity.includes(lowerCaseSearchTerm);
                }) || false;

                return queryMatch || brandMatch || cityMatch || headerMatch || tableMatch;
            }));
        } else {
            setFilteredQueries(allQueries);
        }
    };

    const handleKeyPress = (e, formId) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            fetchProducts();
        }
    };

    const addRequestForm = () => {
        if (requestForms.length >= 15) {
            Toastify({
                text: "Максимальное количество запросов - 15",
                duration: 3000,
                gravity: "top",
                position: "right",
                style: { background: '#ff0000' }
            }).showToast();
            return;
        }
        setRequestForms([...requestForms, { id: Date.now(), query: '', brand: '', city: 'г.Москва', isMain: false }]);
    };


    const handleImageClick = (imageUrl) => {
        setModalImage(imageUrl);
    };

    const closeModal = () => {
        setModalImage(null);
    };

    const handleQueryInputChange = (event, formId) => {
        const text = event.target.value;
        // console.log('Query input change:', text.target.value);
        setRequestForms(prevForms => prevForms.map(f =>
            f.id === formId ? { ...f, query: text.target.value } : f
        ));
    };

    const handleBrandInputChange = (event, formId) => {
        const text = event.target.value;
        // console.log('Brand input change:', text);
        setRequestForms(prevForms => prevForms.map(f =>
            f.id === formId ? { ...f, brand: text.target.value } : f ));
    };

    const removeRequestForm = (formId) => {
        setRequestForms((prevForms) => {
            const updatedForms = prevForms.filter((f) => f.id !== formId);

            // Если все формы удалены, восстанавливаем начальную форму
            if (updatedForms.length === 1) {
                setShowInitialForm(true); // Показываем начальную форму
                return [{ id: Date.now(), query: '', brand: '', city: 'г.Москва', isMain: true }];
            }

            return updatedForms;
        });
    };

    const fetchProducts = async () => {
        if (isRequesting || formsDisabled) return;
        setFormsDisabled(true);
        setIsRequesting(true);
        const validForms = requestForms.filter(form => {
            const query = form.query && typeof form.query === 'string' ? form.query.trim() : '';
            const brand = form.brand && typeof form.brand === 'string' ? form.brand.trim() : '';
            return query !== '' && brand !== '';
        });

        if (validForms.length === 0) {
            Toastify({
                text: "Все формы должны быть заполнены.",
                duration: 3000,
                gravity: "top",
                position: "right",
                style: { background: '#ff0000' }
            }).showToast();
            setFormsDisabled(false);
            setIsRequesting(false);
            return;
        }

        setIsRequesting(true);
        setLoadingMessage('Загрузка...');
        setErrorMessage('');
        setSuccessMessage('');

        try {
            const token = sessionStorage.getItem('token');
            const trimmedForms = validForms.map(form => ({
                ...form,
                query: form.query.trim(),
                brand: form.brand.trim(),
                dest: cityDestinations[form.city],
                city: form.city,
                queryTime: new Date().toISOString()
            }));

            const response = await fetch(`${API_HOST}/api/queries`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ forms: trimmedForms })
            });

            if (response.status !== 200) {
                const result = await response.json();
                throw new Error(result.error || 'Ошибка выполнения запроса');
            }

            const result = await response.json();
            // console.log('Response from server:', result);
            const totalRequests = validForms.length;
            const successfulRequests = result.productTables.filter(table => table.products.length > 0).length;

            if (successfulRequests === totalRequests) {
                setSuccessMessage('Запрос выполнен успешно!');
            } else if (successfulRequests > 0) {
                setSuccessMessage('Запрос выполнен, но не все ответы получены');
            } else {
                setSuccessMessage('По запросу ничего не найдено');
            }

            setAllQueries([result, ...allQueries]);
            setFilteredQueries([result, ...allQueries]);

            setLoadingMessage('');
            clearInput(requestForms[0].id);
            setRequestForms([{ id: Date.now(), query: '', brand: '', city: 'г.Москва', isMain: true }]);
            setShowInitialForm(true);
            setShowResetButton(false); // Скрываем кнопку "Сбросить"
            setActiveKey('0');
            setTimeout(() => {
                setSuccessMessage('');
            }, 3000);
            setTimeout(() => {
                const newAccordionItem = document.querySelector(`.accordion .accordion-item:first-child`);
                if (newAccordionItem) {
                    newAccordionItem.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }, 100);
        } catch (error) {
            console.error('Error fetching products:', error);
            setErrorMessage('Ошибка выполнения запроса');
        } finally {
            setIsRequesting(false);
            setFormsDisabled(false); // Разблокируем формы

        }
    };


    const handleProductClick = (searchQuery, page, position) => {
        const url = `https://www.wildberries.ru/catalog/0/search.aspx?page=${page}&sort=popular&search=${encodeURIComponent(searchQuery)}#position=${position}`;
        window.open(url, '_blank');
    };

    const handlePageRedirect = (productId) => {
        const url = `https://www.wildberries.ru/catalog/${productId}/detail.aspx`;
        window.open(url, '_blank'); // Открывает в новой вкладке
    };

    const handleDeleteClick = (queryId, event) => {
        event.stopPropagation(); // Останавливаем распространение события
        setDeleteQueryId(queryId);
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        if (deleteQueryId) {
            try {
                setExportingStates((prev) => ({ ...prev, [deleteQueryId]: true })); // Устанавливаем состояние удаления

                const token = sessionStorage.getItem('token');
                await axios.delete(`${API_HOST}/api/queries/${deleteQueryId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setAllQueries(allQueries.filter(query => query._id !== deleteQueryId));
                setFilteredQueries(filteredQueries.filter(query => query._id !== deleteQueryId));
                setShowDeleteModal(false);
                setDeleteQueryId(null);
                Toastify({
                    text: "Запрос успешно удален.",
                    duration: 3000,
                    gravity: "top",
                    position: "right",
                    style: { background: '#00c851' }
                }).showToast();
            } catch (error) {
                console.error('Ошибка удаления запроса:', error);
                Toastify({
                    text: "Ошибка удаления запроса.",
                    duration: 3000,
                    gravity: "top",
                    position: "right",
                    style: { background: '#ff0000' }
                }).showToast();
            } finally {
                setExportingStates((prev) => ({ ...prev, [deleteQueryId]: false })); // Сбрасываем состояние удаления
            }
        }
    };

    const handleExportClick = async (queryId, sheetName) => {
        if (exportingStates[queryId]) return; // Блокируем повторные клики
        setExportingStates((prev) => ({ ...prev, [queryId]: true })); // Устанавливаем состояние "выгрузка в процессе" для конкретной кнопки
        setShowExportModal(true);
        setExportProgress('Подготовка данных для выгрузки...');

        try {
            const token = sessionStorage.getItem('token');
            setExportProgress('Соединение с Google Таблицей...');
            const response = await axios.post(`${API_HOST}/api/queries/export`, { queryId, sheetName }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            setExportProgress('Выгрузка данных...');
            console.log('Выгрузка данных:', response.data);
            Toastify({
                text: 'Данные успешно выгружены в Google Таблицу.',
                duration: 3000,
                gravity: 'top',
                position: 'right',
                style: { background: '#00cc00' }
            }).showToast();
        } catch (error) {
            console.error('Ошибка выгрузки данных:', error);
            Toastify({
                text: 'Ошибка выгрузки данных.',
                duration: 3000,
                gravity: 'top',
                position: 'right',
                style: { background: '#ff0000' }
            }).showToast();
        } finally {
            setExportingStates((prev) => ({ ...prev, [queryId]: false })); // Сбрасываем состояние после завершения
            setShowExportModal(false);
        }
    };

    const handleResetForms = () => {
        setRequestForms([{ id: Date.now(), query: '', brand: '', city: 'г.Москва', isMain: true }]);
        setShowInitialForm(true);
        setShowResetButton(false);
    };

    const handleFillForm = (queryData) => {
        const queries = queryData.query.split('; ');
        const brands = queryData.brand.split('; ');
        const cities = queryData.city.split('; ');

        const newForms = queries.map((query, index) => ({
            id: Date.now() + index,
            query: query,
            brand: brands[index] || '',
            city: cities[index] || 'г.Москва',
            isMain: false
        }));

        setRequestForms((prevForms) => {
            const mainForm = prevForms.find((form) => form.isMain);
            const otherForms = prevForms.filter((form) => !form.isMain);

            const uniqueNewForms = newForms.filter((newForm) => {
                return !prevForms.some(
                    (existingForm) =>
                        existingForm.query === newForm.query &&
                        existingForm.brand === newForm.brand &&
                        existingForm.city === newForm.city
                );
            });

            if (uniqueNewForms.length > 0) {
                setShowInitialForm(false);
                setShowResetButton(true); // Показываем кнопку сброса
                return [mainForm, ...otherForms, ...uniqueNewForms];
            }

            return prevForms;
        });
    };

    const handleSearchAllQueries = () => {
        const allQueriesData = filteredQueries.flatMap(queryData => {
            const queries = queryData.query.split('; ');
            const brands = queryData.brand.split('; ');
            const cities = queryData.city.split('; ');

            return queries.map((query, index) => ({
                query: query.trim(),
                brand: brands[index]?.trim() || '',
                city: cities[index]?.trim() || 'г.Москва'
            }));
        });

        const uniqueQueriesData = Array.from(new Set(allQueriesData.map(JSON.stringify))).map(JSON.parse);

        const newForms = uniqueQueriesData.map((data, index) => ({
            id: Date.now() + index,
            query: data.query,
            brand: data.brand,
            city: data.city,
            isMain: false
        }));

        setRequestForms((prevForms) => {
            const mainForm = prevForms.find((form) => form.isMain);
            const otherForms = prevForms.filter((form) => !form.isMain);

            const uniqueNewForms = newForms.filter((newForm) => {
                return !prevForms.some(
                    (existingForm) =>
                        existingForm.query === newForm.query &&
                        existingForm.brand === newForm.brand &&
                        existingForm.city === newForm.city
                );
            });

            if (uniqueNewForms.length > 0) {
                setShowInitialForm(false);
                setShowResetButton(true); // Показываем кнопку сброса
                return [mainForm, ...otherForms, ...uniqueNewForms];
            }

            return prevForms;
        });
    };

    const handleOpenGoogleSheet = async () => {
        try {
            const token = sessionStorage.getItem('token');
            const response = await axios.get(`${API_HOST}/api/user/spreadsheet`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data.spreadsheetId) {
                const url = `https://docs.google.com/spreadsheets/d/${response.data.spreadsheetId}`;
                window.open(url, '_blank');
            } else {
                // Предлагаем создать таблицу при первой выгрузке
                Toastify({
                    text: 'Google Таблица будет создана при первой выгрузке данных',
                    duration: 3000,
                    gravity: 'top',
                    position: 'right',
                    style: { background: '#ff9800' }
                }).showToast();
            }
        } catch (error) {
            console.error('Ошибка получения Google Таблицы:', error);
            Toastify({
                text: 'Ошибка открытия Google Таблицы',
                duration: 3000,
                gravity: 'top',
                position: 'right',
                style: { background: '#ff0000' }
            }).showToast();
        }
    };

    // Добавим этот код в оба компонента (SearchByBrand и SearchByArticle)
    useEffect(() => {
        const checkSubscriptionStatus = async () => {
            try {
                const token = sessionStorage.getItem('token');
                if (!token) return;

                // Проверяем, было ли уже показано уведомление
                const notificationShown = sessionStorage.getItem('subscriptionNotificationShown');
                if (notificationShown) return;

                const response = await axios.get(`${API_HOST}/api/user/me`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const user = response.data;
                const now = new Date();

                // Проверка пробного периода
                if (user.subscription?.isTrial && user.subscription.trialEndDate) {
                    const trialEndDate = new Date(user.subscription.trialEndDate);
                    const timeDiff = trialEndDate - now;

                    // Рассчитываем оставшееся время
                    const daysLeft = Math.floor(timeDiff / (1000 * 60 * 60 * 24));
                    const hoursLeft = Math.floor((timeDiff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

                    // Формируем текст уведомления
                    let message = '';
                    if (daysLeft > 1) {
                        message = `Пробный период закончится через ${daysLeft} дней`;
                    } else if (daysLeft === 1) {
                        message = `Пробный период закончится через 1 день и ${hoursLeft} ${hoursLeft === 1 ? 'час' : 'часа'}`;
                    } else if (daysLeft === 0 && hoursLeft > 0) {
                        message = `Пробный период закончится через ${hoursLeft} ${hoursLeft === 1 ? 'час' : 'часа'}`;
                    } else if (timeDiff <= 0) {
                        message = 'Пробный период закончился!';
                    }

                    // Показываем уведомление, если осталось меньше 2 дней
                    if (daysLeft < 2 && timeDiff > 0) {
                        setTimeout(() => {
                            Toastify({
                                text: `${message}. Оформите подписку, иначе аккаунт будет удалён.`,
                                duration: 5000,
                                gravity: "top",
                                position: "right",
                                style: { background: "#ff9800" }
                            }).showToast();
                            // Помечаем, что уведомление было показано
                            sessionStorage.setItem('subscriptionNotificationShown', 'true');
                        }, 5000); // Задержка 5 секунд
                    }
                }

                // Проверка подписки
                if (!user.subscription?.isTrial && user.subscription?.subscriptionEndDate) {
                    const endDate = new Date(user.subscription.subscriptionEndDate);
                    const daysLeft = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

                    if (daysLeft <= 3 && daysLeft > 0) {
                        setTimeout(() => {
                            Toastify({
                                text: `Подписка закончится через ${daysLeft} ${daysLeft === 1 ? 'день' : 'дня'}. Продлите её.`,
                                duration: 5000,
                                gravity: "top",
                                position: "right",
                                style: { background: "#ff9800" }
                            }).showToast();
                            // Помечаем, что уведомление было показано
                            sessionStorage.setItem('subscriptionNotificationShown', 'true');
                        }, 5000); // Задержка 5 секунд
                    } else if (daysLeft <= 0) {
                        setTimeout(() => {
                            Toastify({
                                text: "Подписка закончилась. Продлите её.",
                                duration: 5000,
                                gravity: "top",
                                position: "right",
                                style: { background: "#f44336" }
                            }).showToast();
                            // Помечаем, что уведомление было показано
                            sessionStorage.setItem('subscriptionNotificationShown', 'true');
                        }, 5000); // Задержка 5 секунд
                    }
                }

                // Проверка блокировки
                if (user.isBlocked) {
                    setTimeout(() => {
                        Toastify({
                            text: "Аккаунт заблокирован. Оформите подписку.",
                            duration: 3000,
                            gravity: "top",
                            position: "right",
                            style: { background: "#f44336" }
                        }).showToast();
                        // Помечаем, что уведомление было показано
                        sessionStorage.setItem('subscriptionNotificationShown', 'true');
                    }, 5000); // Задержка 5 секунд
                }
            } catch (error) {
                console.error('Ошибка при проверке статуса подписки:', error);
            }
        };

        if (isAuthenticated) {
            checkSubscriptionStatus();
            // Убираем интервал, так как проверка нужна только один раз
        }
    }, [isAuthenticated, API_HOST]);

    const handleExportAllToGoogleSheet = () => {
        setShowExportConfirmation(true);
    };

    const handleExportAllToGoogleSheetConfirmed = async () => {
        if (isExportingAll) return;
        setIsExportingAll(true);
        setShowExportModal(true);
        setExportProgress('Подготовка всех данных для выгрузки...');

        try {
            const token = sessionStorage.getItem('token');
            setExportProgress('Расстановка данных в Google Таблицу...');

            const response = await axios.post(`${API_HOST}/api/queries/export-all`, {}, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            setExportProgress('Выгрузка данных...');

            Toastify({
                text: 'Все данные успешно выгружены в Google Таблицу',
                duration: 3000,
                gravity: 'top',
                position: 'right',
                style: { background: '#00cc00' }
            }).showToast();

        } catch (error) {
            console.error('Ошибка выгрузки всех данных:', error);
            Toastify({
                text: 'Ошибка выгрузки всех данных',
                duration: 3000,
                gravity: 'top',
                position: 'right',
                style: { background: '#ff0000' }
            }).showToast();
        } finally {
            setIsExportingAll(false);
            setShowExportModal(false);
        }
    };

    const handleExportToExcelClick = async (queryId, exportType) => {
        if (isExporting) return;
        setIsExporting(true);
        setShowExportModal(true);
        setExportProgress('Подготовка данных для Excel...');

        try {
            const token = sessionStorage.getItem('token');
            setExportProgress('Формирование Excel файла и расстановка данных...');

            const endpoint = exportType === 'queries'
                ? `${API_HOST}/api/queries/export-excel`
                : `${API_HOST}/api/article/export-excel`;

            const response = await fetch(endpoint, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Ошибка выгрузки данных');
            }
            setExportProgress('Подготовка к выгрузке...');

            // Получаем имя файла из заголовка Content-Disposition
            const contentDisposition = response.headers.get('Content-Disposition');
            const fileNameMatch = contentDisposition?.match(/filename="(.+?)"/);
            let fileName = fileNameMatch ? fileNameMatch[1] : 'PosWB.xlsx';

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            Toastify({
                text: 'Excel файл успешно скачан.',
                duration: 5000,
                gravity: 'top',
                position: 'right',
                style: { background: '#00cc00' }
            }).showToast();
        } catch (error) {
            console.error('Ошибка выгрузки данных:', error);
            Toastify({
                text: 'Ошибка выгрузки данных',
                duration: 3000,
                gravity: 'top',
                position: 'right',
                style: { background: '#ff0000' }
            }).showToast();
        } finally {
            setIsExporting(false);
            setShowExportModal(false);
        }
    };

    const ExportModal = () => {
        const [tips] = useState([
            "Подсказка: Вы можете открыть свою Google Таблицу прямо из приложения",
            "ВНИМАНИЕ: При создании гугл таблицы, она будет автоматически отправлена вам на Google почту",
            "Интересный факт: Вы можете просматривать позиции товаров любого магазина с сайта wildberries",
            "Факт: Система обрабатывает до 1000 запросов в минуту",
            "Интересный факт: Если у номера позиции есть красная звёздочка, то есть *, то эта позиция по Рекламной Акции",
            "Подсказка: Для получения сбалансированной и внятной информации, нужно удалять избыточные запросы",
            "Интересный факт: Все авто-выгрузки в Google таблицу осуществляются автоматически каждые 4 часа, начиная с 00:00",
            "Совет: Используйте поисковик по заголовкам для удобного просмотра данных на сайте",
            "Подсказка: Вы можете экспортировать данные в Excel и Google таблицу",
            "ВНИМАНИЕ: При создании гугл таблицы, она будет автоматически отправлена вам на Google почту",
            "Интересный факт: Даже если вы не выгрузили данные в Google таблицу, мы сделаем это за вас автоматически",
            "Факт: Система обрабатывает до 1000 запросов в минуту",
            "Факт: Чётко выстроенные запросы, дадут чётко выстроенные ответы, и корректно выстроенную таблицу",
            "Интересный факт: Если у номера позиции есть красная звёздочка, то есть *, то эта позиция по Рекламной Акции",
            "ВНИМАНИЕ: При создании гугл таблицы, она будет автоматически отправлена вам на Google почту",
            "Информация: Позиции товаров могут немного отличаться, так как сайт wildberries динамичный",
            "Интересный факт: Все авто-запросы на сайте осуществляются автоматически каждые 4 часа, начиная с 00:00",
            "ИЗВИНИТЕ: Если объём данных для выгрузки в таблицу велик, то это может занять немного больше времени"
        ]);

        const icons = ['📁', '🔍', '📊', '📤', '✅'];

        const [currentTipIndex, setCurrentTipIndex] = useState(0);
        const [activeIconIndex, setActiveIconIndex] = useState(0);
        const [showFinalizingMessage, setShowFinalizingMessage] = useState(false);
        const [isClosing, setIsClosing] = useState(false);

        useEffect(() => {
            setCurrentTipIndex(Math.floor(Math.random() * tips.length));
            const tipsInterval = setInterval(() => {
                setCurrentTipIndex(prev => (prev + 1) % tips.length);
            }, 12000);

            const iconsInterval = setInterval(() => {
                setActiveIconIndex(prev => (prev + 1) % icons.length);
            }, 3000);

            return () => {
                clearInterval(tipsInterval);
                clearInterval(iconsInterval);
            };
        }, []);

        const handleClose = () => {
            if (!isClosing) {
                setIsClosing(true);
                setTimeout(() => {
                    setShowExportModal(false);
                }, 500);
                return;
            }
            setShowExportModal(false);
        };

        const renderTip = (tip) => {
            const colonIndex = tip.indexOf(':');
            let contentAfterColon = tip.substring(colonIndex + 1);

            // Обрабатываем специальный случай с звёздочкой
            if (tip.includes("звёздочка, то есть *")) {
                contentAfterColon = contentAfterColon.replace(/\*/g, '<span style="font-weight: bold; color: red;">*</span>');
            }

            return (
                <>
                    {colonIndex !== -1 && <strong>{tip.substring(0, colonIndex + 1)}</strong>}
                    <span dangerouslySetInnerHTML={{ __html: contentAfterColon }} />
                </>
            );
        };

        return (
            <Modal
                show={showExportModal}
                onHide={handleClose}
                backdrop="static"
                centered
            >
                <Modal.Header closeButton>
                    <Modal.Title className="modal-export-header">В данный момент выполняется</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ position: 'relative', margin: '20px auto', width: 80, height: 80 }}>
                            <Spinner
                                animation="border"
                                role="status"
                                style={{ width: '80px', height: '80px', color: '#0d6efd' }}
                            />
                            <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                fontSize: '24px'
                            }}>
                                📊
                            </div>
                        </div>

                        <p style={{ margin: '15px 0', fontWeight: 'bold' }}>
                            {isClosing ? (
                                "Выгрузка..."
                            ) : showFinalizingMessage ? (
                                "Обработка данных. Это может занять некоторое время..."
                            ) : (
                                exportProgress || 'Выгрузка данных...'
                            )}
                        </p>

                        <div style={{
                            display: 'flex',
                            justifyContent: 'center',
                            margin: '20px 0',
                            gap: '10px'
                        }}>
                            {icons.map((icon, i) => {
                                let opacity = 0.3;
                                if (i === activeIconIndex) opacity = 1;
                                else if (i === (activeIconIndex - 1 + icons.length) % icons.length) opacity = 0.7;
                                else if (i === (activeIconIndex - 2 + icons.length) % icons.length) opacity = 0.5;

                                return (
                                    <div
                                        key={i}
                                        style={{
                                            opacity: opacity,
                                            transition: 'opacity 0.5s ease-in-out',
                                            fontSize: '24px',
                                            transform: opacity === 1 ? 'scale(1.1)' : 'scale(1)',
                                        }}
                                    >
                                        {icon}
                                    </div>
                                );
                            })}
                        </div>

                        <div className="trips-text">
                            {renderTip(tips[currentTipIndex])}
                        </div>
                    </div>
                </Modal.Body>
                <Modal.Footer>
                    <small className="text-muted">
                        {isClosing ? 'Завершаем процесс...' : 'Пожалуйста, не закрывайте это окно до завершения операции'}
                    </small>
                </Modal.Footer>
            </Modal>
        );
    };

    const handleDeleteByParamsChange = (e) => {
        const { name, value } = e.target;
        setDeleteForm(prev => ({ ...prev, [name]: value }));
    };


    const handleDeleteByParamsSubmit = async () => {
        setIsDeleting(true); // Активируем спиннер
        try {
            const token = sessionStorage.getItem('token');

            // Создаем копию формы с триммированными значениями
            const trimmedForm = {
                query: deleteForm.query.trim(),
                brand: deleteForm.brand.trim(),  // или article: deleteForm.article.trim() для SearchByArticle
                city: deleteForm.city.trim()
            };

            const response = await axios.delete(`${API_HOST}/api/queries/by-params/delete`, {
                data: trimmedForm,
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data.deletedCount > 0) {
                // Полностью обновляем список запросов после изменений
                const freshResponse = await axios.get(`${API_HOST}/api/queries`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setAllQueries(freshResponse.data);
                setFilteredQueries(freshResponse.data);
            }

            Toastify({
                text: response.data.message,
                duration: 3000,
                gravity: "top",
                position: "right",
                style: { background: '#00c851' }
            }).showToast();
            // Закрываем модальное окно и очищаем форму
            setShowDeleteByParamsModal(false);
            setDeleteForm({
                query: '',
                brand: '',  // или article: '' для SearchByArticle
                city: 'г.Москва'
            });
        } catch (error) {
            console.error('Ошибка удаления запросов:', error);
            Toastify({
                text: "Ошибка удаления запросов: " + (error.response?.data?.error || error.message),
                duration: 3000,
                gravity: "top",
                position: "right",
                style: { background: '#ff0000' }
            }).showToast();
        } finally {
            setIsDeleting(false); // Выключаем спиннер в любом случае
        }
    };

    return (
        <div className="app-page">
            <header>
                <h1>Позиции товаров на <img className="header-logoWb" src="https://static-basket-01.wbbasket.ru/vol2/site/i/v3/header/logoWb.svg" /></h1>
            </header>
            <div className={`page-link ${!isAuthenticated || showRegisterForm || showForgotPasswordForm ? 'hidden' : ''}`}>
                <nav>
                    <div className="article-brand-link">
                        <div className={`brand-link ${location.pathname === '/' ? 'active-link' : ''}`}>
                            <Link to="/">Поиск по бренду</Link>
                        </div>
                        <div className={`article-link ${location.pathname === '/search-by-article' ? 'active-link' : ''}`}>
                            <Link to="/search-by-article">Поиск по артикулу</Link>
                        </div>
                    </div>
                    <div className="color-theme" onClick={toggleTheme}>
                        {theme === 'light' ? '🌒' : '🌕'}
                    </div>
                </nav>

            </div>
            <div className="container">
                {!isAuthenticated ? (
                    <div className="auth-container">
                        {showRegisterForm ? (
                            <RegisterForm API_HOST={API_HOST} setIsAuthenticated={setIsAuthenticated} setShowProfile={setShowProfile} setShowRegisterForm={setShowRegisterForm} />
                        ) : showForgotPasswordForm ? (
                            <ForgotPasswordForm API_HOST={API_HOST} setShowForgotPasswordForm={setShowForgotPasswordForm} />
                        ) : (
                            <LoginForm API_HOST={API_HOST} setIsAuthenticated={setIsAuthenticated} setShowProfile={setShowProfile} setShowForgotPasswordForm={setShowForgotPasswordForm} setShowRegisterForm={setShowRegisterForm} />
                        )}
                    </div>
                ) : showProfile ? (
                    <div className="query-form">
                        {showResetButton && (
                            <Button className="controls_primary controls_primary_danger" variant="danger" onClick={handleResetForms}>Сбросить</Button>
                        )}
                        <Button variant="danger" className="exit-button" onClick={handleLogout}>Выйти</Button>
                        <h3 className="query-form-title">Страница поиска по описанию и бренду товара</h3>
                        <div className="top-section">
                            <div className="left-forms">
                                {showInitialForm && (
                                    <Form key="initial-form" className="search" onSubmit={(e) => e.preventDefault()}>
                                        <div className="search-container">
                                            <div className="search-left">
                                                <InputGroup className="InputGroupForm">
                                                    <Typeahead
                                                        id="query-input-initial"
                                                        labelKey="label"
                                                        onChange={(selected) => handleQueryChange(selected, requestForms[0].id)}
                                                        onInputChange={(text) => handleQueryInputChange({ target: { value: text } }, requestForms[0].id)}
                                                        options={suggestions}
                                                        placeholder="Введите запрос"
                                                        defaultSelected={requestForms[0].query ? [{ label: requestForms[0].query.toString() }] : []}
                                                        allowNew
                                                        disabled={formsDisabled || isRequesting}
                                                        newSelectionPrefix="Новый запрос: "
                                                        onKeyDown={(e) => handleKeyPress(e, requestForms[0].id)}
                                                        ref={(ref) => (queryTypeaheadRefs.current[0] = ref)} // Сохраняем ref
                                                    />
                                                    <Typeahead
                                                        id="brand-input-initial"
                                                        labelKey="label"
                                                        onChange={(selected) => handleBrandChange(selected, requestForms[0].id)}
                                                        onInputChange={(text) => handleBrandInputChange({ target: { value: text } }, requestForms[0].id)}
                                                        options={brandSuggestions}
                                                        placeholder="Введите бренд"
                                                        defaultSelected={requestForms[0].brand ? [{ label: requestForms[0].brand.toString() }] : []}
                                                        allowNew
                                                        disabled={formsDisabled || isRequesting}
                                                        newSelectionPrefix="Новый бренд: "
                                                        onKeyDown={(e) => handleKeyPress(e, requestForms[0].id)}
                                                        ref={(ref) => (brandTypeaheadRefs.current[0] = ref)} // Сохраняем ref
                                                    />
                                                    <DropdownButton
                                                        disabled={formsDisabled || isRequesting}
                                                        id="dropdown-basic-button"
                                                        title={requestForms[0].city}
                                                        onSelect={(city) => handleCityChange(city, requestForms[0].id)}
                                                    >
                                                        {Object.keys(cityDestinations).map((city) => (
                                                            <Dropdown.Item key={city} eventKey={city}>{city}</Dropdown.Item>
                                                        ))}
                                                    </DropdownButton >
                                                    <Button variant="primary" onClick={fetchProducts} disabled={isRequesting}>Поиск</Button>
                                                    <Button variant="secondary" onClick={() => clearInput(requestForms[0].id)} id="clearButton" disabled={isRequesting}>X</Button>
                                                </InputGroup>
                                            </div>
                                        </div>
                                    </Form>
                                )}

                                {requestForms
                                    .filter((form) => !form.isMain) // Исключаем начальную форму из отображения
                                    .map((form, index) => (
                                        <Form key={form.id} className="search" onSubmit={(e) => e.preventDefault()}>
                                            <div className="search-container">
                                                <div className="search-left">
                                                    <InputGroup className="InputGroupForm">
                                                        <Typeahead
                                                            id={`query-input-${form.id}`}
                                                            disabled={formsDisabled || isRequesting}
                                                            labelKey="label"
                                                            onChange={(selected) => handleQueryChange(selected, form.id)}
                                                            onInputChange={(text) => handleQueryInputChange({ target: { value: text } }, form.id)}
                                                            options={suggestions}
                                                            placeholder="Введите запрос"
                                                            defaultSelected={form.query ? [{ label: form.query.toString() }] : []}
                                                            allowNew
                                                            newSelectionPrefix="Новый запрос: "
                                                            onKeyDown={(e) => handleKeyPress(e, form.id)}
                                                            ref={(ref) => (queryTypeaheadRefs.current[index + 1] = ref)} // Сохраняем ref
                                                        />
                                                        <Typeahead
                                                            id={`brand-input-${form.id}`}
                                                            disabled={formsDisabled || isRequesting}
                                                            labelKey="label"
                                                            onChange={(selected) => handleBrandChange(selected, form.id)}
                                                            onInputChange={(text) => handleBrandInputChange({ target: { value: text } }, form.id)}
                                                            options={brandSuggestions}
                                                            placeholder="Введите бренд"
                                                            defaultSelected={form.brand ? [{ label: form.brand.toString() }] : []}
                                                            allowNew
                                                            newSelectionPrefix="Новый бренд: "
                                                            onKeyDown={(e) => handleKeyPress(e, form.id)}
                                                            ref={(ref) => (brandTypeaheadRefs.current[index + 1] = ref)} // Сохраняем ref
                                                        />
                                                        <DropdownButton
                                                            disabled={formsDisabled || isRequesting}
                                                            id="dropdown-basic-button"
                                                            title={form.city}
                                                            onSelect={(city) => handleCityChange(city, form.id)}>
                                                            {Object.keys(cityDestinations).map((city) => (
                                                                <Dropdown.Item key={city} eventKey={city}>{city}</Dropdown.Item>
                                                            ))}
                                                        </DropdownButton>
                                                        <Button variant="danger" onClick={() => removeRequestForm(form.id)} disabled={isRequesting}>Удалить</Button>
                                                        <Button variant="secondary" onClick={() => clearInput(form.id)} id="clearButton" disabled={isRequesting}>X</Button>
                                                    </InputGroup>
                                                </div>
                                            </div>
                                        </Form>
                                    ))}
                            </div>
                            <div className="right-controls">
                                <div className="controls">
                                   <div className="right-controls-search">
                                       <Button
                                           className="controls_success"
                                           onClick={addRequestForm}
                                           disabled={requestForms.length >= 15}
                                       >
                                           {windowWidth < 768 ? '+ Запрос' : 'Добавить запрос'}
                                       </Button>
                                       <Button className="controls_primary controls_primary_search" onClick={fetchProducts} disabled={isRequesting}>Поиск</Button>
                                       <Button className="controls_primary controls_primary_warning"  variant="warning" onClick={handleSearchAllQueries}>Все запросы</Button>

                                   </div>
                                   <div className="right-controls-exports-sheets">
                                       <Button
                                           className="controls_primary controls_primary_info upload_to_google"
                                           variant="success"
                                           onClick={handleExportAllToGoogleSheet}
                                           title="Выгрузить все данные в Google Таблицу"
                                       >
                                           {isExportingAll ? (
                                               <Spinner
                                                   as="span"
                                                   animation="border"
                                                   size="sm"
                                                   role="status"
                                                   aria-hidden="true"
                                                   style={{ width: '1rem', height: '1rem' }}
                                               />
                                           ) : (
                                               'Выгрузить в Google'
                                           )}
                                       </Button>


                                       <Button
                                           className="controls_primary controls_primary_success"
                                           variant="success"
                                           onClick={() => handleExportToExcelClick('all')}
                                           disabled={isExporting}
                                           title="Выгрузить все данные в Excel"
                                       >
                                           {isExporting ? (
                                               <Spinner
                                                   as="span"
                                                   animation="border"
                                                   size="sm"
                                                   role="status"
                                                   aria-hidden="true"
                                                   style={{ width: '1rem', height: '1rem' }}
                                               />
                                           ) : (
                                               'Выгрузить в Excel'
                                           )}
                                       </Button>
                                   </div>

                                    <div className="open-sheet-and-delete-request">
                                    <Button
                                        className="controls_primary controls_primary_info controls_primary_info_google_sheet"
                                        variant="info"
                                        onClick={handleOpenGoogleSheet}
                                        title="Открыть мою Google Таблицу"
                                    >
                                       Открыть Google таблицу
                                    </Button>
                                    <Button
                                        className="controls_primary_info_delete_request"
                                        variant="danger"
                                        onClick={() => setShowDeleteByParamsModal(true)}
                                        title="Удалить запросы по параметрам"
                                    >
                                        Удалить запрос
                                    </Button>
                                    </div>
                                </div>
                                <div className="search-bar">
                                    <Form className="search" onSubmit={(e) => e.preventDefault()}>
                                        <Form.Control className="search-header" type="text" value={searchTerm} onChange={handleSortInputChange} placeholder="Поиск по заголовкам" />
                                    </Form>
                                </div>
                                <div className="star-mark">
                                    <span className="star">*</span> - это Реклама Аукцион
                                </div>
                            </div>
                        </div>
                        {loadingMessage && <div id="loadingMessage" className="message">{loadingMessage}</div>}
                        {errorMessage && errorMessage !== 'Не удалось загрузить данные.' && (
                            <div id="errorMessage" className="message error">{errorMessage}</div>
                        )}
                        {successMessage && (
                            <Alert id="successMessage" variant="success" className={successMessage === 'По запросу ничего не найдено' ? 'no-results' : ''}>
                                {successMessage}
                            </Alert>
                        )}
                        <Accordion ref={accordionRef} activeKey={activeKey} onSelect={(key) => setActiveKey(key)}>
                            {filteredQueries.map((queryData, index) => {
                                const hasProducts = queryData.productTables && queryData.productTables.some(table => table.products.length > 0);
                                const createdAt = new Date(queryData.createdAt);
                                const date = createdAt.toLocaleDateString();
                                const time = createdAt.toLocaleTimeString();
                                const headerTextItems = queryData.query.split('; ').map((query, i) => {
                                    const brand = queryData.brand.split('; ')[i] || '';
                                    const city = queryData.city.split('; ')[i] || '';
                                    const fullText = `${query} - ${brand} (${city})`;
                                    const searchTermLower = searchTerm.toLowerCase();
                                    const fullTextLower = fullText.toLowerCase();

                                    // Проверяем, есть ли совпадение с поисковым запросом
                                    const hasMatch = searchTerm && fullTextLower.includes(searchTermLower);

                                    // Если есть поисковый запрос и нет совпадения - возвращаем null (не рендерим)
                                    if (searchTerm && !hasMatch) {
                                        return null;
                                    }

                                    // Подсветка совпадений
                                    if (hasMatch) {
                                        const startIndex = fullTextLower.indexOf(searchTermLower);
                                        const endIndex = startIndex + searchTerm.length;
                                        return (
                                            <div key={i}>
                                                {fullText.substring(0, startIndex)}
                                                <span className="search-text-background">
                                                    {fullText.substring(startIndex, endIndex)}
                                                </span>
                                                {fullText.substring(endIndex)}
                                            </div>
                                        );
                                    }

                                    return <div key={i}>{windowWidth < 768 ? truncateText(fullText, 24) : fullText}</div>;
                                }).filter(item => item !== null); // Фильтруем null значения
                                return (
                                    <Accordion.Item eventKey={index.toString()} key={index}>
                                        <Accordion.Header>
                                            <div className="flex-grow-0">{index + 1})</div>
                                            {windowWidth < 768 ? (
                                                <div className="accordion-header-small">
                                                      <span variant="danger" className="delete-button delete-button-small" onClick={(event) => handleDeleteClick(queryData._id, event)}>
                                                        <FaTimes />
                                                      </span>
                                                    <div className="flex-grow-1">{headerTextItems}</div>
                                                    <div className="date-time date-time-small">{time} {date}</div>

                                                    <div className="buttons-sheets">

                                                        <div
                                                            className="upload-requests"
                                                            onClick={(event) => {
                                                                event.stopPropagation();
                                                                handleFillForm(queryData);
                                                            }}
                                                        >
                                                            <span>Запросы</span>
                                                        </div>

                                                        <div
                                                            className="upload-to-google-spreadsheet"
                                                            onClick={(event) => {
                                                                if (exportingStates[queryData._id]) return;
                                                                event.stopPropagation();
                                                                handleExportClick(queryData._id, 'Бренд').then(r => r);
                                                            }}
                                                            style={{ cursor: exportingStates[queryData._id] ? 'not-allowed' : 'pointer' }}
                                                            title={exportingStates[queryData._id] ? 'Идет выгрузка...' : 'Выгрузить в Google Таблицу'}
                                                        >
                                                            {exportingStates[queryData._id] ? (
                                                                <Spinner
                                                                    as="span"
                                                                    animation="border"
                                                                    size="sm"
                                                                    role="status"
                                                                    aria-hidden="true"
                                                                    style={{ width: '1rem', height: '1rem' }}
                                                                />
                                                            ) : (
                                                                <span>В Google</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="flex-grow-1">{headerTextItems}</div>
                                                    <div className="date-time">Дата: {date}, Время: {time}</div>

                                                    <div
                                                        className="upload-requests"
                                                        onClick={(event) => {
                                                            event.stopPropagation();
                                                            handleFillForm(queryData);
                                                        }}
                                                    >
                                                        <span>Использовать эти Запросы</span>
                                                    </div>
                                                    <div
                                                        className="upload-to-google-spreadsheet"
                                                        onClick={(event) => {
                                                            if (exportingStates[queryData._id]) return;
                                                            event.stopPropagation();
                                                            handleExportClick(queryData._id, 'Бренд').then(r => r);
                                                        }}
                                                        style={{ cursor: exportingStates[queryData._id] ? 'not-allowed' : 'pointer' }}
                                                        title={exportingStates[queryData._id] ? 'Идет выгрузка...' : 'Выгрузить в Google Таблицу'}
                                                    >
                                                        {exportingStates[queryData._id] ? (
                                                            <Spinner
                                                                as="span"
                                                                animation="border"
                                                                size="sm"
                                                                role="status"
                                                                aria-hidden="true"
                                                                style={{ width: '1rem', height: '1rem' }}
                                                            />
                                                        ) : (
                                                            <span>Выгрузить в Google</span>
                                                        )}
                                                    </div>
                                                    <div variant="danger" className="delete-button" onClick={(event) => handleDeleteClick(queryData._id, event)}>
                                                        <FaTimes />
                                                    </div>
                                                </>
                                            )}

                                        </Accordion.Header>
                                        <Accordion.Body>
                                            {hasProducts ? (
                                                queryData.productTables.map((table, tableIndex) => {
                                                    const tableQuery = queryData.query.split('; ')[tableIndex] || '';
                                                    const tableBrand = queryData.brand.split('; ')[tableIndex] || '';
                                                    const tableCity = queryData.city.split('; ')[tableIndex] || '';

                                                    const shouldShowTable = searchTerm.trim() === '' ||
                                                        tableQuery.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                        tableBrand.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                                        tableCity.toLowerCase().includes(searchTerm.toLowerCase());

                                                    if (!shouldShowTable) return null;

                                                    return (
                                                        <div className="accordion_body_table" key={tableIndex}>
                                                            <div className="tableIndexDescription">
                                                                <p><strong>{tableIndex + 1})</strong></p>
                                                                <p>По Запросу: <strong>{tableQuery}</strong></p>
                                                                <p>Бренд: <strong>{tableBrand}</strong></p>
                                                                <p>Город: <strong>{tableCity}</strong></p>
                                                            </div>
                                                            {table.products.length > 0 ? (
                                                                <table id="productsTable">
                                                                    <thead>
                                                                    <tr>
                                                                        <th className="th_table">№</th>
                                                                        <th className="th_table">Картинка</th>
                                                                        <th className="th_table">Бренд</th>
                                                                        <th className="th_table">Артикул</th>
                                                                        <th className="th_table">Позиция</th>
                                                                        <th className="th_table">Наименование</th>
                                                                        <th className="th_table">Время запроса</th>
                                                                        <th className="th_table">Дата запроса</th>
                                                                    </tr>
                                                                    </thead>
                                                                    <tbody>
                                                                    {table.products.map((product, i) => {
                                                                        const queryTime = new Date(queryData.queryTime || queryData.createdAt);
                                                                        const date = queryTime.toLocaleDateString();
                                                                        const time = queryTime.toLocaleTimeString();
                                                                        const page = product.page;
                                                                        const position = product.position;
                                                                        return (
                                                                            <tr key={i}>
                                                                                <td className="td_table">{i + 1}</td>
                                                                                <td className="td_table td_table_image">
                                                                                    <img
                                                                                        className="td_table_img"
                                                                                        src={product.imageUrl}
                                                                                        alt={product.name}
                                                                                        onClick={() => handleImageClick(product.imageUrl)}
                                                                                    />
                                                                                </td>
                                                                                <td className="td_table">{product.brand}</td>
                                                                                <td className="td_table td_table_article" onClick={() => handlePageRedirect(product.id)}>
                                                                                    {product.id}
                                                                                </td>
                                                                                <td className="td_table td_table_page" onClick={() => handleProductClick(tableQuery, page, position)}>
                                                                                    {product.log?.promoPosition ? (
                                                                                        <span>
                                                                                    {product.log.promoPosition > 100 ? product.log.promoPosition + 100 : product.log.promoPosition}
                                                                                            <sup style={{ color: 'red', fontWeight: 'bold', marginLeft: '3px' }}>*</sup>
                                                                                        </span>
                                                                                    ) : (
                                                                                        (page - 1 > 0 ? `${page}${position < 10 ? '0' + position : position}` : position)
                                                                                    )}
                                                                                </td>
                                                                                <td className="td_table">{product.name}</td>
                                                                                <td className="td_table">{time}</td>
                                                                                <td className="td_table">{date}</td>
                                                                            </tr>
                                                                        );
                                                                    })}
                                                                    </tbody>
                                                                </table>
                                                            ) : (
                                                                <div className="no-products-message" style={{ backgroundColor: '#ffcccb', color: '#000000', padding: '10px', borderRadius: '5px' }}>
                                                                    <strong>По Запросу:</strong> {tableQuery}
                                                                    <br />
                                                                    <strong>Бренд:</strong> {tableBrand}
                                                                    <br />
                                                                    <strong>Город:</strong> {tableCity}
                                                                    <br />
                                                                    <strong>Товары не найдены.</strong>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            ) : (
                                                <div className="no-products-message" style={{ backgroundColor: '#ffcccb', color: '#000000', padding: '10px', borderRadius: '5px' }}>
                                                    <strong>Запрос:</strong> {queryData.query}
                                                    <br />
                                                    <strong>Бренд:</strong> {queryData.brand}
                                                    <br />
                                                    <strong>Город:</strong> {queryData.city}
                                                    <br />
                                                    <strong>Товары не найдены.</strong>
                                                </div>
                                            )}
                                        </Accordion.Body>
                                    </Accordion.Item>
                                );
                            })}
                        </Accordion>
                        <ImageModal show={modalImage !== null} handleClose={closeModal} imageUrl={modalImage} />
                    </div>
                ) : null}
                <Modal show={showDeleteModal} onHide={() => setShowDeleteModal(false)}>
                    <Modal.Header closeButton>
                        <Modal.Title>Подтверждение удаления</Modal.Title>
                    </Modal.Header>
                    <Modal.Body>Вы уверены, что хотите удалить этот запрос и все связанные с ним данные?</Modal.Body>
                    <Modal.Footer>
                        <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Отменить</Button>
                        <Button
                            variant="danger"
                            onClick={handleDeleteConfirm}
                            disabled={exportingStates[deleteQueryId]} // Блокируем кнопку во время удаления
                            style={{ minWidth: '80px' }} // Фиксируем минимальную ширину
                        >
                            {exportingStates[deleteQueryId] ? (
                                <Spinner
                                    as="span"
                                    animation="border"
                                    size="sm"
                                    role="status"
                                    aria-hidden="true"
                                />
                            ) : (
                                'Удалить'
                            )}
                        </Button>
                    </Modal.Footer>
                </Modal>
            </div>
            <ExportModal />
            <Modal show={showDeleteByParamsModal} onHide={() => setShowDeleteByParamsModal(false)}>
                <Modal.Header closeButton>
                    <Modal.Title>Удаление запроса</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Form>
                        <Form.Group className="mb-3">
                            <Form.Label>Запрос</Form.Label>
                            <Form.Control
                                type="text"
                                name="query"
                                value={deleteForm.query}
                                onChange={handleDeleteByParamsChange}
                                placeholder="Введите запрос для удаления"
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Бренд</Form.Label>
                            <Form.Control
                                type="text"
                                name="brand"
                                value={deleteForm.brand}
                                onChange={handleDeleteByParamsChange}
                                placeholder="Введите бренд для удаления"
                            />
                        </Form.Group>
                        <Form.Group className="mb-3">
                            <Form.Label>Город</Form.Label>
                            <DropdownButton
                                id="dropdown-basic-button"
                                title={deleteForm.city}
                                onSelect={(city) => setDeleteForm(prev => ({ ...prev, city }))}
                            >
                                {Object.keys(cityDestinations).map((city) => (
                                    <Dropdown.Item key={city} eventKey={city}>{city}</Dropdown.Item>
                                ))}
                            </DropdownButton>
                        </Form.Group>
                    </Form>
                    <Alert variant="warning">
                        Осторожно! Будет удалена вся информация по запросу, где все три поля совпадают, и не будут отображаться их прошлые позиции.
                    </Alert>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowDeleteByParamsModal(false)}>
                        Отмена
                    </Button>
                    <Button variant="danger"
                            disabled={isDeleting}
                            style={{ minWidth: '85px' }}
                            onClick={handleDeleteByParamsSubmit}>
                        {isDeleting ? (
                            <Spinner
                                as="span"
                                animation="border"
                                size="sm"
                                role="status"
                                aria-hidden="true"
                            />
                        ) : (
                            'Удалить'
                        )}
                    </Button>
                </Modal.Footer>

            </Modal>
            <Modal show={showExportConfirmation} onHide={() => setShowExportConfirmation(false)} centered>
                <Modal.Header closeButton>
                    <Modal.Title>Подтверждение выгрузки</Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <Alert variant="warning">
                        Внимание! Выгрузка всех данных перезапишет вашу Google Таблицу.<br/>
                        Все текущие данные в таблице будут заменены на данные с этой страницы.
                    </Alert>
                    <p>Вы уверены, что хотите продолжить?</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowExportConfirmation(false)}>
                        Отмена
                    </Button>
                    <Button
                        variant="primary"
                        onClick={() => {
                            setShowExportConfirmation(false);
                            handleExportAllToGoogleSheetConfirmed();
                        }}
                    >
                        Подтвердить выгрузку
                    </Button>
                </Modal.Footer>
            </Modal>
        </div>
    );
}

export default SearchByBrand;