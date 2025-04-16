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
        setSearchTerm(value.trim());
        if (value.trim() !== '') {
            setQuery('');
        } else {
            fetchSavedQueries();
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
        document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
        setModalImage(null);
        document.body.style.overflow = 'auto';
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
            }
        }
    };

    const handleExportClick = async (queryId, sheetName) => {
        if (exportingStates[queryId]) return; // Блокируем повторные клики
        setExportingStates((prev) => ({ ...prev, [queryId]: true })); // Устанавливаем состояние "выгрузка в процессе" для конкретной кнопки

        try {
            const token = sessionStorage.getItem('token');
            const response = await axios.post(`${API_HOST}/api/queries/export`, { queryId, sheetName }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
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
        }
    };

    const handleExportToExcelClick = async (queryId) => {
        if (isExporting) return;
        setIsExporting(true);

        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(`${API_HOST}/api/queries/export-excel`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Ошибка выгрузки данных');
            }

            // Формируем имя файла с текущей датой и временем
            const now = new Date();
            const day = String(now.getDate()).padStart(2, '0');
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const year = now.getFullYear();
            const hours = String(now.getHours()).padStart(2, '0');
            const minutes = String(now.getMinutes()).padStart(2, '0');
            const seconds = String(now.getSeconds()).padStart(2, '0');

            const dateStr = `export_all_${day}-${month}-${year}_${hours}-${minutes}-${seconds}.xlsx`;

            // Получаем имя файла из заголовка или используем сформированное
            const contentDisposition = response.headers.get('Content-Disposition');
            let fileName = contentDisposition
                ? (contentDisposition.match(/filename=(.+)/)?.[1] || dateStr)
                : dateStr;

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
                text: 'Все данные успешно выгружены в Excel',
                duration: 3000,
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
                Toastify({
                    text: 'Google Таблица не найдена',
                    duration: 3000,
                    gravity: 'top',
                    position: 'right',
                    style: { background: '#ff0000' }
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
                                                        <Button variant="danger" onClick={() => removeRequestForm(form.id)}>Удалить</Button>
                                                        <Button variant="secondary" onClick={() => clearInput(form.id)} id="clearButton" disabled={isRequesting}>X</Button>
                                                    </InputGroup>
                                                </div>
                                            </div>
                                        </Form>
                                    ))}
                            </div>
                            <div className="right-controls">
                                <div className="controls">
                                    <Button
                                        className="controls_success"
                                        onClick={addRequestForm}
                                        disabled={requestForms.length >= 15}
                                    >
                                        Добавить запрос
                                    </Button>
                                    <Button className="controls_primary" onClick={fetchProducts} disabled={isRequesting}>Поиск</Button>
                                    <Button className="controls_primary controls_primary_warning"  variant="warning" onClick={handleSearchAllQueries}>Все запросы</Button>
                                    <Button
                                        className="controls_primary controls_primary_info"
                                        variant="info"
                                        onClick={handleOpenGoogleSheet}
                                        title="Открыть мою Google Таблицу"
                                    >
                                       Google таблица
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
                                <div className="search-bar">
                                    <Form className="search" onSubmit={(e) => e.preventDefault()}>
                                        <Form.Control type="text" value={searchTerm} onChange={handleSortInputChange} placeholder="Поиск по заголовкам" />
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
                                    const truncatedText = windowWidth < 768 ? truncateText(fullText, 24) : fullText; // Обрезаем текст для мобильных устройств
                                    return <div key={i}>{truncatedText}</div>;
                                });

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
                                                queryData.productTables.map((table, tableIndex) => (
                                                    <div className="accordion_body_table" key={tableIndex}>
                                                        <div className="tableIndexDescription">
                                                            <p><strong>{tableIndex + 1})</strong></p>
                                                            <p>По Запросу: <strong>{queryData.query.split('; ')[tableIndex]}</strong></p>
                                                            <p>Бренд: <strong>{queryData.brand.split('; ')[tableIndex]}</strong></p>
                                                            <p>Город: <strong>{queryData.city.split('; ')[tableIndex]}</strong></p>
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
                                                                    {/*<th className="th_table">Прежняя Позиция</th>*/}
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
                                                                            <td className="td_table td_table_page" onClick={() => handleProductClick(queryData.query.split('; ')[tableIndex], page, position)}>
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
                                                            <div className="no-products-message" >
                                                                <strong>По Запросу:</strong> {queryData.query.split('; ')[tableIndex]}
                                                                <br />
                                                                <strong>Бренд:</strong> {queryData.brand.split('; ')[tableIndex]}
                                                                <br />
                                                                <strong>Город:</strong> {queryData.city.split('; ')[tableIndex]}
                                                                <br />
                                                                <strong>Товары не найдены.</strong>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
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
                        <Button variant="danger" onClick={handleDeleteConfirm}>Удалить</Button>
                    </Modal.Footer>
                </Modal>
            </div>
        </div>
    );
}

export default SearchByBrand;