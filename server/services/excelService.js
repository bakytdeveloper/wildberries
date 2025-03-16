const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid'); // Для генерации уникальных имен файлов

// Функция для загрузки изображения по URL
const downloadImage = async (url) => {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary');
};

const createExcelFileForUser = async (userId) => {
    const workbook = new ExcelJS.Workbook();
    const sheetBrand = workbook.addWorksheet('Бренд');
    const sheetArticle = workbook.addWorksheet('Артикул');

    // Заголовки для страницы "Бренд"
    sheetBrand.addRow([
        'Запрос', 'Бренд', 'Город', 'Картинка', 'Артикул', 'Наименование', 'Позиция', 'Прежняя Позиция', 'Время запроса', 'Дата запроса'
    ]);

    // Заголовки для страницы "Артикул"
    sheetArticle.addRow([
        'Запрос', 'Артикул', 'Город', 'Картинка', 'Бренд', 'Наименование', 'Позиция', 'Прежняя Позиция', 'Время запроса', 'Дата запроса'
    ]);

    const filePath = path.join(__dirname, `../excelFiles/${userId}.xlsx`);
    await workbook.xlsx.writeFile(filePath);

    return filePath;
};

const addDataToExcel = async (userId, sheetName, data) => {
    const filePath = path.join(__dirname, `../excelFiles/${userId}.xlsx`);

    if (!fs.existsSync(filePath)) {
        await createExcelFileForUser(userId);
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheet = workbook.getWorksheet(sheetName);
    if (!sheet) {
        throw new Error(`Страница "${sheetName}" не найдена.`);
    }

    // Добавляем пустую строку перед новой выгрузкой (только один раз)
    sheet.addRow([]);

    for (const row of data) {
        const newRow = sheet.addRow(row);

        // Вставляем изображение вместо URL
        const imageUrl = row[3]; // URL картинки находится в 4-й колонке
        if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
            try {
                const imageBuffer = await downloadImage(imageUrl);
                const imageId = workbook.addImage({
                    buffer: imageBuffer,
                    extension: 'jpeg', // или 'png', в зависимости от формата
                });

                // Вставляем изображение в ячейку с сохранением пропорций
                const imageWidth = 30; // Ширина изображения в пикселях
                const imageHeight = 30; // Высота изображения в пикселях

                sheet.addImage(imageId, {
                    tl: { col: 3, row: newRow.number - 1, offset: 5, height: imageHeight }, // Позиция изображения (колонка 4, строка текущей записи)
                    ext: { width: imageWidth, height: imageHeight }, // Размер изображения
                });

                // Устанавливаем высоту строки для изображения
                sheet.getRow(newRow.number).height = imageHeight / 1.5; // Подгоняем высоту строки под изображение
            } catch (error) {
                console.error('Ошибка загрузки изображения:', error);
            }
        }
    }

    await workbook.xlsx.writeFile(filePath);
};

// Функция для удаления старых записей
const cleanOldData = async (userId) => {
    const filePath = path.join(__dirname, `../excelFiles/${userId}.xlsx`);

    if (!fs.existsSync(filePath)) {
        return;
    }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheets = workbook.worksheets;
    const now = new Date();
    const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));

    sheets.forEach((sheet) => {
        const rowsToDelete = [];
        sheet.eachRow((row, rowNumber) => {
            const dateCell = row.getCell(10); // Дата находится в 10-й колонке
            if (dateCell.value && dateCell.value instanceof Date && dateCell.value < sevenDaysAgo) {
                rowsToDelete.push(rowNumber);
            }
        });

        // Удаляем строки в обратном порядке, чтобы не нарушить нумерацию
        rowsToDelete.reverse().forEach((rowNumber) => {
            sheet.spliceRows(rowNumber, 1);
        });
    });

    await workbook.xlsx.writeFile(filePath);
};

module.exports = {
    createExcelFileForUser,
    addDataToExcel,
    cleanOldData,
};