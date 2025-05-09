const { google } = require('googleapis');
const dotenv = require('dotenv');

dotenv.config();

const SCOPES = [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive'
];

const auth = new google.auth.GoogleAuth({
    credentials: {
        type: 'service_account',
        project_id: process.env.GOOGLE_PROJECT_ID,
        private_key_id: process.env.GOOGLE_PRIVATE_KEY_ID,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        client_id: process.env.GOOGLE_CLIENT_ID,
    },
    scopes: SCOPES,
});

const getSheetsInstance = () => google.sheets({ version: 'v4', auth });
const getDriveInstance = () => google.drive({ version: 'v3', auth });

const TEMPLATE_SPREADSHEET_ID = process.env.TEMPLATE_SPREADSHEET_ID;

async function createSpreadsheetForUser(email) {
    const drive = getDriveInstance();
    try {
        const copyResponse = await drive.files.copy({
            fileId: TEMPLATE_SPREADSHEET_ID,
            requestBody: {
                name: `Данные - ${email}`,
            },
        });

        const spreadsheetId = copyResponse.data.id;
        if (!spreadsheetId) {
            throw new Error('Spreadsheet ID is missing or invalid');
        }

        await drive.permissions.create({
            fileId: spreadsheetId,
            requestBody: {
                role: 'writer',
                type: 'user',
                emailAddress: email,
            },
        });

        return spreadsheetId;
    } catch (error) {
        console.error('Error creating spreadsheet:', error);
        throw error;
    }
}

async function getLastRow(sheetId, sheetName) {
    const sheets = getSheetsInstance();
    try {
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `${sheetName}!A:A`,
        });

        const values = response.data.values;
        return values ? values.length + 1 : 1;
    } catch (error) {
        console.error('Error getting last row:', error);
        throw error;
    }
}

async function addDataToSheet(sheetId, sheetName, data, hasStar = false) {
    const sheets = getSheetsInstance();
    try {
        // 1. Сначала получаем метаданные таблицы, чтобы узнать sheetId
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: sheetId,
            fields: 'sheets(properties(sheetId,title))'
        });

        // 2. Находим sheetId по имени листа
        const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
        if (!sheet) {
            throw new Error(`Лист "${sheetName}" не найден`);
        }
        const sheetIdValue = sheet.properties.sheetId;

        const lastRow = await getLastRow(sheetId, sheetName);

        // 3. Добавляем пустую строку
        await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: `${sheetName}!A${lastRow + 1}:I${lastRow + 1}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: [Array(9).fill('')],
            },
        });

        // 4. Форматируем данные (добавляем IMAGE формулу)
        const formattedData = data.map((row) => {
            const imageUrl = row[3];
            if (imageUrl) {
                row[3] = `=IMAGE("${imageUrl}")`;
            }
            return row;
        });

        // 5. Вставляем данные
        const response = await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `${sheetName}!A${lastRow + 1}:I${lastRow + 1 + formattedData.length}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: formattedData,
            },
        });

        // 6. Форматирование для столбца G (позиция)
        const requests = [];
        formattedData.forEach((row, index) => {
            const cellValue = row[6]; // Получаем значение из столбца G (индекс 6)
            const cellRange = {
                sheetId: sheetIdValue,
                startRowIndex: lastRow + index,
                endRowIndex: lastRow + index + 1,
                startColumnIndex: 6, // Столбец G
                endColumnIndex: 7
            };

            // Проверяем наличие звёздочки в значении
            const hasStarInValue = cellValue && typeof cellValue === 'string' && cellValue.includes('*');

            // Для страницы "Артикул" всегда применяем форматирование
            if (sheetName === 'Артикул') {
                requests.push({
                    repeatCell: {
                        range: cellRange,
                        cell: {
                            userEnteredFormat: {
                                textFormat: {
                                    bold: hasStarInValue,
                                    foregroundColor: hasStarInValue
                                        ? { red: 1, green: 0, blue: 0 } // Красный если есть *
                                        : { red: 0, green: 0, blue: 0 }  // Чёрный если нет *
                                }
                            }
                        },
                        fields: "userEnteredFormat.textFormat"
                    }
                });
            }
            // Для страницы "Бренд" применяем форматирование только если hasStar=true
            else if (sheetName === 'Бренд') {
                if (hasStar) {
                    requests.push({
                        repeatCell: {
                            range: cellRange,
                            cell: {
                                userEnteredFormat: {
                                    textFormat: {
                                        bold: hasStarInValue,
                                        foregroundColor: hasStarInValue
                                            ? { red: 1, green: 0, blue: 0 } // Красный если есть *
                                            : { red: 0, green: 0, blue: 0 }  // Чёрный если нет *
                                    }
                                }
                            },
                            fields: "userEnteredFormat.textFormat"
                        }
                    });
                } else {
                    // Если hasStar=false, оставляем стандартное форматирование (не изменяем)
                    requests.push({
                        repeatCell: {
                            range: cellRange,
                            cell: {
                                userEnteredFormat: {
                                    textFormat: {
                                        bold: false,
                                        foregroundColor: { red: 0, green: 0, blue: 0 } // Чёрный
                                    }
                                }
                            },
                            fields: "userEnteredFormat.textFormat"
                        }
                    });
                }
            }
            // Для всех остальных листов
            else {
                requests.push({
                    repeatCell: {
                        range: cellRange,
                        cell: {
                            userEnteredFormat: {
                                textFormat: {
                                    bold: false,
                                    foregroundColor: { red: 0, green: 0, blue: 0 } // Чёрный
                                }
                            }
                        },
                        fields: "userEnteredFormat.textFormat"
                    }
                });
            }
        });

        // Применяем все изменения форматирования
        if (requests.length > 0) {
            try {
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId: sheetId,
                    requestBody: { requests }
                });
            } catch (error) {
                console.error('Ошибка форматирования:', error);
                throw error;
            }
        }

        return response.data;
    } catch (error) {
        console.error('Ошибка добавления данных в лист:', error);
        throw error;
    }
}

