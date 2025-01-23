import React, { useState } from 'react';
import Accordion from 'react-bootstrap/Accordion';
import './styles.css';  // Подключаем CSS стили

function App() {
  const [query, setQuery] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [allQueries, setAllQueries] = useState([]);

  const fetchProducts = async () => {
    let searchQuery = query || '0';
    if (searchQuery.toLowerCase() === 'все') searchQuery = 'все';

    setLoadingMessage('Загрузка...');
    setErrorMessage('');

    try {
      const response = await fetch(`http://localhost:4000/api/products?query=${searchQuery}`);
      const productsData = await response.json();

      setLoadingMessage('');

      if (!Array.isArray(productsData)) {
        setErrorMessage('Ошибка получения данных');
      } else if (productsData.length === 0) {
        setErrorMessage('Товары не найдены');
      } else {
        setAllQueries([{ query: searchQuery, products: productsData, queryTime: new Date().toISOString() }, ...allQueries]);
      }
    } catch (error) {
      console.error('Error fetching products:', error);
      setLoadingMessage('');
      setErrorMessage('Ошибка получения данных');
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
          <div className="search">
            <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Введите запрос"
                required
            />
            <button onClick={fetchProducts}>Поиск</button>
            <button onClick={clearInput} id="clearButton">X</button>
          </div>
          <div id="loadingMessage" style={{ display: loadingMessage ? 'block' : 'none' }}>{loadingMessage}</div>
          <div id="errorMessage" style={{ display: errorMessage ? 'block' : 'none', color: 'red' }}>{errorMessage}</div>

          <Accordion defaultActiveKey="0">
            {allQueries.map((queryData, index) => {
              const [date, time] = queryData.queryTime.split('T');
              const formattedTime = time.split('.')[0];
              const headerText = queryData.query === '0' ? 'Товары с главной страницы' : queryData.query;

              return (
                  <Accordion.Item eventKey={index.toString()} key={index}>
                    <Accordion.Header>{`${headerText} - ${date} ${formattedTime}`}</Accordion.Header>
                    <Accordion.Body>
                      <table id="productsTable">
                        <thead>
                        <tr>
                          <th>№</th>
                          <th>Артикул</th>
                          <th>Страница</th>
                          <th>Позиция</th>
                          <th>Бренд</th>
                          <th>Наименование</th>
                          <th>Дата запроса</th>
                          <th>Время запроса</th>
                        </tr>
                        </thead>
                        <tbody>
                        {Array.isArray(queryData.products) && queryData.products.map((product, i) => {
                          const [prodDate, prodTime] = product.queryTime.split('T');
                          const formattedProdTime = prodTime.split('.')[0];
                          return (
                              <tr key={i}>
                                <td>{i + 1}</td>
                                <td>{product.id}</td>
                                <td>{product.page}</td>
                                <td>{product.position}</td>
                                <td>{product.brand}</td>
                                <td>{product.name}</td>
                                <td>{prodDate}</td>
                                <td>{formattedProdTime}</td>
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
