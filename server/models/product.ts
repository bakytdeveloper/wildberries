// models/product.ts
export interface Log {
    position: number;
    // другие поля из объекта log, если они есть
}

export interface Product {
    brand: string;
    name: string;
    position: number | string;
    page: number | string;
    queryTime: string;
    log?: Log; // необязательное поле
}