async function exportAllDataToSheet(sheetId, queries, isBrandQuery = true) {
    const sheets = getSheetsInstance();
    try {
        const targetSheetName = isBrandQuery ? 'Бренд' : 'Артикул';

        // Очищаем лист перед добавлением новых данных
        await clearSheet(sheetId, targetSheetName);

        // Получаем sheetId для форматирования
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: sheetId,
            fields: 'sheets(properties(sheetId,title))'
        });
        const sheet = spreadsheet.data.sheets.find(s => s.properties.title === targetSheetName);
        if (!sheet) {
            throw new Error(`Лист "${targetSheetName}" не найден`);
        }
        const sheetIdValue = sheet.properties.sheetId;

        // Подготавливаем все данные с разделителями
        let allData = [];
        let formatRequests = [];
        let currentRow = 1; // Начинаем с 1, так как 0 - заголовок

        for (const query of queries) {
            // Пропускаем запросы без продуктов
            if (!query.productTables || query.productTables.length === 0) continue;

            // Подготавливаем данные для текущего запроса
            const queryData = query.productTables.flatMap((table) => {
                return table.products.map((product) => {
                    const position = product?.page && product.page > 1
                        ? `${product.page}${product.position != null && product.position < 10 ? '0' + product.position : product.position}`
                        : String(product?.position);

                    const promoPosition = product?.log?.promoPosition
                        ? `${position}*`
                        : position;

                    if (isBrandQuery) {
                        return [
                            String(product?.query || query.query),
                            String(product?.brand || query.brand),
                            String(product?.city || query.city),
                            product?.imageUrl ? `=IMAGE("${product.imageUrl}")` : '',
                            String(product?.id),
                            String(product?.name),
                            promoPosition,
                            new Date(product?.queryTime || query.createdAt).toLocaleTimeString(),
                            new Date(product?.queryTime || query.createdAt).toLocaleDateString(),
                        ];
                    } else {
                        return [
                            String(product?.query || query.query),
                            String(product?.id),
                            String(product?.city || query.city),
                            product?.imageUrl ? `=IMAGE("${product.imageUrl}")` : '',
                            String(product?.brand),
                            String(product?.name),
                            promoPosition,
                            new Date(product?.queryTime || query.createdAt).toLocaleTimeString(),
                            new Date(product?.queryTime || query.createdAt).toLocaleDateString(),
                        ];
                    }
                });
            });

            // Добавляем данные текущего запроса
            if (queryData.length > 0) {
                allData = [...allData, ...queryData];

                // Добавляем форматирование для позиций
                queryData.forEach((row, index) => {
                    const cellValue = row[6]; // Позиция (столбец G)
                    const hasStarInValue = cellValue && typeof cellValue === 'string' && cellValue.includes('*');

                    formatRequests.push({
                        repeatCell: {
                            range: {
                                sheetId: sheetIdValue,
                                startRowIndex: currentRow + index,
                                endRowIndex: currentRow + index + 1,
                                startColumnIndex: 6, // Столбец G
                                endColumnIndex: 7
                            },
                            cell: {
                                userEnteredFormat: {
                                    textFormat: {
                                        bold: hasStarInValue,
                                        foregroundColor: hasStarInValue
                                            ? { red: 1, green: 0, blue: 0 } // Красный если есть *
                                            : { red: 0, green: 0, blue: 0 } // Чёрный если нет *
                                    }
                                }
                            },
                            fields: "userEnteredFormat.textFormat"
                        }
                    });
                });

                currentRow += queryData.length;

                // Добавляем пустую строку после данных запроса, если это не последний запрос
                if (query !== queries[queries.length - 1]) {
                    allData.push(Array(9).fill(''));
                    currentRow += 1;
                }
            }
        }

        // Добавляем данные в таблицу
        if (allData.length > 0) {
            // Сначала добавляем данные
            await sheets.spreadsheets.values.update({
                spreadsheetId: sheetId,
                range: `${targetSheetName}!A2:I${2 + allData.length}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: allData
                }
            });

            // Затем применяем форматирование
            if (formatRequests.length > 0) {
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId: sheetId,
                    requestBody: {
                        requests: formatRequests
                    }
                });
            }
        }

        return { message: 'Все данные успешно выгружены' };
    } catch (error) {
        console.error('Ошибка выгрузки всех данных:', error);
        throw error;
    }
}


async function clearSheet(sheetId, sheetName) {
    const sheets = getSheetsInstance();
    try {
        // Получаем метаданные таблицы
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: sheetId,
            fields: 'sheets(properties(sheetId,title))'
        });

        // Находим sheetId по имени листа
        const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
        if (!sheet) {
            console.log(`Лист "${sheetName}" не найден, пропускаем очистку`);
            return;
        }

        // Очищаем все данные, кроме заголовков
        await sheets.spreadsheets.values.clear({
            spreadsheetId: sheetId,
            range: `${sheetName}!A2:I`
        });
    } catch (error) {
        console.error(`Ошибка очистки листа ${sheetName}:`, error);
        throw error;
    }
}

async function cleanupOldData(sheetId, sheetName, daysThreshold = 7) {
    const sheets = getSheetsInstance();
    const batchSize = 100; // Обрабатываем по 100 строк за раз
    let processedRows = 0;
    let deletedRows = 0;
    let shouldStopProcessing = false;

    try {
        console.log(`Начало очистки старых данных в таблице ${sheetName}`);

        // 1. Получаем общее количество строк
        const lastRowResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `${sheetName}!A:A`,
        });
        const totalRows = lastRowResponse.data.values ? lastRowResponse.data.values.length : 0;
        if (totalRows <= 1) {
            console.log(`Нет данных для очистки в таблице ${sheetName}`);
            return { success: true, message: 'Нет данных для очистки' };
        }

        // 2. Получаем метаданные листа
        const spreadsheet = await sheets.spreadsheets.get({
            spreadsheetId: sheetId,
            fields: 'sheets(properties(sheetId,title))'
        });
        const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
        if (!sheet) {
            throw new Error(`Лист "${sheetName}" не найден`);
        }
        const sheetIdValue = sheet.properties.sheetId;

        // 3. Получаем заголовки
        const headersResponse = await sheets.spreadsheets.get({
            spreadsheetId: sheetId,
            ranges: [`${sheetName}!A1:I1`],
            includeGridData: true
        });
        const headerRow = headersResponse.data.sheets?.[0]?.data?.[0]?.rowData?.[0];

        // 4. Обрабатываем данные порциями
        const now = new Date();
        const thresholdDate = new Date(now.setDate(now.getDate() - daysThreshold));
        const rowsToKeep = [];
        let currentGroup = [];
        let hasDataBeforeGroup = false;
        let allRowsYoungInBatch = false;

        for (let startRow = 1; startRow < totalRows && !shouldStopProcessing; startRow += batchSize) {
            const endRow = Math.min(startRow + batchSize, totalRows);
            const range = `${sheetName}!A${startRow + 1}:I${endRow + 1}`;

            // Получаем порцию данных
            const response = await sheets.spreadsheets.get({
                spreadsheetId: sheetId,
                ranges: [range],
                includeGridData: true
            });

            const gridData = response.data.sheets?.[0]?.data?.[0]?.rowData || [];
            processedRows += gridData.length;

            // Проверяем, есть ли в этой порции старые данные
            let hasOldDataInBatch = false;
            const batchRowsToKeep = [];
            let batchCurrentGroup = [];

            for (const row of gridData) {
                const isEmptyRow = !row.values || row.values.every(cell =>
                    !cell.formattedValue || cell.formattedValue.trim() === ''
                );

                if (isEmptyRow) {
                    if (batchCurrentGroup.length > 0 || hasDataBeforeGroup) {
                        batchRowsToKeep.push(...batchCurrentGroup);
                        batchCurrentGroup = [];
                        batchRowsToKeep.push({ values: Array(9).fill({ userEnteredValue: { stringValue: '' } }) });
                        hasDataBeforeGroup = true;
                    }
                    continue;
                }

                const dateCell = row.values?.[8]; // Столбец I (индекс 8)
                if (!dateCell) {
                    batchCurrentGroup.push(row);
                    hasDataBeforeGroup = true;
                    continue;
                }

                let dateValue;
                try {
                    dateValue = dateCell.effectiveValue?.numberValue
                        ? new Date((dateCell.effectiveValue.numberValue - 25569) * 86400 * 1000)
                        : new Date(dateCell.formattedValue);
                } catch (e) {
                    console.warn('Не удалось распознать дату, сохраняем строку', dateCell);
                    batchCurrentGroup.push(row);
                    hasDataBeforeGroup = true;
                    continue;
                }

                if (dateValue >= thresholdDate) {
                    batchCurrentGroup.push(row);
                    hasDataBeforeGroup = true;
                } else {
                    deletedRows++;
                    hasOldDataInBatch = true;
                }
            }

            // Добавляем последнюю группу в порции
            if (batchCurrentGroup.length > 0) {
                batchRowsToKeep.push(...batchCurrentGroup);
            }

            // Если в порции есть старые данные, добавляем их в общий массив
            if (hasOldDataInBatch) {
                rowsToKeep.push(...batchRowsToKeep);
            } else {
                // Если все строки в порции новые, добавляем их и останавливаем обработку
                rowsToKeep.push(...batchRowsToKeep);
                allRowsYoungInBatch = true;

                // Добавляем все оставшиеся строки без проверки
                if (endRow < totalRows) {
                    const remainingRange = `${sheetName}!A${endRow + 1}:I${totalRows + 1}`;
                    const remainingResponse = await sheets.spreadsheets.values.get({
                        spreadsheetId: sheetId,
                        range: remainingRange,
                    });

                    if (remainingResponse.data.values) {
                        const remainingRowsCount = remainingResponse.data.values.length;
                        processedRows += remainingRowsCount;
                        console.log(`Пропущена проверка ${remainingRowsCount} новых строк`);
                    }
                }

                shouldStopProcessing = true;
                console.log(`Обнаружены только новые данные, прекращаем проверку на строке ${endRow}`);
            }

            // Освобождаем память
            await new Promise(resolve => setImmediate(resolve));
        }

        // 5. Подготавливаем запросы для обновления таблицы
        const requests = [];

        // Очищаем весь лист (кроме заголовков)
        requests.push({
            updateCells: {
                range: {
                    sheetId: sheetIdValue,
                    startRowIndex: 1,
                    endRowIndex: Math.max(totalRows, rowsToKeep.length + 1),
                    startColumnIndex: 0,
                    endColumnIndex: 9
                },
                fields: 'userEnteredValue'
            }
        });

        // Добавляем заголовки
        if (headerRow) {
            requests.push({
                updateCells: {
                    range: {
                        sheetId: sheetIdValue,
                        startRowIndex: 0,
                        endRowIndex: 1,
                        startColumnIndex: 0,
                        endColumnIndex: 9
                    },
                    rows: [headerRow],
                    fields: 'userEnteredValue,userEnteredFormat'
                }
            });
        }

        // Добавляем оставшиеся строки (без пустых строк в начале)
        if (rowsToKeep.length > 0) {
            // Удаляем пустые строки в начале массива
            let firstNonEmptyIndex = 0;
            while (firstNonEmptyIndex < rowsToKeep.length) {
                const row = rowsToKeep[firstNonEmptyIndex];
                const isEmpty = !row.values || row.values.every(cell =>
                    !cell.userEnteredValue ||
                    (cell.userEnteredValue.stringValue && cell.userEnteredValue.stringValue.trim() === '')
                );
                if (!isEmpty) break;
                firstNonEmptyIndex++;
            }

            const filteredRows = rowsToKeep.slice(firstNonEmptyIndex);
            const filteredRowsCount = filteredRows.length;

            // Исправление ошибки с диапазоном - убедимся, что endRowIndex корректный
            const endRowIndex = Math.max(1 + filteredRowsCount, 2); // Минимум 2, чтобы не было ошибки

            requests.push({
                updateCells: {
                    range: {
                        sheetId: sheetIdValue,
                        startRowIndex: 1,
                        endRowIndex: endRowIndex,
                        startColumnIndex: 0,
                        endColumnIndex: 9
                    },
                    rows: filteredRows,
                    fields: 'userEnteredValue,userEnteredFormat'
                }
            });
        }

        // Выполняем обновление
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: { requests }
        });

        console.log(`Очистка таблицы ${sheetName} завершена. Обработано строк: ${processedRows}, удалено строк: ${deletedRows}, сохранено строк: ${rowsToKeep.length}`);
        return {
            success: true,
            message: `Данные старше ${daysThreshold} дней удалены`,
            stats: {
                processedRows,
                deletedRows,
                keptRows: rowsToKeep.length,
                earlyExit: allRowsYoungInBatch
            }
        };
    } catch (error) {
        console.error('Ошибка очистки старых данных:', error.message);
        console.error('Stack trace:', error.stack);
        throw error;
    }
}

module.exports = {
    createSpreadsheetForUser,
    addDataToSheet,
    cleanupOldData,
    exportAllDataToSheet
};