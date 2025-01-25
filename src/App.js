import React, { useState, useEffect } from 'react';
import Accordion from 'react-bootstrap/Accordion';
import { Form, Button, InputGroup, Alert, DropdownButton, Dropdown } from 'react-bootstrap';
import './styles.css'; // Подключаем CSS стили

const cityDestinations = {
  'г.Москва': '-1275551',
  'г.Санкт-Петербург': '-1123300',
  'г.Дмитров': '123589350',
  'г.Краснодар': '12358062',
  'г.Казань': '-2133462',
  'г.Бишкек': '286'
};

function App() {
  const [query, setQuery] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [allQueries, setAllQueries] = useState([]);
  const [activeKey, setActiveKey] = useState(null);
  const [isRequesting, setIsRequesting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [selectedCity, setSelectedCity] = useState('г.Дмитров'); // По умолчанию Дмитров
  const [dest, setDest] = useState(cityDestinations['г.Дмитров']); // По умолчанию значение для Дмитрова

  useEffect(() => {
    setDest(cityDestinations[selectedCity]);
  }, [selectedCity]);

  const fetchProducts = async () => {
    if (isRequesting) return; // Если запрос уже выполняется, выходим

    setIsRequesting(true); // Устанавливаем флаг выполнения запроса
    setLoadingMessage('Загрузка...');
    setErrorMessage('');
    setSuccessMessage('');

    let searchQuery = query || 'Одежда S.Point';

    try {
      const response = await fetch(`http://localhost:5500/api/products?query=${encodeURIComponent(searchQuery)}&dest=${encodeURIComponent(dest)}`);
      const productsData = await response.json();
      setLoadingMessage('');

      if (!Array.isArray(productsData)) {
        setErrorMessage('Ошибка получения данных');
      } else if (productsData.length === 0) {
        setErrorMessage('Товары не найдены');
        setTimeout(() => {
          setErrorMessage('');
        }, 3000);
      } else {
        const now = new Date();
        now.setHours(now.getHours() + 3);
        const queryTime = now.toISOString();
        const newQueries = [{ query: searchQuery, products: productsData, queryTime }, ...allQueries];
        setAllQueries(newQueries);
        setActiveKey('0');
        setSuccessMessage('Запрос выполнен успешно!');
        clearInput();
        setTimeout(() => {
          setSuccessMessage('');
        }, 3000);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setLoadingMessage('');
      setErrorMessage('Ошибка получения данных');
    }

    setIsRequesting(false); // Снимаем флаг выполнения запроса
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
            <InputGroup className="InputGroupForm">
              <Form.Control
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Введите запрос"
                  required
                  disabled={isRequesting}
              />
              <DropdownButton id="dropdown-basic-button" title={selectedCity}>
                {Object.keys(cityDestinations).map(city => (
                    <Dropdown.Item key={city} onClick={() => setSelectedCity(city)}>{city}</Dropdown.Item>
                ))}
              </DropdownButton>
              <Button variant="primary" onClick={fetchProducts} disabled={isRequesting}>Поиск</Button>
              <Button variant="secondary" onClick={clearInput} id="clearButton" disabled={isRequesting}>X</Button>
            </InputGroup>
          </Form>
          {loadingMessage && <div id="loadingMessage" className="message">{loadingMessage}</div>}
          {errorMessage && <div id="errorMessage" className="message error">{errorMessage}</div>}
          {successMessage && <Alert id="successMessage" variant="success">{successMessage}</Alert>}
          <Accordion activeKey={activeKey} onSelect={(key) => setActiveKey(key)}>
            {allQueries.map((queryData, index) => {
              const [date, time] = queryData.queryTime.split('T');
              const formattedTime = time.split('.')[0];
              const headerText = queryData.query === '1' ? 'Товары с главной страницы' : queryData.query;
              return (
                  <Accordion.Item eventKey={index.toString()} key={index}>
                    <Accordion.Header>
                      <div className="flex-grow-1">{headerText}</div>
                      <div className="date-time">
                        Дата: {date}, Время: {formattedTime}
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
                        {Array.isArray(queryData.products) && queryData.products.map((product, i) => {
                          return (
                              <tr key={i}>
                                <td className="td_table">{i + 1}</td>
                                <td className="td_table">{product.id}</td>
                                <td className="td_table">{product.page}</td>
                                <td className="td_table">{product.position}</td>
                                <td className="td_table">{product.brand}</td>
                                <td className="td_table">{product.name}</td>
                                <td className="td_table">{date}</td>
                                <td className="td_table">{formattedTime}</td>
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
