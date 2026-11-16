import { google } from 'googleapis';

type CellValue = string | number | boolean | null | undefined;

const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
const privateKey = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n');

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: clientEmail,
    private_key: privateKey,
  },
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
    'https://www.googleapis.com/auth/drive',
  ],
});

export const sheets = google.sheets({ version: 'v4', auth });
export const drive = google.drive({ version: 'v3', auth });
export const SPREADSHEET_ID = process.env.SPREADSHEET_ID ?? '';

export const SHEET_NAMES = [
  'DANH_SACH',
  'CAU_HINH',
  'LICH',
  'LOG_TRUC',
  'THONG_KE',
  'TAI_KHOAN',
  'PHAN_HOI',
  'KY_LUAT',
  'KH_SINH_HOAT',
  'QUAN_LY_QUY',
  'THONG_BAO',
] as const;

export type SheetName = (typeof SHEET_NAMES)[number];

export async function getAllSheetsData(): Promise<Record<SheetName, CellValue[][]>> {
  const ranges = SHEET_NAMES.map((name) => `${name}!A:Z`);
  const res = await sheets.spreadsheets.values.batchGet({
    spreadsheetId: SPREADSHEET_ID,
    ranges,
  });

  const result = {} as Record<SheetName, CellValue[][]>;
  res.data.valueRanges?.forEach((vr, idx) => {
    result[SHEET_NAMES[idx]] = (vr.values as CellValue[][]) || [];
  });
  return result;
}

export async function appendSheetRow(sheetName: SheetName, rowArray: CellValue[]): Promise<void> {
  await sheets.spreadsheets.values.append({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A:Z`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [rowArray] },
  });
}

export async function updateSheetRange(rangeA1: string, values2D: CellValue[][]): Promise<void> {
  await sheets.spreadsheets.values.update({
    spreadsheetId: SPREADSHEET_ID,
    range: rangeA1,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: values2D },
  });
}

export async function overwriteSheetBody(sheetName: SheetName, rows2D: CellValue[][]): Promise<void> {
  await sheets.spreadsheets.values.clear({
    spreadsheetId: SPREADSHEET_ID,
    range: `${sheetName}!A2:Z`,
  });

  if (rows2D.length > 0) {
    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A2`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: rows2D },
    });
  }
}

export async function deleteSheetRow(sheetName: SheetName, rowIndex1Based: number): Promise<void> {
  const meta = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
  const sheetObj = meta.data.sheets?.find((s) => s.properties?.title === sheetName);
  const sheetId = sheetObj?.properties?.sheetId;

  if (sheetId === undefined) {
    throw new Error(`Không tìm thấy sheet ${sheetName}`);
  }

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    requestBody: {
      requests: [
        {
          deleteDimension: {
            range: {
              sheetId,
              dimension: 'ROWS',
              startIndex: rowIndex1Based - 1,
              endIndex: rowIndex1Based,
            },
          },
        },
      ],
    },
  });
}