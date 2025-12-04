import express from 'express';
import cors from 'cors';
import multer from 'multer';
import pdf from 'pdf-parse';
import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const app = express();
const port = 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Multer setup for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// OpenAI setup
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.post('/api/parse-bank-statement', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).send('No file uploaded.');
        }

        const { parseBankStatementCore } = await import('./parseBankStatementCore.js');

        const result = await parseBankStatementCore(req.file.buffer, process.env.OPENAI_API_KEY);

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
