import multer from 'multer';
import { parseBankStatementCore } from '../server/parseBankStatementCore.js';

export const config = {
    api: {
        bodyParser: false,
    },
};

const upload = multer({ storage: multer.memoryStorage() });

function runMiddleware(req, res, fn) {
    return new Promise((resolve, reject) => {
        fn(req, res, (result) => {
            if (result instanceof Error) {
                return reject(result);
            }
            return resolve(result);
        });
    });
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        res.status(405).send('Method Not Allowed');
        return;
    }

    try {
        await runMiddleware(req, res, upload.single('file'));

        if (!req.file) {
            res.status(400).send('No file uploaded.');
            return;
        }

        const result = await parseBankStatementCore(req.file.buffer, process.env.OPENAI_API_KEY);
        res.status(200).json(result);

    } catch (error) {
        console.error('Error processing PDF:', error);
        if (error.message === 'Could not extract text from PDF.') {
            res.status(400).send(error.message);
            return;
        }
        res.status(500).send('Error processing PDF: ' + error.message);
    }
}
