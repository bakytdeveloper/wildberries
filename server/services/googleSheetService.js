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

const TEMPLATE_SPREADSHEET_ID = '1SARDBpZGJnHAIw6al034_ZGsrplWCHCe1MqxaVszwyc';

async function createSpreadsheetForUser(email) {
    const drive = getDriveInstance();
    try {
        const copyResponse = await drive.files.copy({
            fileId: TEMPLATE_SPREADSHEET_ID,
            requestBody: {
                name: `${email} - User Data`,
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

async function addDataToSheet(sheetId, sheetName, data) {
    const sheets = getSheetsInstance();
    console.log("DATA:", data);
    try {
        const lastRow = await getLastRow(sheetId, sheetName);

        if (lastRow > 1) {
            await sheets.spreadsheets.values.append({
                spreadsheetId: sheetId,
                range: `${sheetName}!A${lastRow}:J${lastRow}`,
                valueInputOption: 'USER_ENTERED',
                requestBody: {
                    values: [Array(10).fill('')],
                },
            });
        }

        const formattedData = data.map((row) => {
            const imageUrl = row[3];
            if (imageUrl) {
                row[3] = `=IMAGE("${imageUrl}")`;
            }
            return row;
        });

        const response = await sheets.spreadsheets.values.append({
            spreadsheetId: sheetId,
            range: `${sheetName}!A${lastRow + 1}:J${lastRow + formattedData.length}`,
            valueInputOption: 'USER_ENTERED',
            requestBody: {
                values: formattedData,
            },
        });

        console.log('Add data response:', JSON.stringify(response.data, null, 2));
        return response.data;
    } catch (error) {
        console.error('Error adding data to sheet:', error);
        throw error;
    }
}

module.exports = {
    createSpreadsheetForUser,
    getLastRow,
    addDataToSheet
};
