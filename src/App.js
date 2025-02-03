import React, { useState, useEffect, useRef } from 'react';
import Accordion from 'react-bootstrap/Accordion';
import Modal from 'react-bootstrap/Modal';
import { Form, Button, InputGroup, Alert, DropdownButton, Dropdown } from 'react-bootstrap';
import Toastify from 'toastify-js';
import "toastify-js/src/toastify.css";
import './styles.css';
import cityDestinations from './utils/cityDestinations';

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
  const [retryAttempted, setRetryAttempted] = useState(false);
  const [modalImage, setModalImage] = useState(null);
  const accordionRef = useRef(null);
  const [requestForms, setRequestForms] = useState([{ id: Date.now(), query: '', brand: '', city: 'г.Дмитров', isMain: true }]);

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
      const response = await fetch('http://localhost:5500/api/queries', { headers: { 'Content-Type': 'application/json' } });
      if (!response.ok) {
        throw new Error('Ошибка загрузки данных');
      }
      const savedQueries = await response.json();
      if (Array.isArray(savedQueries)) {
        setAllQueries(savedQueries);
        setFilteredQueries(savedQueries);
        setRetryAttempted(false);
      }
      setLoadingMessage('');
    } catch (error) {
      setErrorMessage('Не удалось загрузить данные.');
      console.error(error);
      if (!retryAttempted) {
        setRetryAttempted(true);
        setTimeout(fetchSavedQueries, 5000);
      }
    }
  };

  const fetchProducts = async () => {
    if (isRequesting) return;

    const validForms = requestForms.filter(form => form.query.trim() !== '' && form.brand.trim() !== '');
    if (validForms.length === 0) {
      Toastify({ text: "Все формы должны быть заполнены.", duration: 3000, gravity: "top", position: "right", backgroundColor: "#ff0000" }).showToast();
      return;
    }

    setIsRequesting(true);
    setLoadingMessage('Загрузка...');
    setErrorMessage('');
    setSuccessMessage('');

    try {
      const trimmedForms = validForms.map(form => ({
        ...form,
        query: form.query.trim(),
        brand: form.brand.trim(),
        dest: cityDestinations[form.city],
        city: form.city,
        queryTime: new Date().toISOString()
      }));

      const response = await fetch('http://localhost:5500/api/queries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ forms: trimmedForms })
      });

      if (response.status !== 200) {
        const result = await response.json();
        throw new Error(result.error || 'Ошибка выполнения запроса');
      }

      const result = await response.json();

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

      // Скрываем сообщение "Загрузка..." после получения данных
      setLoadingMessage('');
      // Очистить поля и оставить только одну основную форму после удачного запроса
      setRequestForms([{ id: Date.now(), query: '', brand: '', city: 'г.Дмитров', isMain: true }]);
      // Устанавливаем активный ключ на новый элемент
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
    }

    setIsRequesting(false);
  };

  const handleQueryInputChange = (e, formId) => {
    setRequestForms(requestForms.map(f => f.id === formId ? { ...f, query: e.target.value } : f));
  };

  const handleBrandInputChange = (e, formId) => {
    setRequestForms(requestForms.map(f => f.id === formId ? { ...f, brand: e.target.value } : f));
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

  const clearInput = (formId) => {
    setRequestForms(requestForms.map(f => f.id === formId ? { ...f, query: '', brand: '', city: 'г.Дмитров' } : f));
  };

  const handleKeyPress = (e, formId) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      fetchProducts();
    }
  };

  const addRequestForm = () => {
    setRequestForms([...requestForms, { id: Date.now(), query: '', brand: '', city: 'г.Дмитров', isMain: false }]);
  };

  const removeRequestForm = (formId) => {
    setRequestForms(requestForms.filter(f => f.id !== formId));
  };

  const handleImageClick = (imageUrl) => {
    setModalImage(imageUrl);
    document.body.style.overflow = 'hidden'; // Disable background scroll
  };

  const closeModal = () => {
    setModalImage(null);
    document.body.style.overflow = 'auto'; // Enable background scroll
  };

  return (
      <div>
        <header>
          <h1>Поиск товаров на Wildberries</h1>
        </header>
        <div className="container">
          <div className="top-section">
            <div className="left-forms">
              {requestForms.map((form, index) => (
                  <Form key={form.id} className="search" onSubmit={(e) => e.preventDefault()}>
                    <div className="search-container">
                      <div className="search-left">
                        <InputGroup className="InputGroupForm">
                          <Form.Control type="text" value={form.query} onChange={(e) => handleQueryInputChange(e, form.id)} onKeyPress={(e) => handleKeyPress(e, form.id)} placeholder="Введите запрос" required disabled={isRequesting} />
                          <Form.Control type="text" value={form.brand} onChange={(e) => handleBrandInputChange(e, form.id)} onKeyPress={(e) => handleKeyPress(e, form.id)} placeholder="Введите бренд" required disabled={isRequesting} />
                          <DropdownButton id="dropdown-basic-button" title={form.city} onSelect={(city) => handleCityChange(city, form.id)}>
                            {Object.keys(cityDestinations).map((city) => (
                                <Dropdown.Item key={city} eventKey={city}>
                                  {city}
                                </Dropdown.Item>
                            ))}
                          </DropdownButton>
                          {form.isMain ? (
                              <Button variant="primary" onClick={fetchProducts} disabled={isRequesting}> Поиск </Button>
                          ) : (
                              <Button variant="danger" onClick={() => removeRequestForm(form.id)}> Удалить </Button>
                          )}
                          <Button variant="secondary" onClick={() => clearInput(form.id)} id="clearButton" disabled={isRequesting}> X </Button>
                        </InputGroup>
                      </div>
                    </div>
                  </Form>
              ))}
            </div>
            <div className="right-controls">
              <div className="controls">
                <Button className="controls_success" variant="success" onClick={addRequestForm}>Добавить запрос</Button>
                <Button className="controls_primary" variant="primary" onClick={fetchProducts} disabled={isRequesting}>Поиск</Button>
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
          {successMessage && <Alert id="successMessage" variant="success" className={successMessage === 'По запросу ничего не найдено' ? 'no-results' : ''}>
            {successMessage}
          </Alert>}
          <Accordion ref={accordionRef} activeKey={activeKey} onSelect={(key) => setActiveKey(key)}>
            {filteredQueries.map((queryData, index) => {
              const hasProducts = queryData.productTables && queryData.productTables.some(table => table.products.length > 0);
              const createdAt = new Date(queryData.createdAt);
              const date = createdAt.toLocaleDateString();
              const time = createdAt.toLocaleTimeString();
              const headerTextItems = queryData.query.split('; ').map((query, i) => (
                  <div key={i}>
                    {query} - {queryData.brand.split('; ')[i]} ({queryData.city.split('; ')[i]})
                  </div>
              ));
              return (
                  <Accordion.Item eventKey={index.toString()} key={index}>
                    <Accordion.Header id="accordion_header">
                      <div className="flex-grow-0">{index + 1})</div>
                      <div className="flex-grow-1">{headerTextItems}</div>
                      <div className="date-time">
                        Дата: {date}, Время: {time}
                      </div>
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
                                      {table.products.map((product, i) => {
                                        const queryTime = new Date(queryData.queryTime || queryData.createdAt);
                                        const date = queryTime.toLocaleDateString();
                                        const time = queryTime.toLocaleTimeString();
                                        let page = product.page;
                                        let position = product.position;
                                        if (product.log && product.log.position) {
                                          const logPosition = product.log.position.toString();
                                          page = logPosition[0];
                                          position = logPosition.slice(1);
                                        }
                                        return (
                                            <tr key={i}>
                                              <td className="td_table">{i + 1}</td>
                                              <td className="td_table">
                                                <img className="td_table_img" src={product.imageUrl} alt={product.name} onClick={() => handleImageClick(product.imageUrl)} />
                                              </td>
                                              <td className="td_table">{product.id}</td>
                                              <td className="td_table">{page}</td>
                                              <td className="td_table">{position}</td>
                                              <td className="td_table">{product.brand}</td>
                                              <td className="td_table">{product.name}</td>
                                              <td className="td_table">{date}</td>
                                              <td className="td_table">{time}</td>
                                            </tr>
                                        );
                                      })}
                                      </tbody>
                                    </table>
                                ) : (
                                    <div className="no-products-message" style={{ backgroundColor: '#ffcccb', color: '#000000', padding: '10px', borderRadius: '5px' }}>
                                      <strong>По Запросу:</strong> {queryData.query.split('; ')[tableIndex]} <br />
                                      <strong>Бренд:</strong> {queryData.brand.split('; ')[tableIndex]} <br />
                                      <strong>Город:</strong> {queryData.city.split('; ')[tableIndex]} <br />
                                      <strong>Товары не найдены.</strong>
                                    </div>
                                )}
                              </div>
                          ))
                      ) : (
                          <div className="no-products-message" style={{ backgroundColor: '#ffcccb', color: '#000000', padding: '10px', borderRadius: '5px' }}>
                            <strong>Запрос:</strong> {queryData.query} <br />
                            <strong>Бренд:</strong> {queryData.brand} <br />
                            <strong>Город:</strong> {queryData.city} <br />
                            <strong>Товары не найдены.</strong>
                          </div>
                      )}
                    </Accordion.Body>
                  </Accordion.Item>
              );
            })}
          </Accordion>
        </div>
        <Modal show={modalImage !== null} onHide={closeModal} centered>
          <Modal.Body style={{ padding: 0 }}>
            <img src={modalImage} alt="Product" style={{ width: '100%' }} />
            <Button variant="secondary" onClick={closeModal} style={{ position: 'absolute', top: 10, right: 10 }}>
              &times;
            </Button>
          </Modal.Body>
        </Modal>
      </div>
  );
}

export default App;

