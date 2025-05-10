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
    const batchSize = 100;
    let processedRows = 0;
    let deletedRows = 0;
    let stopProcessing = false;

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

        // 4. Обрабатываем данные порциями до первого блока новых данных
        const now = new Date();
        const thresholdDate = new Date(now.setDate(now.getDate() - daysThreshold));
        const rowsToKeep = [];
        let currentGroup = [];
        let hasDataBeforeGroup = false;
        let firstRecentBatchIndex = -1;

        for (let startRow = 1; startRow < totalRows && !stopProcessing; startRow += batchSize) {
            const endRow = Math.min(startRow + batchSize, totalRows);
            const range = `${sheetName}!A${startRow + 1}:I${endRow + 1}`;

            // Добавляем задержку между запросами
            if (startRow > 1) await new Promise(resolve => setTimeout(resolve, 500));

            const response = await sheets.spreadsheets.get({
                spreadsheetId: sheetId,
                ranges: [range],
                includeGridData: true
            });

            const gridData = response.data.sheets?.[0]?.data?.[0]?.rowData || [];
            processedRows += gridData.length;
            let batchHasOldData = false;

            for (const row of gridData) {
                const isEmptyRow = !row.values || row.values.every(cell =>
                    !cell.formattedValue || cell.formattedValue.trim() === ''
                );

                if (isEmptyRow) {
                    if (currentGroup.length > 0 || hasDataBeforeGroup) {
                        rowsToKeep.push(...currentGroup);
                        currentGroup = [];
                        rowsToKeep.push({ values: Array(9).fill({ userEnteredValue: { stringValue: '' } }) });
                        hasDataBeforeGroup = true;
                    }
                    continue;
                }

                const dateCell = row.values?.[8];
                if (!dateCell) {
                    currentGroup.push(row);
                    hasDataBeforeGroup = true;
                    batchHasOldData = true;
                    continue;
                }

                let dateValue;
                try {
                    dateValue = dateCell.effectiveValue?.numberValue
                        ? new Date((dateCell.effectiveValue.numberValue - 25569) * 86400 * 1000)
                        : new Date(dateCell.formattedValue);
                } catch (e) {
                    console.warn('Не удалось распознать дату, сохраняем строку', dateCell);
                    currentGroup.push(row);
                    hasDataBeforeGroup = true;
                    batchHasOldData = true;
                    continue;
                }

                if (dateValue >= thresholdDate) {
                    currentGroup.push(row);
                    hasDataBeforeGroup = true;
                } else {
                    deletedRows++;
                    batchHasOldData = true;
                }
            }

            if (!batchHasOldData && firstRecentBatchIndex === -1) {
                firstRecentBatchIndex = startRow;
                console.log(`Обнаружены только новые данные (начиная со строки ${startRow}), прекращаем обработку.`);
                stopProcessing = true;
            }
        }

        if (currentGroup.length > 0) {
            rowsToKeep.push(...currentGroup);
        }

        console.log(`Обработано строк: ${processedRows}, удалено строк: ${deletedRows}`);

        // 5. Если все данные новые, пропускаем обновление
        if (firstRecentBatchIndex === 1 && deletedRows === 0) {
            console.log(`Все данные в таблице ${sheetName} новые, изменений не требуется.`);
            return { success: true, message: 'Все данные новые, изменений не требуется' };
        }

        // 6. Получаем необработанные данные (новые) с сохранением формул
        let unprocessedRows = [];
        if (stopProcessing && firstRecentBatchIndex > 0) {
            const unprocessedRange = `${sheetName}!A${firstRecentBatchIndex + 1}:I${totalRows}`;
            const unprocessedResponse = await sheets.spreadsheets.get({
                spreadsheetId: sheetId,
                ranges: [unprocessedRange],
                includeGridData: true
            });

            unprocessedRows = unprocessedResponse.data.sheets?.[0]?.data?.[0]?.rowData || [];
        }

        // 7. Подготавливаем запросы для обновления
        const requests = [];

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

        // Очищаем всю таблицу (кроме заголовков)
        requests.push({
            updateCells: {
                range: {
                    sheetId: sheetIdValue,
                    startRowIndex: 1,
                    endRowIndex: Math.max(totalRows, rowsToKeep.length + unprocessedRows.length + 2),
                    startColumnIndex: 0,
                    endColumnIndex: 9
                },
                fields: 'userEnteredValue'
            }
        });

        // Добавляем обработанные данные (без пустых строк в начале)
        if (rowsToKeep.length > 0) {
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
            const processedEndRow = 1 + filteredRows.length;

            requests.push({
                updateCells: {
                    range: {
                        sheetId: sheetIdValue,
                        startRowIndex: 1,
                        endRowIndex: processedEndRow,
                        startColumnIndex: 0,
                        endColumnIndex: 9
                    },
                    rows: filteredRows,
                    fields: 'userEnteredValue,userEnteredFormat'
                }
            });

            // Добавляем необработанные данные после обработанных с одной пустой строкой
            if (unprocessedRows.length > 0) {
                // Добавляем пустую строку-разделитель
                requests.push({
                    updateCells: {
                        range: {
                            sheetId: sheetIdValue,
                            startRowIndex: processedEndRow,
                            endRowIndex: processedEndRow + 1,
                            startColumnIndex: 0,
                            endColumnIndex: 9
                        },
                        rows: [{ values: Array(9).fill({ userEnteredValue: { stringValue: '' } }) }],
                        fields: 'userEnteredValue'
                    }
                });

                // Добавляем необработанные данные с сохранением формул изображений
                requests.push({
                    updateCells: {
                        range: {
                            sheetId: sheetIdValue,
                            startRowIndex: processedEndRow + 1,
                            endRowIndex: processedEndRow + 1 + unprocessedRows.length,
                            startColumnIndex: 0,
                            endColumnIndex: 9
                        },
                        rows: unprocessedRows,
                        fields: 'userEnteredValue,userEnteredFormat'
                    }
                });
            }
        }

        // 8. Выполняем обновление
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId: sheetId,
            requestBody: { requests }
        });

        console.log(`Очистка таблицы ${sheetName} завершена. Сохранено строк: ${rowsToKeep.length + (unprocessedRows?.length || 0)}`);
        return { success: true, message: `Данные старше ${daysThreshold} дней удалены` };
    } catch (error) {
        if (error.message.includes('Quota exceeded')) {
            console.error('Превышена квота Google Sheets API. Попробуйте позже или увеличьте квоту.');
            await new Promise(resolve => setTimeout(resolve, 60000)); // Пауза 60 секунд
            return cleanupOldData(sheetId, sheetName, daysThreshold); // Рекурсивный вызов
        }
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