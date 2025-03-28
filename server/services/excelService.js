const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const {sendExcelLink} = require("../smtp/otpService");
const dotenv = require('dotenv');
const {UserModel} = require("../models/userModel");

dotenv.config();

// Функция для загрузки изображения по URL
const downloadImage = async (url) => {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    return Buffer.from(response.data, 'binary');
};

const createExcelFileForUser = async (userId) => {
    const excelFilesDir = path.join(__dirname, '../excelFiles');

    // Проверяем, существует ли папка excelFiles
    if (!fs.existsSync(excelFilesDir)) {
        fs.mkdirSync(excelFilesDir, { recursive: true }); // Создаем папку, если её нет
    }

    const workbook = new ExcelJS.Workbook();
    const sheetBrand = workbook.addWorksheet('Бренд');
    const sheetArticle = workbook.addWorksheet('Артикул');

    // Заголовки для страницы "Бренд"
    sheetBrand.addRow([
        'Запрос', 'Бренд', 'Город', 'Картинка', 'Артикул', 'Описание товара', 'Позиция', 'Время запроса', 'Дата запроса'
    ]);

    // Заголовки для страницы "Артикул"
    sheetArticle.addRow([
        'Запрос', 'Артикул', 'Город', 'Картинка', 'Бренд', 'Описание товара', 'Позиция', 'Время запроса', 'Дата запроса'
    ]);

    const filePath = path.join(__dirname, `../excelFiles/${userId}.xlsx`);
    await workbook.xlsx.writeFile(filePath);

    return filePath;
};


const addDataToExcel = async (userId, sheetName, data, hasStar = false) => {
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

    // Удаляем старые записи
    const now = new Date();
    const sevenDaysAgo = new Date(now.setDate(now.getDate() - 7));
    const rowsToDelete = [];
    sheet.eachRow((row, rowNumber) => {
        const dateCell = row.getCell(9);
        if (dateCell.value && dateCell.value instanceof Date && dateCell.value < sevenDaysAgo) {
            rowsToDelete.push(rowNumber);
        }
    });
    rowsToDelete.reverse().forEach((rowNumber) => {
        sheet.spliceRows(rowNumber, 1);
    });

    sheet.addRow([]);

    for (const row of data) {
        const newRow = sheet.addRow(row);

        // Форматирование позиции со звёздочкой
        if (hasStar && row[6] && row[6].includes('*')) {
            const positionCell = newRow.getCell(7); // Позиция в 7-й колонке
            positionCell.font = {
                ...positionCell.font,
                bold: true,
                color: { argb: 'FFFF0000' } // Красный цвет только для звёздочки
            };

            // Разделяем число и звёздочку для частичного форматирования
            const value = row[6];
            const numValue = value.replace('*', '');
            positionCell.value = { richText: [
                    { text: numValue },
                    { text: '*', font: { bold: true, color: { argb: 'FFD15E00' } } }
                ]};
        }

        const imageUrl = row[3];
        if (imageUrl && typeof imageUrl === 'string' && imageUrl.startsWith('http')) {
            try {
                const imageBuffer = await downloadImage(imageUrl);
                const imageId = workbook.addImage({
                    buffer: imageBuffer,
                    extension: 'jpeg',
                });
                const imageWidth = 30;
                const imageHeight = 30;
                sheet.addImage(imageId, {
                    tl: { col: 3, row: newRow.number - 1, offset: 5, height: imageHeight },
                    ext: { width: imageWidth, height: imageHeight },
                });
                sheet.getRow(newRow.number).height = imageHeight / 1.5;
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
            const dateCell = row.getCell(9); // Дата находится в 9-й колонке
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

// Функция для удаления Excel-файла пользователя
const deleteExcelFile = async (userId) => {
    const filePath = path.join(__dirname, `../excelFiles/${userId}.xlsx`);

    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`Excel-файл пользователя ${userId} удален.`);
    }
};

const createExcelFileOnDemand = async (userId, email) => {
    try {
        // Создаем файл
        const excelFilePath = await createExcelFileForUser(userId);

        // Обновляем пользователя в базе
        await UserModel.findByIdAndUpdate(userId, { excelFileId: excelFilePath });

        // Отправляем файл пользователю
        await sendExcelFileToUser(email, userId);

        return excelFilePath;
    } catch (error) {
        console.error('Error creating Excel file on demand:', error);
        throw error;
    }
};

// Функция для создания публичной ссылки на Excel-файл
const getExcelFileLink = (userId) => {
    // Пример: файл доступен по URL сервера
    const serverUrl = process.env.SERVER_URL || 'http://localhost:5505'; // Укажите URL вашего сервера
    return `${serverUrl}/excelFiles/${userId}.xlsx`;
};

// Функция для отправки ссылки на Excel-файл пользователю
const sendExcelFileToUser = async (email, userId) => {
    const fileLink = getExcelFileLink(userId);
    await sendExcelLink(email, fileLink);
};


module.exports = {
    createExcelFileForUser,
    createExcelFileOnDemand,
    addDataToExcel,
    cleanOldData,
    deleteExcelFile, // Экспортируем новую функцию
    getExcelFileLink,
    sendExcelFileToUser,
};