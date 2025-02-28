// Добавляем поле id в Product интерфейс
export interface Product {
    id: string; // Новый артикул товара
    brand: string;
    name: string;
    position: number | string;
    page: number | string;
    queryTime: string;
    imageUrl: string;
    log?: Log;
}

export interface Log {
    promoPosition: number;
    position: number;
}
