const { google } = require('googleapis');
const dotenv = require('dotenv');
const appState = require("googleapis/build/src/apis/tasks");
const {UserModel} = require("../models/userModel");

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

// async function cleanupOldData(sheetId, sheetNames, daysThreshold = 7) {
//     const sheets = getSheetsInstance();
//
//     for (const sheetName of sheetNames) {
//         console.log(`Начало очистки старых данных в таблице ${sheetName}`);
//
//         try {
//             // 1. Получаем метаданные листа
//             const spreadsheet = await sheets.spreadsheets.get({
//                 spreadsheetId: sheetId,
//                 fields: 'sheets(properties(sheetId,title))'
//             });
//             const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
//             if (!sheet) {
//                 console.log(`Лист "${sheetName}" не найден`);
//                 continue;
//             }
//             const sheetIdValue = sheet.properties.sheetId;
//
//             // 2. Получаем все данные с форматированием
//             const response = await sheets.spreadsheets.get({
//                 spreadsheetId: sheetId,
//                 ranges: [`${sheetName}!A1:I`],
//                 includeGridData: true
//             });
//
//             const gridData = response.data.sheets?.[0]?.data?.[0]?.rowData || [];
//             if (gridData.length <= 1) {
//                 console.log(`Нет данных для очистки в таблице ${sheetName}`);
//                 continue;
//             }
//
//             // 3. Фильтруем данные
//             const now = new Date();
//             const thresholdDate = new Date(now.setDate(now.getDate() - daysThreshold));
//             const rowsToKeep = [];
//             const headerRow = gridData[0];
//
//             for (let i = 1; i < gridData.length; i++) {
//                 const row = gridData[i];
//                 const dateCell = row.values?.[8]; // Колонка I (индекс 8)
//
//                 if (!dateCell) {
//                     rowsToKeep.push(row);
//                     continue;
//                 }
//
//                 let dateValue;
//                 try {
//                     dateValue = dateCell.effectiveValue?.numberValue
//                         ? new Date((dateCell.effectiveValue.numberValue - 25569) * 86400 * 1000)
//                         : new Date(dateCell.formattedValue);
//                 } catch {
//                     rowsToKeep.push(row);
//                     continue;
//                 }
//
//                 if (dateValue >= thresholdDate) {
//                     rowsToKeep.push(row);
//                 }
//             }
//
//             console.log(`Очистка таблицы ${sheetName} завершена. Сохранено строк: ${rowsToKeep.length}`);
//
//             // 4. Подготавливаем запросы для обновления
//             const requests = [
//                 // Очищаем лист
//                 {
//                     updateCells: {
//                         range: {
//                             sheetId: sheetIdValue,
//                             startRowIndex: 1,
//                             endRowIndex: gridData.length,
//                             startColumnIndex: 0,
//                             endColumnIndex: 9
//                         },
//                         fields: 'userEnteredValue'
//                     }
//                 },
//                 // Добавляем заголовки
//                 {
//                     updateCells: {
//                         range: {
//                             sheetId: sheetIdValue,
//                             startRowIndex: 0,
//                             endRowIndex: 1,
//                             startColumnIndex: 0,
//                             endColumnIndex: 9
//                         },
//                         rows: [headerRow],
//                         fields: 'userEnteredValue,userEnteredFormat'
//                     }
//                 }
//             ];
//
//             // Добавляем форматирование для позиций со звездочкой
//             rowsToKeep.forEach((row, index) => {
//                 const positionCell = row.values?.[6]; // Колонка G (индекс 6)
//                 if (positionCell?.formattedValue?.includes('*')) {
//                     requests.push({
//                         repeatCell: {
//                             range: {
//                                 sheetId: sheetIdValue,
//                                 startRowIndex: index + 1,
//                                 endRowIndex: index + 2,
//                                 startColumnIndex: 6,
//                                 endColumnIndex: 7
//                             },
//                             cell: {
//                                 userEnteredFormat: {
//                                     textFormat: {
//                                         foregroundColor: { red: 1, green: 0, blue: 0 }, // Красный
//                                         bold: true
//                                     }
//                                 }
//                             },
//                             fields: 'userEnteredFormat.textFormat'
//                         }
//                     });
//                 }
//             });
//
//             // Добавляем оставшиеся строки
//             if (rowsToKeep.length > 0) {
//                 requests.push({
//                     updateCells: {
//                         range: {
//                             sheetId: sheetIdValue,
//                             startRowIndex: 1,
//                             endRowIndex: 1 + rowsToKeep.length,
//                             startColumnIndex: 0,
//                             endColumnIndex: 9
//                         },
//                         rows: rowsToKeep,
//                         fields: 'userEnteredValue,userEnteredFormat'
//                     }
//                 });
//             }
//
//             // 5. Выполняем обновление
//             await sheets.spreadsheets.batchUpdate({
//                 spreadsheetId: sheetId,
//                 requestBody: { requests }
//             });
//
//         } catch (error) {
//             console.error(`Ошибка обработки ${sheetName}:`, error.message);
//             if (error.message.includes('Quota exceeded')) {
//                 await new Promise(resolve => setTimeout(resolve, 60000));
//                 return cleanupOldData(sheetId, sheetNames, daysThreshold);
//             }
//         }
//     }
// }
//
// async function cleanupAllUsers() {
//     if (appState.tasks.isCleanupRunning) return;
//     appState.tasks.isCleanupRunning = true;
//
//     console.log('Запуск задачи очистки Google Sheets...');
//
//     const users = await UserModel.find({ spreadsheetId: { $exists: true } }).lean();
//     const totalUsers = users.length;
//     let processedUsers = 0;
//
//     try {
//         for (const user of users) {
//             console.log(`Обработка пользователя ${user.email} (${processedUsers + 1}/${totalUsers})`);
//
//             try {
//                 await cleanupOldData(user.spreadsheetId, ['Бренд', 'Артикул'], 7);
//                 processedUsers++;
//
//                 // Добавляем задержку между пользователями
//                 if (processedUsers < totalUsers) {
//                     await new Promise(resolve => setTimeout(resolve, 2000));
//                 }
//             } catch (error) {
//                 console.error(`Ошибка очистки данных для пользователя ${user.email}:`, error.message);
//             }
//         }
//
//         console.log(`Задача очистки завершена. Обработано пользователей: ${processedUsers}/${totalUsers}`);
//     } catch (error) {
//         console.error('Ошибка в задаче очистки Google Sheets:', error);
//     } finally {
//         appState.tasks.isCleanupRunning = false;
//     }
// }

