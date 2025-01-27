import React, { useState, useEffect, useRef } from 'react';
import Accordion from 'react-bootstrap/Accordion';
import { Form, Button, InputGroup, Alert, DropdownButton, Dropdown } from 'react-bootstrap';
import './styles.css';

const cityDestinations = {
  'г.Москва': '-1275551',
  'г.Санкт-Петербург': '-1123300',
  'г.Дмитров': '123589350',
  'г.Краснодар': '12358062',
  'г.Казань': '-2133463',
  'г.Бишкек': '286'
};

function App() {
  const [query, setQuery] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [allQueries, setAllQueries] = useState([]);
  const [filteredQueries, setFilteredQueries] = useState([]);
  const [activeKey, setActiveKey] = useState(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedCity, setSelectedCity] = useState('г.Дмитров');
  const [dest, setDest] = useState(cityDestinations[selectedCity]);
  const [retryAttempted, setRetryAttempted] = useState(false);

  const accordionRef = useRef(null);

  useEffect(() => {
    setDest(cityDestinations[selectedCity]);
  }, [selectedCity]);

  useEffect(() => {
    fetchSavedQueries();
  }, []);

  useEffect(() => {
    if (searchTerm.trim() === '') {
      setFilteredQueries(allQueries);
    } else {
      const regex = new RegExp(searchTerm, 'i');
      setFilteredQueries(allQueries.filter(query => regex.test(query.query)));
    }
  }, [searchTerm, allQueries]);

  const fetchSavedQueries = async () => {
    try {
      setLoadingMessage('Загрузка данных...');
      const response = await fetch('http://localhost:5500/api/queries', {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      console.log('response', response);
      if (!response.ok) {
        throw new Error('Ошибка загрузки данных');
      }
      const savedQueries = await response.json();
      console.log('Fetched saved queries:', savedQueries);
      if (Array.isArray(savedQueries)) {
        const adjustedQueries = savedQueries.map(query => {
          const createdAt = new Date(query.createdAt || query.queryTime);
          createdAt.setHours(createdAt.getUTCHours() + 3);
          return {
            ...query,
            createdAt: createdAt.toISOString()
          };
        });
        setAllQueries(adjustedQueries);
        setFilteredQueries(adjustedQueries);
        setRetryAttempted(false); // Успешная загрузка, сброс попыток
      }
      setLoadingMessage('');
    } catch (error) {
      setErrorMessage('Не удалось загрузить данные.');
      console.error(error);

      // Попробовать повторную загрузку, если это первая попытка
      if (!retryAttempted) {
        setRetryAttempted(true);
        setTimeout(fetchSavedQueries, 5000); // Повторная попытка через 5 секунд
      }
    }
  };

  const fetchProducts = async () => {
    if (isRequesting) return;

    setIsRequesting(true);
    setLoadingMessage('Загрузка...');
    setErrorMessage('');
    setSuccessMessage('');

    let searchQuery = query.trim() === '' ? 'Одежда S.Point' : query;

    try {
      const response = await fetch(`http://localhost:5500/api/products?query=${encodeURIComponent(searchQuery)}&dest=${encodeURIComponent(dest)}&city=${encodeURIComponent(selectedCity)}`);
      const productsData = await response.json();
      setLoadingMessage('');

      if (!Array.isArray(productsData)) {
        setErrorMessage('Товары не найденны');
        setTimeout(() => {
          setErrorMessage('');
        }, 3000);
      } else if (productsData.length === 0) {
        setErrorMessage('Товары не найдены');
        setTimeout(() => {
          setErrorMessage('');
        }, 3000);
      } else {
        const now = new Date();
        now.setHours(now.getUTCHours() + 3);
        const queryTime = now.toISOString();

        const newQueries = [{ query: searchQuery, products: productsData, queryTime, city: selectedCity }, ...allQueries];
        setAllQueries(newQueries);
        setFilteredQueries(newQueries);
        setActiveKey('0');
        setSuccessMessage('Запрос выполнен успешно!');
        clearInput();
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);

        // Прокрутка аккордеона к заголовку новой загруженной информации
        setTimeout(() => {
          const newAccordionItem = document.querySelector(`.accordion .accordion-item:first-child`);
          if (newAccordionItem) {
            newAccordionItem.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 100); // Небольшая задержка для корректной работы скролла
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setLoadingMessage('');
      setErrorMessage('Ошибка получения данных');
    }

    setIsRequesting(false);
  };

  const handleQueryInputChange = (e) => {
    setQuery(e.target.value);
    if (e.target.value.trim() !== '') {
      setSearchTerm('');
    } else {
      fetchSavedQueries();
    }
  };

  const handleSortInputChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);
    if (value.trim() !== '') {
      setQuery('');
    } else {
      fetchSavedQueries();
    }
  };

  const clearInput = () => setQuery('');
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') fetchProducts();
  };

  return (
      <div>
        <header>
          <h1>Поиск товаров S.Point в Wildberries</h1>
        </header>
        <div className="container">
          <Form className="search" onSubmit={(e) => e.preventDefault()}>
            <div className="search-container">
              <div className="search-left">
                <InputGroup className="InputGroupForm">
                  <Form.Control
                      type="text"
                      value={query}
                      onChange={handleQueryInputChange}
                      onKeyPress={handleKeyPress}
                      placeholder="Введите запрос"
                      required
                      disabled={isRequesting}
                  />
                  <DropdownButton id="dropdown-basic-button" title={selectedCity}>
                    {Object.keys(cityDestinations).map((city) => (
                        <Dropdown.Item key={city} onClick={() => setSelectedCity(city)}>
                          {city}
                        </Dropdown.Item>
                    ))}
                  </DropdownButton>
                  <Button variant="primary" onClick={fetchProducts} disabled={isRequesting}>
                    Поиск
                  </Button>
                  <Button variant="secondary" onClick={clearInput} id="clearButton" disabled={isRequesting}>
                    X
                  </Button>
                </InputGroup>
              </div>
              <div className="search-right">
                <InputGroup>
                  <Form.Control
                      type="text"
                      value={searchTerm}
                      onChange={handleSortInputChange}
                      placeholder="Поиск по заголовкам"
                  />
                </InputGroup>
              </div>
            </div>
          </Form>
          {loadingMessage && <div id="loadingMessage" className="message">{loadingMessage}</div>}
          {errorMessage && errorMessage !== 'Не удалось загрузить данные.' && (
              <div id="errorMessage" className="message error">{errorMessage}</div>
          )}
          {successMessage && <Alert id="successMessage" variant="success">{successMessage}</Alert>}
          <Accordion ref={accordionRef} activeKey={activeKey} onSelect={(key) => setActiveKey(key)}>
            {filteredQueries.map((queryData, index) => {
              // Проверяем, есть ли найденные элементы
              const hasProducts = Array.isArray(queryData.products || queryData.response) && (queryData.products || queryData.response).length > 0;
              if (!hasProducts) {
                return null; // Пропускаем создание заголовка без контента
              }

              const dateTime = queryData.queryTime || queryData.createdAt;
              const createdAt = new Date(dateTime);
              const date = createdAt.toLocaleDateString();
              const time = createdAt.toLocaleTimeString();
              const headerText =
                  queryData.query === '1' ? 'Товары с главной страницы' : queryData.city ? `${queryData.query} (${queryData.city})` : queryData.query;
              return (
                  <Accordion.Item eventKey={index.toString()} key={index}>
                    <Accordion.Header>
                      <div className="flex-grow-0">{index + 1})</div>
                      <div className="flex-grow-1">{headerText}</div>
                      <div className="date-time">
                        Дата: {date}, Время: {time}
                      </div>
                    </Accordion.Header>
                    <Accordion.Body>
                      <table id="productsTable">
                        <thead>
                        <tr>
                          <th className="th_table">№</th>
                          <th className="th_table">Артикул</th>
                          <th className="th_table">Страница</th>
                          <th className="th_table">Позиция</th>
                          <th className="th_table">Бренд</th>
                          <th className="th_table">Наименование</th>
                          <th className="th_table">Дата запроса</th>
                          <th className="th_table">Время запроса</th>
                        </tr>
                        </thead>
                        <tbody>
                        {Array.isArray(queryData.products || queryData.response) && (queryData.products || queryData.response).map((product, i) => {
                          const queryTime = queryData.queryTime || queryData.createdAt;
                          const createdAt = new Date(queryTime);
                          const date = createdAt.toLocaleDateString();
                          const time = createdAt.toLocaleTimeString();
                          return (
                              <tr key={i}>
                                <td className="td_table">{i + 1}</td>
                                <td className="td_table">{product.id}</td>
                                <td className="td_table">{product.page}</td>
                                <td className="td_table">{product.position}</td>
                                <td className="td_table">{product.brand}</td>
                                <td className="td_table">{product.name}</td>
                                <td className="td_table">{date}</td>
                                <td className="td_table">{time}</td>
                              </tr>
                          );
                        })}
                        </tbody>
                      </table>
                    </Accordion.Body>
                  </Accordion.Item>
              );
            })}
          </Accordion>
        </div>
      </div>
  );
}

export default App;

