import { ValidationError } from '../errors/validationError.ts';

export const getRequestBody = (req: any): Promise<unknown> => {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', (chunk: any) => body += chunk);
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch {
                reject(new ValidationError('invalid JSON'));
            }
        });
        req.on('error', reject);
    });
};