async function cleanupOldData(sheetId, sheetNames, daysThreshold = 7) {
    const sheets = getSheetsInstance();

    for (const sheetName of sheetNames) {
        console.log(`Начало очистки старых данных в таблице ${sheetName}`);

        try {
            // 1. Получаем метаданные листа
            const spreadsheet = await sheets.spreadsheets.get({
                spreadsheetId: sheetId,
                fields: 'sheets(properties(sheetId,title,gridProperties(rowCount)))'
            });
            const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
            if (!sheet) {
                console.log(`Лист "${sheetName}" не найден`);
                continue;
            }
            const sheetIdValue = sheet.properties.sheetId;
            const rowCount = sheet.properties.gridProperties.rowCount;

            // 2. Получаем данные (значения и формулы)
            const response = await sheets.spreadsheets.get({
                spreadsheetId: sheetId,
                ranges: [`${sheetName}!A1:I${rowCount}`],
                fields: 'sheets(data(rowData(values(userEnteredValue,userEnteredFormat,effectiveValue))))'
            });

            const gridData = response.data.sheets?.[0]?.data?.[0]?.rowData || [];
            if (gridData.length <= 1) {
                console.log(`Нет данных для очистки в таблице ${sheetName}`);
                continue;
            }

            // 3. Фильтруем данные по дате и сохраняем URL изображений
            const now = new Date();
            const thresholdDate = new Date(now.setDate(now.getDate() - daysThreshold));
            const rowsToKeep = [];
            const headerRow = gridData[0];

            // Добавляем заголовок
            rowsToKeep.push(headerRow);

            for (let i = 1; i < gridData.length; i++) {
                const row = gridData[i];
                const dateCell = row.values?.[8]; // Колонка I (индекс 8)

                if (!dateCell) {
                    rowsToKeep.push(row);
                    continue;
                }

                try {
                    const dateValue = dateCell.effectiveValue?.numberValue
                        ? new Date((dateCell.effectiveValue.numberValue - 25569) * 86400 * 1000)
                        : new Date(dateCell.effectiveValue?.stringValue || dateCell.userEnteredValue?.stringValue || '');

                    if (dateValue >= thresholdDate) {
                        rowsToKeep.push(row);
                    }
                } catch {
                    rowsToKeep.push(row);
                }
            }

            console.log(`Очистка таблицы ${sheetName} завершена. Сохранено строк: ${rowsToKeep.length - 1}`);

            // 4. Подготавливаем запросы для обновления
            const requests = [
                // Очищаем весь лист
                {
                    updateCells: {
                        range: {
                            sheetId: sheetIdValue,
                            startRowIndex: 0,
                            endRowIndex: rowCount,
                            startColumnIndex: 0,
                            endColumnIndex: 9
                        },
                        fields: 'userEnteredValue'
                    }
                }
            ];

            // 5. Форматируем данные для записи и обрабатываем изображения
            const dataToWrite = [];
            let lastHadData = false;
            const IMAGE_COLUMN_INDEX = 3; // Колонка D (индекс 3)

            for (let i = 0; i < rowsToKeep.length; i++) {
                const row = rowsToKeep[i];
                const isEmptyRow = !row.values || row.values.every(cell =>
                    !cell || (!cell.effectiveValue && !cell.userEnteredValue)
                );

                if (isEmptyRow) {
                    if (lastHadData) {
                        dataToWrite.push({ values: Array(9).fill({}) }); // Пустая строка
                        lastHadData = false;
                    }
                } else {
                    const newRow = { values: [] };

                    // Обрабатываем каждую ячейку в строке
                    for (let col = 0; col < 9; col++) {
                        const cell = row.values?.[col];

                        // Для колонки с изображениями (D) используем формулу IMAGE()
                        if (col === IMAGE_COLUMN_INDEX && cell?.effectiveValue?.stringValue) {
                            const imageUrl = cell.effectiveValue.stringValue;
                            newRow.values.push({
                                userEnteredValue: {
                                    formulaValue: `=IMAGE("${imageUrl}")`
                                },
                                userEnteredFormat: cell.userEnteredFormat
                            });
                        }
                        // Для остальных ячеек сохраняем оригинальные значения
                        else if (cell) {
                            newRow.values.push({
                                userEnteredValue: cell.userEnteredValue || cell.effectiveValue,
                                userEnteredFormat: cell.userEnteredFormat
                            });
                        } else {
                            newRow.values.push({});
                        }
                    }

                    dataToWrite.push(newRow);
                    lastHadData = true;

                    // Проверяем позицию со звездочкой (колонка G, индекс 6)
                    const positionCell = row.values?.[6];
                    if (positionCell?.effectiveValue?.stringValue?.includes('*') ||
                        positionCell?.userEnteredValue?.stringValue?.includes('*')) {
                        requests.push({
                            repeatCell: {
                                range: {
                                    sheetId: sheetIdValue,
                                    startRowIndex: dataToWrite.length - 1,
                                    endRowIndex: dataToWrite.length,
                                    startColumnIndex: 6,
                                    endColumnIndex: 7
                                },
                                cell: {
                                    userEnteredFormat: {
                                        textFormat: {
                                            foregroundColor: { red: 1, green: 0, blue: 0 },
                                            bold: true
                                        }
                                    }
                                },
                                fields: 'userEnteredFormat.textFormat'
                            }
                        });
                    }
                }
            }

            // 6. Добавляем запрос на запись данных
            requests.push({
                updateCells: {
                    range: {
                        sheetId: sheetIdValue,
                        startRowIndex: 0,
                        endRowIndex: dataToWrite.length,
                        startColumnIndex: 0,
                        endColumnIndex: 9
                    },
                    rows: dataToWrite,
                    fields: 'userEnteredValue,userEnteredFormat'
                }
            });

            // 7. Выполняем обновление с интервалом
            await new Promise(resolve => setTimeout(resolve, 1000));
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId: sheetId,
                requestBody: { requests }
            });

        } catch (error) {
            console.error(`Ошибка обработки ${sheetName}:`, error.message);
            if (error.message.includes('Quota exceeded')) {
                await new Promise(resolve => setTimeout(resolve, 60000));
                return cleanupOldData(sheetId, sheetNames, daysThreshold);
            }
        }
    }
}


