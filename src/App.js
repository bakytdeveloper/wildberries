import React, { useState } from 'react';

function App() {
  const [query, setQuery] = useState('');
  const [loadingMessage, setLoadingMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [products, setProducts] = useState([]);

  const fetchProducts = async () => {
    let searchQuery = query || '0';
    if (searchQuery.toLowerCase() === 'все') searchQuery = 'все';

    setLoadingMessage('Загрузка...');
    setErrorMessage('');

    try {
      const response = await fetch(`http://localhost:4000/api/products?query=${searchQuery}`);
      const productsData = await response.json();

      setLoadingMessage('');

      if (productsData.length === 0) {
        setErrorMessage('Товары не найдены');
      } else {
        setProducts(productsData);
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
          <table id="productsTable">
            <thead>
            <tr>
              <th>№</th>
              <th>Артикул</th>
              <th>Страница</th>
              <th>Позиция</th>
              <th>Бренд</th>
              <th>Наименование</th>
            </tr>
            </thead>
            <tbody>
            {products.map((product, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td>{product.id}</td>
                  <td>{product.page}</td>
                  <td>{product.position}</td>
                  <td>{product.brand}</td>
                  <td>{product.name}</td>
                </tr>
            ))}
            </tbody>
          </table>
        </div>
      </div>
  );
}

export default App;
