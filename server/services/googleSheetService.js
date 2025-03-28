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

// async function addDataToSheet(sheetId, sheetName, data) {
//     const sheets = getSheetsInstance();
//     // console.log("ДАННЫЕ:", data);
//     try {
//         const lastRow = await getLastRow(sheetId, sheetName);
//
//         // Всегда вставляем пустую строку ПЕРЕД новыми данными
//         await sheets.spreadsheets.values.append({
//             spreadsheetId: sheetId,
//             range: `${sheetName}!A${lastRow + 1}:I${lastRow + 1}`,
//             valueInputOption: 'USER_ENTERED',
//             requestBody: {
//                 values: [Array(9).fill('')], // Пустая строка
//             },
//         });
//
//         // Форматируем данные перед вставкой
//         const formattedData = data.map((row) => {
//             const imageUrl = row[3];
//             if (imageUrl) {
//                 row[3] = `=IMAGE("${imageUrl}")`;
//             }
//             return row;
//         });
//
//         // Добавляем данные после пустой строки
//         const response = await sheets.spreadsheets.values.update({
//             spreadsheetId: sheetId,
//             range: `${sheetName}!A${lastRow + 1}:I${lastRow + 1 + formattedData.length}`,
//             valueInputOption: 'USER_ENTERED',
//             requestBody: {
//                 values: formattedData,
//             },
//         });
//
//         console.log('Добавить данные response:', JSON.stringify(response.data, null, 2));
//         return response.data;
//     } catch (error) {
//         console.error('Ошибка добавления данных в лист:', error);
//         throw error;
//     }
// }

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
            data.forEach((row, index) => {
                if (row[6] && row[6].includes('*')) {
                    requests.push({
                        repeatCell: {
                            range: {
                                sheetId: sheetIdValue,
                                startRowIndex: lastRow + index,
                                endRowIndex: lastRow + index + 1,
                                startColumnIndex: 6,
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
                            // Ключевое изменение - правильное указание fields
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

module.exports = {
    createSpreadsheetForUser,
    addDataToSheet
};
