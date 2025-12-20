import "dotenv/config";
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const port = process.env.API_PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Multer setup for memory storage
const upload = multer({ storage: multer.memoryStorage() });



// --- DRIVE LIBRARY IMPLEMENTATION ---

// Simple in-memory cache
let libraryCache = {
    data: null,
    timestamp: 0,
    TTL: 5 * 60 * 1000 // 5 minutes
};

/**
 * Recursively fetches files from Google Drive folder
 */
async function getDriveFiles(folderId, currentPath, apiKey) {
    let items = [];
    let pageToken = null;

    try {
        do {
            const url = new URL('https://www.googleapis.com/drive/v3/files');
            url.searchParams.append('q', `'${folderId}' in parents and trashed=false`);
            url.searchParams.append('fields', 'nextPageToken, files(id, name, mimeType, modifiedTime)');
            url.searchParams.append('key', apiKey);
            url.searchParams.append('pageSize', '1000');
            if (pageToken) {
                url.searchParams.append('pageToken', pageToken);
            }

            const response = await fetch(url.toString());

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Drive API responded with ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            const files = data.files || [];
            pageToken = data.nextPageToken;

            for (const file of files) {
                const isFolder = file.mimeType === 'application/vnd.google-apps.folder';

                // Construct basic item
                const item = {
                    id: file.id,
                    name: file.name,
                    type: isFolder ? 'folder' : 'file',
                    path: currentPath,
                    // Drive web links
                    driveUrl: isFolder
                        ? `https://drive.google.com/drive/folders/${file.id}`
                        : `https://drive.google.com/file/d/${file.id}/view`,
                    summary: isFolder ? 'Carpeta' : `Archivo ${file.name.split('.').pop()?.toUpperCase() || ''}`,
                    keywords: [],
                    updatedAt: file.modifiedTime
                };

                if (!isFolder) {
                    const nameParts = file.name.split('.');
                    if (nameParts.length > 1) {
                        item.ext = nameParts.pop().toLowerCase();
                    }
                    item.mime = file.mimeType;
                }

                items.push(item);

                // Recurse if folder
                if (isFolder) {
                    const childPath = currentPath ? `${currentPath}/${file.name}` : file.name;
                    const children = await getDriveFiles(file.id, childPath, apiKey);
                    items = items.concat(children);
                }
            }

        } while (pageToken);

    } catch (error) {
        console.error(`Error processing folder ${folderId}:`, error);
        throw error;
    }

    return items;
}

app.get('/api/library/manifest', async (req, res) => {
    // 1. Env check
    const apiKey = process.env.DRIVE_API_KEY;
    const folderId = process.env.DRIVE_PUBLIC_FOLDER_ID;

    if (!apiKey || !folderId) {
        return res.status(500).json({
            error: 'Missing configuration: DRIVE_API_KEY or DRIVE_PUBLIC_FOLDER_ID not set.'
        });
    }

    // 2. Cache check
    const now = Date.now();
    if (libraryCache.data && (now - libraryCache.timestamp < libraryCache.TTL)) {
        console.log('Serving library manifest from cache');
        return res.json(libraryCache.data);
    }

    // 3. Fetch from Drive
    try {
        console.log('Fetching library manifest from Google Drive...');
        const data = await getDriveFiles(folderId, '', apiKey);

        // Update cache
        libraryCache.data = data;
        libraryCache.timestamp = now;

        res.json(data);
    } catch (error) {
        console.error('Failed to fetch drive library:', error);
        res.status(500).json({ error: 'Failed to fetch library manifest', details: error.message });
    }
});

// --- END DRIVE LIBRARY IMPLEMENTATION ---

app.post('/api/parse-bank-statement', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        const { parseBankStatementCore } = await import('./parseBankStatementCore.js');


        res.json(result);

    } catch (error) {
        console.error('Error processing PDF:', error);
        // Handle specific errors if needed, otherwise generic 500
        if (error.message === 'Could not extract text from PDF.') {
            return res.status(400).send(error.message);
        }
        res.status(500).send('Error processing PDF: ' + error.message);
    }
});

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
