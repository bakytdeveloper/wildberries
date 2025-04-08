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

        console.log('Spreadsheet created and access granted:', spreadsheetId);
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

        // 6. Форматирование звёздочки (только если есть звёздочки в данных)
        if (hasStar) {
            const requests = [];
            formattedData.forEach((row, index) => { // Используем formattedData вместо data
                const cellValue = row[6]; // Получаем значение из столбца G (индекс 6)

                // Проверяем, что значение существует и содержит звёздочку
                if (cellValue && typeof cellValue === 'string' && cellValue.includes('*')) {
                    requests.push({
                        repeatCell: {
                            range: {
                                sheetId: sheetIdValue,
                                startRowIndex: lastRow + index,
                                endRowIndex: lastRow + index + 1,
                                startColumnIndex: 6, // Столбец G
                                endColumnIndex: 7
                            },
                            cell: {
                                userEnteredFormat: {
                                    textFormat: {
                                        bold: true,
                                        foregroundColor: {
                                            red: 1,
                                            green: 0,
                                            blue: 0
                                        }
                                    }
                                }
                            },
                            fields: "userEnteredFormat.textFormat"
                        }
                    });
                }
            });

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
        }

        return response.data;
    } catch (error) {
        console.error('Ошибка добавления данных в лист:', error);
        throw error;
    }
}

async function cleanupOldData(sheetId, sheetName, daysThreshold = 7) {
    const sheets = getSheetsInstance();
    try {
        // 1. Получаем все данные из листа (начиная со строки 2)
        const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `${sheetName}!A2:I`,
        });

        const now = new Date();
        const thresholdDate = new Date(now.setDate(now.getDate() - daysThreshold));

        // 2. Получаем заголовки
        const headersResponse = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `${sheetName}!A1:I1`,
        });
        const headers = headersResponse.data.values?.[0] || [];

        // 3. Фильтруем строки
        const values = response.data.values || [];
        const newValues = values.filter(row => {
            const rowDate = new Date(row[8]); // Дата в столбце I
            return rowDate >= thresholdDate;
        });

        // 4. Очищаем лист (кроме заголовков)
        await sheets.spreadsheets.values.clear({
            spreadsheetId: sheetId,
            range: `${sheetName}!A2:I`,
        });

        if (newValues.length > 0) {
            // 5. Восстанавливаем заголовки
            await sheets.spreadsheets.values.update({
                spreadsheetId: sheetId,
                range: `${sheetName}!A1`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: [headers] },
            });

            // 6. Вставляем отфильтрованные данные
            await sheets.spreadsheets.values.update({
                spreadsheetId: sheetId,
                range: `${sheetName}!A2`,
                valueInputOption: 'USER_ENTERED',
                requestBody: { values: newValues },
            });

            // 7. Настраиваем форматирование для столбца G
            const spreadsheet = await sheets.spreadsheets.get({
                spreadsheetId: sheetId,
                fields: 'sheets(properties(sheetId,title))'
            });

            const sheet = spreadsheet.data.sheets.find(s => s.properties.title === sheetName);
            if (!sheet) throw new Error(`Лист "${sheetName}" не найден`);

            const requests = [];
            newValues.forEach((row, index) => {
                const cellRange = {
                    sheetId: sheet.properties.sheetId,
                    startRowIndex: 1 + index,
                    endRowIndex: 2 + index,
                    startColumnIndex: 6, // Столбец G
                    endColumnIndex: 7
                };

                const positionValue = row[6]; // Значение в столбце G (позиция)

                // Для страницы "Артикул" проверяем только наличие звёздочки
                if (sheetName === 'Артикул') {
                    if (positionValue && typeof positionValue === 'string' && positionValue.includes('*')) {
                        // Форматирование для ячеек со звёздочкой (красный)
                        requests.push({
                            repeatCell: {
                                range: cellRange,
                                cell: {
                                    userEnteredFormat: {
                                        textFormat: {
                                            bold: true,
                                            foregroundColor: { red: 1, green: 0, blue: 0 }
                                        }
                                    }
                                },
                                fields: "userEnteredFormat.textFormat"
                            }
                        });
                    } else {
                        // Форматирование для обычных ячеек (чёрный, не жирный)
                        requests.push({
                            repeatCell: {
                                range: cellRange,
                                cell: {
                                    userEnteredFormat: {
                                        textFormat: {
                                            bold: false,
                                            foregroundColor: { red: 0, green: 0, blue: 0 }
                                        }
                                    }
                                },
                                fields: "userEnteredFormat.textFormat"
                            }
                        });
                    }
                }
                // Для страницы "Бренд" оставляем существующую логику
                else if (sheetName === 'Бренд') {
                    if (positionValue && typeof positionValue === 'string' && positionValue.includes('*')) {
                        requests.push({
                            repeatCell: {
                                range: cellRange,
                                cell: {
                                    userEnteredFormat: {
                                        textFormat: {
                                            bold: true,
                                            foregroundColor: { red: 1, green: 0, blue: 0 }
                                        }
                                    }
                                },
                                fields: "userEnteredFormat.textFormat"
                            }
                        });
                    }
                    else {
                        // Форматирование для обычных ячеек (чёрный, не жирный)
                        requests.push({
                            repeatCell: {
                                range: cellRange,
                                cell: {
                                    userEnteredFormat: {
                                        textFormat: {
                                            bold: false,
                                            foregroundColor: { red: 0, green: 0, blue: 0 }
                                        }
                                    }
                                },
                                fields: "userEnteredFormat.textFormat"
                            }
                        });
                    }
                }
            });

            // Применяем все изменения форматирования
            if (requests.length > 0) {
                await sheets.spreadsheets.batchUpdate({
                    spreadsheetId: sheetId,
                    requestBody: { requests }
                });
            }
        }

        console.log(`Удалены данные старше ${daysThreshold} дней`);
    } catch (error) {
        console.error('Ошибка очистки старых данных:', error);
        throw error;
    }
}

module.exports = {
    createSpreadsheetForUser,
    addDataToSheet,
    cleanupOldData
};