async function cleanupAllUsers() {
    if (appState.tasks.isCleanupRunning) return;
    appState.tasks.isCleanupRunning = true;

    console.log('\nЗапуск задачи очистки Google Sheets...');

    try {
        const users = await UserModel.find({ spreadsheetId: { $exists: true } }).lean();
        const totalUsers = users.length;
        let processedUsers = 0;

        for (const user of users) {
            console.log(`\nОбработка пользователя ${user.email} (${processedUsers + 1}/${totalUsers})`);

            try {
                await cleanupOldData(user.spreadsheetId, ['Бренд', 'Артикул'], 7);
                processedUsers++;

                // Увеличиваем задержку между пользователями
                if (processedUsers < totalUsers) {
                    await new Promise(resolve => setTimeout(resolve, 5000));
                }
            } catch (error) {
                console.error(`\nОшибка очистки данных для пользователя ${user.email}:`, error.message);
                // При ошибке делаем большую паузу
                await new Promise(resolve => setTimeout(resolve, 30000));
            }
        }

        console.log(`\nЗадача очистки завершена. Обработано пользователей: ${processedUsers}/${totalUsers}\n`);
    } catch (error) {
        console.error('\nОшибка в задаче очистки Google Sheets:', error);
    } finally {
        appState.tasks.isCleanupRunning = false;
    }
}


module.exports = {
    createSpreadsheetForUser,
    addDataToSheet,
    // cleanupOldData,
    cleanupAllUsers,
    exportAllDataToSheet
};