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

    try {
        // 1. Получаем все данные из листа (начиная со строки 2) включая формулы
        const response = await sheets.spreadsheets.get({
            spreadsheetId: sheetId,
            ranges: [`${sheetName}!A2:I`],
            includeGridData: true
        });

        const now = new Date();
        const thresholdDate = new Date(now.setDate(now.getDate() - daysThreshold));

        // 2. Получаем данные строк
        const gridData = response.data.sheets?.[0]?.data?.[0]?.rowData || [];
        const sheetIdValue = response.data.sheets?.[0]?.properties?.sheetId;

        // 3. Фильтруем строки по дате и сохраняем все данные ячеек
        const rowsToKeep = [];
        for (let i = 0; i < gridData.length; i++) {
            const row = gridData[i];
            const dateCell = row.values?.[8]; // Столбец I (индекс 8)
            if (!dateCell) continue;

            const dateValue = dateCell.effectiveValue?.numberValue
                ? new Date((dateCell.effectiveValue.numberValue - 25569) * 86400 * 1000)
                : new Date(dateCell.formattedValue);

            if (dateValue >= thresholdDate) {
                const rowData = row.values.map(cell => ({
                    userEnteredValue: cell.userEnteredValue || { stringValue: '' },
                    userEnteredFormat: cell.userEnteredFormat || {}
                }));
                rowsToKeep.push({ values: rowData });
            }
        }

        // 4. Получаем заголовки с их форматированием
        const headersResponse = await sheets.spreadsheets.get({
            spreadsheetId: sheetId,
            ranges: [`${sheetName}!A1:I1`],
            includeGridData: true
        });
        const headerRow = headersResponse.data.sheets?.[0]?.data?.[0]?.rowData?.[0];

        // 5. Очищаем лист (кроме заголовков)
        await sheets.spreadsheets.values.clear({
            spreadsheetId: sheetId,
            range: `${sheetName}!A2:I`
        });

        if (rowsToKeep.length > 0) {
            // 6. Подготавливаем запрос на обновление
            const requests = [];

            // Добавляем заголовки
            requests.push({
                updateCells: {
                    range: {
                        sheetId: sheetIdValue,
                        startRowIndex: 0,
                        endRowIndex: 1,
                        startColumnIndex: 0,
                        endColumnIndex: 9 // Столбец I
                    },
                    rows: [headerRow],
                    fields: 'userEnteredValue,userEnteredFormat'
                }
            });

            // Добавляем оставшиеся строки
            requests.push({
                updateCells: {
                    range: {
                        sheetId: sheetIdValue,
                        startRowIndex: 1,
                        endRowIndex: 1 + rowsToKeep.length,
                        startColumnIndex: 0,
                        endColumnIndex: 9 // Столбец I
                    },
                    rows: rowsToKeep,
                    fields: 'userEnteredValue,userEnteredFormat'
                }
            });

            // 7. Выполняем запрос
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: sheetId,
                requestBody: { requests }
            });
        }

        console.log(`Удалены данные старше ${daysThreshold} дней`);
    } catch (error) {
        console.error('Ошибка очистки старых данных:', error.message);
        console.error('Полный вывод ошибки:', JSON.stringify(error, null, 2));
        throw error;
    }
}


module.exports = {
    createSpreadsheetForUser,
    addDataToSheet,
    cleanupOldData,
    exportAllDataToSheet
};