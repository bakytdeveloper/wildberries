export interface Log {
    position: number;
    // другие поля из объекта log, если они потребуются
}

export interface Product {
    brand: string;
    name: string;
    position: number | string;
    page: number | string;
    queryTime: string;
    imageUrl: string; // Новое поле для URL картинки
    log?: Log; // необязательное поле
}

// Новая модель для таблиц с товарами
export interface ProductTable {
    tableId: string;
    products: Product[];
}
