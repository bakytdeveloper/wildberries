import Accordion from 'react-bootstrap/Accordion';
import "toastify-js/src/toastify.css";
import '../../styles.css';
import React, { useState, useEffect, useRef } from 'react';
import { Form, Button, InputGroup, DropdownButton, Dropdown, Alert, Spinner } from 'react-bootstrap';
import Toastify from 'toastify-js';
import { Typeahead } from 'react-bootstrap-typeahead';
import cityDestinations from '../../utils/cityDestinations';
import RegisterForm from '../Auth/RegisterForm';
import LoginForm from '../Auth/LoginForm';
import ForgotPasswordForm from '../Auth/ForgotPasswordForm';
import ImageModal from '../ImageModal';
import { FaTimes } from 'react-icons/fa';
import { Modal } from 'react-bootstrap';
import { Link, useLocation } from 'react-router-dom';
import axios from "axios";

function SearchByArticle() {
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
    const [articleSuggestions, setArticleSuggestions] = useState([]);
    const [exportingStates, setExportingStates] = useState({});
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);
    const [requestForms, setRequestForms] = useState([{ id: Date.now(), query: '', article: '', city: 'г.Москва', isMain: true }]);
    const queryTypeaheadRefs = useRef([]);
    const articleTypeaheadRefs = useRef([]);
    const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');
    const location = useLocation();
    const API_HOST = process.env.REACT_APP_API_HOST;
    const [exportingToExcelStates, setExportingToExcelStates] = useState({});
    const [showInitialForm, setShowInitialForm] = useState(true); // Состояние для управления видимостью начальной формы
    const [showResetButton, setShowResetButton] = useState(false);

    useEffect(() => {
        document.body.setAttribute('data-theme', theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
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
            const response = await fetch(`${API_HOST}/api/article`, {
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

                    const uniqueQueries = [...new Set(savedQueries.flatMap(query => query.query.split('; ').filter(Boolean)))];
                    setSuggestions(uniqueQueries.map(item => ({ label: item.toString() })));

                    const uniqueArticles = [...new Set(savedQueries.flatMap(query => query.article.split('; ').filter(Boolean)))];
                    setArticleSuggestions(uniqueArticles.map(item => ({ label: item.toString() })));
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
        setRequestForms(prevForms =>
            prevForms.map(f =>
                f.id === formId ? { ...f, query: value } : f
            )
        );
        // Обновляем список suggestions
        if (value && !suggestions.some(suggestion => suggestion.label === value)) {
            setSuggestions(prevSuggestions => [...prevSuggestions, { label: value }]);
        }

    };

    const handleArticleChange = (selected, formId) => {
        const value = selected.length > 0 ? selected[0].label : '';
        setRequestForms(prevForms =>
            prevForms.map(f =>
                f.id === formId ? { ...f, article: value } : f
            )
        );

        // Обновляем список brandSuggestions
        if (value && !articleSuggestions.some(brand => brand.label === value)) {
            setArticleSuggestions(prevArticleSuggestions => [...prevArticleSuggestions, { label: value }]);
        }


    };

    const handleQueryInputChange = (event, formId) => {
        const text = event.target.value;
        // console.log('Query input change:', text.target.value);
        setRequestForms(prevForms => prevForms.map(f =>
            f.id === formId ? { ...f, query: text.target.value } : f
        ));
    };

    const handleArticleInputChange = (event, formId) => {
        const text = event.target.value;
        // console.log('Brand input change:', text);
        setRequestForms(prevForms => prevForms.map(f =>
            f.id === formId ? { ...f, article: text.target.value } : f ));
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

    useEffect(() => {
        queryTypeaheadRefs.current = queryTypeaheadRefs.current.slice(0, requestForms.length);
        articleTypeaheadRefs.current = articleTypeaheadRefs.current.slice(0, requestForms.length);
    }, [requestForms]);

    const clearInput = (formId) => {
        setRequestForms(requestForms.map(f => f.id === formId ? { ...f, query: '', article: '', city: 'г.Москва' } : f));

        const formIndex = requestForms.findIndex(f => f.id === formId);
        if (queryTypeaheadRefs.current[formIndex]) {
            queryTypeaheadRefs.current[formIndex].clear();
        }
        if (articleTypeaheadRefs.current[formIndex]) {
            articleTypeaheadRefs.current[formIndex].clear();
        }
    };

    const handleKeyPress = (e, formId) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            fetchProductsByArticle();
        }
    };

    const addRequestForm = () => {
        setRequestForms([...requestForms, { id: Date.now(), query: '', article: '', city: 'г.Москва', isMain: false }]);
    };

    const removeRequestForm = (formId) => {
        setRequestForms((prevForms) => {
            const updatedForms = prevForms.filter((f) => f.id !== formId);

            if (updatedForms.length === 1) {
                setShowInitialForm(true); // Показываем начальную форму
                return [{ id: Date.now(), query: '', article: '', city: 'г.Москва', isMain: true }];
            }

            return updatedForms;
        });
    };

    const handleImageClick = (imageUrl) => {
        setModalImage(imageUrl);
        document.body.style.overflow = 'hidden';
    };

    const closeModal = () => {
        setModalImage(null);
        document.body.style.overflow = 'auto';
    };


    const fetchProductsByArticle = async () => {
        if (isRequesting) return;
        // console.log('Request forms before validation:', requestForms);

        const validForms = requestForms.filter(form => {
            const query = form.query && typeof form.query === 'string' ? form.query.trim() : '';
            const article = form.article && typeof form.article === 'string' ? form.article.trim() : '';
            return query !== '' && article !== '';
        });

        // console.log('Valid forms after validation:', validForms);
        if (validForms.length === 0) {
            Toastify({
                text: "Все формы должны быть заполнены.",
                duration: 3000,
                gravity: "top",
                position: "right",
                style: { background: '#ff0000' }
            }).showToast();
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
                query: form.query && typeof form.query === 'string' ? form.query.trim() : '',
                article: form.article && typeof form.article === 'string' ? form.article.trim() : '',
                dest: cityDestinations[form.city],
                city: form.city,
                queryTime: new Date().toISOString()
            }));

            // console.log('Trimmed forms before sending:', trimmedForms);
            const response = await fetch(`${API_HOST}/api/article`, {
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

            const newQueries = validForms.map(form => form.query && typeof form.query === 'string' ? form.query.trim() : '');
            const newSuggestions = [...suggestions];
            newQueries.forEach(query => {
                if (!newSuggestions.some(suggestion => suggestion.label === query)) {
                    newSuggestions.push({ label: query });
                }
            });
            setSuggestions(newSuggestions);

            const newArticles = validForms.map(form => form.article && typeof form.article === 'string' ? form.article.trim() : '');
            const newArticleSuggestions = [...articleSuggestions];
            newArticles.forEach(article => {
                if (!newArticleSuggestions.some(articleSuggestion => articleSuggestion.label === article)) {
                    newArticleSuggestions.push({ label: article });
                }
            });
            setArticleSuggestions(newArticleSuggestions);

            setLoadingMessage('');
            clearInput(requestForms[0].id);
            setRequestForms([{ id: Date.now(), query: '', article: '', city: 'г.Москва', isMain: true }]);
            setShowInitialForm(true); // Показываем начальную форму после выполнения поиска
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
        }
    };

    const handleProductClick = (searchQuery, page, position) => {
        const url = `https://www.wildberries.ru/catalog/0/search.aspx?page=${page}&sort=popular&search=${encodeURIComponent(searchQuery)}#position=${position}`;
        window.open(url, '_blank');
    };

    const handlePageRedirect = (productId) => {
        const url = `https://www.wildberries.ru/catalog/${productId}/detail.aspx`;
        window.open(url, '_blank');
    };

    const handleDeleteClick = (queryId, event) => {
        event.stopPropagation();
        setDeleteQueryId(queryId);
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        try {
            const token = sessionStorage.getItem('token');
            const response = await fetch(`${API_HOST}/api/article/${deleteQueryId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (response.status !== 200) {
                throw new Error('Ошибка удаления запроса');
            }
            setAllQueries(allQueries.filter(query => query._id !== deleteQueryId));
            setFilteredQueries(filteredQueries.filter(query => query._id !== deleteQueryId));
            setShowDeleteModal(false);
            Toastify({
                text: "Запрос успешно удален.",
                duration: 3000,
                gravity: "top",
                position: "right",
                style: { background: '#00c851' }
            }).showToast();
        } catch (error) {
            console.error('Error deleting query:', error);
            setErrorMessage('Ошибка удаления запроса');
        }
    };

    const handleExportClick = async (queryId, sheetName) => {
        if (exportingStates[queryId]) return;
        setExportingStates((prev) => ({ ...prev, [queryId]: true }));

        try {
            const token = sessionStorage.getItem('token');
            const response = await axios.post(`${API_HOST}/api/article/export`, { queryId, sheetName }, {
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
            setExportingStates((prev) => ({ ...prev, [queryId]: false }));
        }
    };

    const handleExportToExcelClick = async (queryId, sheetName) => {
        if (exportingToExcelStates[queryId]) return;
        setExportingToExcelStates((prev) => ({ ...prev, [queryId]: true }));

        try {
            const token = sessionStorage.getItem('token');
            const response = await axios.post(`${API_HOST}/api/article/export-excel`, { queryId, sheetName }, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            Toastify({
                text: 'Данные успешно выгружены в Excel.',
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
            setExportingToExcelStates((prev) => ({ ...prev, [queryId]: false }));
        }
    };

    const handleResetForms = () => {
        setRequestForms([{ id: Date.now(), query: '', brand: '', city: 'г.Москва', isMain: true }]);
        setShowInitialForm(true);
        setShowResetButton(false);
    };

    const handleFillForm = (queryData) => {
        const queries = queryData.query.split('; ');
        const articles = queryData.article.split('; ');
        const cities = queryData.city.split('; ');

        const newForms = queries.map((query, index) => ({
            id: Date.now() + index,
            query: query,
            article: articles[index] || '',
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
                        existingForm.article === newForm.article &&
                        existingForm.city === newForm.city
                );
            });

            if (uniqueNewForms.length > 0) {
                setShowInitialForm(false); // Скрываем начальную форму
                setShowResetButton(true); // Показываем кнопку сброса
                return [mainForm, ...otherForms, ...uniqueNewForms];
            }

            return prevForms;
        });
    };

    const handleSearchAllQueries = () => {
        const allQueriesData = filteredQueries.flatMap(queryData => {
            const queries = queryData.query.split('; ');
            const articles = queryData.article.split('; ');
            const cities = queryData.city.split('; ');

            return queries.map((query, index) => ({
                query: query.trim(),
                article: articles[index]?.trim() || '',
                city: cities[index]?.trim() || 'г.Москва'
            }));
        });

        const uniqueQueriesData = Array.from(new Set(allQueriesData.map(JSON.stringify))).map(JSON.parse);

        const newForms = uniqueQueriesData.map((data, index) => ({
            id: Date.now() + index,
            query: data.query,
            article: data.article,
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
                        existingForm.article === newForm.article &&
                        existingForm.city === newForm.city
                );
            });

            if (uniqueNewForms.length > 0) {
                setShowInitialForm(false); // Скрываем начальную форму
                setShowResetButton(true); // Показываем кнопку сброса
                return [mainForm, ...otherForms, ...uniqueNewForms];
            }

            return prevForms;
        });
    };

    return (
        <div className="article-page">
            <header>
                <h1>Поиск товаров на <img className="header-logoWb" src="https://static-basket-01.wbbasket.ru/vol2/site/i/v3/header/logoWb.svg" /></h1>
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
                        <h3 className="query-form-title">Страница поиска по описанию и артикулу товара</h3>
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
                                                        newSelectionPrefix="Новый запрос: "
                                                        onKeyDown={(e) => handleKeyPress(e, requestForms[0].id)}
                                                        ref={(ref) => (queryTypeaheadRefs.current[0] = ref)}
                                                    />
                                                    <Typeahead
                                                        id="article-input-initial"
                                                        labelKey="label"
                                                        onChange={(selected) => handleArticleChange(selected, requestForms[0].id)}
                                                        onInputChange={(text) => handleArticleInputChange({ target: { value: text } }, requestForms[0].id)}
                                                        options={articleSuggestions}
                                                        placeholder="Введите артикул"
                                                        defaultSelected={requestForms[0].article ? [{ label: requestForms[0].article.toString() }] : []}
                                                        allowNew
                                                        newSelectionPrefix="Новый артикул: "
                                                        onKeyDown={(e) => handleKeyPress(e, requestForms[0].id)}
                                                        ref={(ref) => (articleTypeaheadRefs.current[0] = ref)}
                                                    />
                                                    <DropdownButton id="dropdown-basic-button" title={requestForms[0].city} onSelect={(city) => handleCityChange(city, requestForms[0].id)}>
                                                        {Object.keys(cityDestinations).map((city) => (
                                                            <Dropdown.Item key={city} eventKey={city}>{city}</Dropdown.Item>
                                                        ))}
                                                    </DropdownButton>
                                                    <Button variant="primary" onClick={fetchProductsByArticle} disabled={isRequesting}>Поиск</Button>
                                                    <Button variant="secondary" onClick={() => clearInput(requestForms[0].id)} id="clearButton" disabled={isRequesting}>X</Button>
                                                </InputGroup>
                                            </div>
                                        </div>
                                    </Form>
                                )}

                                {requestForms
                                    .filter((form) => !form.isMain)
                                    .map((form, index) => (
                                        <Form key={form.id} className="search" onSubmit={(e) => e.preventDefault()}>
                                            <div className="search-container">
                                                <div className="search-left">
                                                    <InputGroup className="InputGroupForm">
                                                        <Typeahead
                                                            id={`query-input-${form.id}`}
                                                            labelKey="label"
                                                            onChange={(selected) => handleQueryChange(selected, form.id)}
                                                            onInputChange={(text) => handleQueryInputChange({ target: { value: text } }, form.id)}
                                                            options={suggestions}
                                                            placeholder="Введите запрос"
                                                            defaultSelected={form.query ? [{ label: form.query.toString() }] : []}
                                                            allowNew
                                                            newSelectionPrefix="Новый запрос: "
                                                            onKeyDown={(e) => handleKeyPress(e, form.id)}
                                                            ref={(ref) => (queryTypeaheadRefs.current[index + 1] = ref)}
                                                        />
                                                        <Typeahead
                                                            id={`article-input-${form.id}`}
                                                            labelKey="label"
                                                            onChange={(selected) => handleArticleChange(selected, form.id)}
                                                            onInputChange={(text) => handleArticleInputChange({ target: { value: text } }, form.id)}
                                                            options={articleSuggestions}
                                                            placeholder="Введите артикул"
                                                            defaultSelected={form.article ? [{ label: form.article.toString() }] : []}
                                                            allowNew
                                                            newSelectionPrefix="Новый артикул: "
                                                            onKeyDown={(e) => handleKeyPress(e, form.id)}
                                                            ref={(ref) => (articleTypeaheadRefs.current[index + 1] = ref)}
                                                        />
                                                        <DropdownButton id="dropdown-basic-button" title={form.city} onSelect={(city) => handleCityChange(city, form.id)}>
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
                                    <Button className="controls_success" onClick={addRequestForm}>Добавить запрос</Button>
                                    <Button className="controls_primary" onClick={fetchProductsByArticle} disabled={isRequesting}>Поиск</Button>
                                    <Button className="controls_primary controls_primary_warning"  variant="warning" onClick={handleSearchAllQueries}>Все запросы</Button>
                                </div>
                                <div className="search-bar">
                                    <Form className="search" onSubmit={(e) => e.preventDefault()}>
                                        <Form.Control type="text" value={searchTerm} onChange={handleSortInputChange} placeholder="Поиск по заголовкам" />
                                    </Form>
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
                                const headerTextItems = queryData.query?.split('; ').map((query, i) => {
                                    const article = queryData.article?.split('; ')[i] || '';
                                    const city = queryData.city?.split('; ')[i] || '';
                                    const fullText = `${query} - ${article} (${city})`;
                                    const truncatedText = windowWidth < 768 ? truncateText(fullText, 24) : fullText;
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
                                                            className="upload-to-excel"
                                                            onClick={(event) => {
                                                                if (exportingToExcelStates[queryData._id]) return;
                                                                event.stopPropagation();
                                                                handleExportToExcelClick(queryData._id, 'Артикул').then(r => r);
                                                            }}
                                                            style={{ cursor: exportingToExcelStates[queryData._id] ? 'not-allowed' : 'pointer' }}
                                                            title={exportingToExcelStates[queryData._id] ? 'Идет выгрузка...' : 'Выгрузить в Excel'}
                                                        >
                                                            {exportingToExcelStates[queryData._id] ? (
                                                                <Spinner
                                                                    as="span"
                                                                    animation="border"
                                                                    size="sm"
                                                                    role="status"
                                                                    aria-hidden="true"
                                                                    style={{ width: '1rem', height: '1rem' }}
                                                                />
                                                            ) : (
                                                                <span>Excel</span>
                                                            )}
                                                        </div>

                                                        <div
                                                            className="upload-to-google-spreadsheet"
                                                            onClick={(event) => {
                                                                if (exportingStates[queryData._id]) return;
                                                                event.stopPropagation();
                                                                handleExportClick(queryData._id, 'Артикул').then(r => r);
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
                                                                <span>Google</span>
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
                                                        <span>Запросы</span>
                                                    </div>
                                                    <div
                                                        className="upload-to-excel"
                                                        onClick={(event) => {
                                                            if (exportingToExcelStates[queryData._id]) return;
                                                            event.stopPropagation();
                                                            handleExportToExcelClick(queryData._id, 'Артикул').then(r => r);
                                                        }}
                                                        style={{ cursor: exportingToExcelStates[queryData._id] ? 'not-allowed' : 'pointer' }}
                                                        title={exportingToExcelStates[queryData._id] ? 'Идет выгрузка...' : 'Выгрузить в Excel'}
                                                    >
                                                        {exportingToExcelStates[queryData._id] ? (
                                                            <Spinner
                                                                as="span"
                                                                animation="border"
                                                                size="sm"
                                                                role="status"
                                                                aria-hidden="true"
                                                                style={{ width: '1rem', height: '1rem' }}
                                                            />
                                                        ) : (
                                                            <span>Выгрузить в Excel</span>
                                                        )}
                                                    </div>

                                                    <div
                                                        className="upload-to-google-spreadsheet"
                                                        onClick={(event) => {
                                                            if (exportingStates[queryData._id]) return;
                                                            event.stopPropagation();
                                                            handleExportClick(queryData._id, 'Артикул').then(r => r);
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
                                                            <p>По Запросу: <strong>{queryData.query?.split('; ')[tableIndex]}</strong></p>
                                                            <p>Артикул: <strong>{queryData.article?.split('; ')[tableIndex]}</strong></p>
                                                            <p>Город: <strong>{queryData.city?.split('; ')[tableIndex]}</strong></p>
                                                        </div>
                                                        {table.products.length > 0 ? (
                                                            <table id="productsTable">
                                                                <thead>
                                                                <tr>
                                                                    <th className="th_table">№</th>
                                                                    <th className="th_table">Картинка</th>
                                                                    <th className="th_table">Артикул</th>
                                                                    <th className="th_table">Позиция</th>
                                                                    {/*<th className="th_table">Прежняя Позиция</th>*/}
                                                                    <th className="th_table">Бренд</th>
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
                                                                                <img className="td_table_img" src={product.imageUrl} alt={product.name} onClick={() => handleImageClick(product.imageUrl)} />
                                                                            </td>
                                                                            <td className="td_table td_table_article" onClick={() => handlePageRedirect(product.id)}>
                                                                                {product.id}
                                                                            </td>
                                                                            <td className="td_table td_table_page" onClick={() => handleProductClick(queryData.query.split('; ')[tableIndex], page, position)}>
                                                                                {product.log?.promoPosition ? (
                                                                                    <span>
                                                                                        {product.log.promoPosition}
                                                                                        <sup style={{ color: 'red', fontWeight: 'bold', marginLeft:'3px' }}>*</sup>
                                                                                    </span>
                                                                                ) : (
                                                                                    (page - 1 > 0 ? `${page}${position < 10 ? '0' + position : position}` : position)
                                                                                )}                                                                            </td>
                                                                            {/*<td className="td_table">{product.log?.position || (page - 1 > 0 ? `${page}${position < 10 ? '0' + position : position}` : position)}</td>*/}
                                                                            <td className="td_table">{product.brand}</td>
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
                                                                <strong>По Запросу:</strong> {queryData.query?.split('; ')[tableIndex]}
                                                                <br />
                                                                <strong>Артикул:</strong> {queryData.article?.split('; ')[tableIndex]}
                                                                <br />
                                                                <strong>Город:</strong> {queryData.city?.split('; ')[tableIndex]}
                                                                <br />
                                                                <strong>Товары не найдены.</strong>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))
                                            ) : (
                                                <div className="no-products-message" style={{ backgroundColor: '#ffcccb', color: '#000000', padding: '10px', borderRadius: '5px' }}>
                                                    <strong>Запрос:</strong> {queryData?.query}
                                                    <br />
                                                    <strong>Артикул:</strong> {queryData?.article}
                                                    <br />
                                                    <strong>Город:</strong> {queryData?.city}
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

export default SearchByArticle;