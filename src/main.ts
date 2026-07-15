import { IncomingMessage } from 'node:http';
import crypto from 'node:crypto';
import server, { ErrorHandler, Handler } from './server.js';
import { HttpError } from './http-error.js';

interface Booking {
    id: string;
    slotId: number;
    userId: number;
    enabled: boolean;
}

const parseBody = <T>(req: IncomingMessage): Promise<T> => {
    return new Promise((resolve, reject) => {
        let body = '';

        req.on('data', (chunk) => {
            body += chunk;
        });

        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                reject(new HttpError(400, 'Invalid JSON Body'));
            }
        });
    });
};

let bookings = new Map<string, Booking>();

const app = server();

const logger: Handler = async (req, res, next) => {
    const start = Date.now();
    await next();
    console.log(`${req.method} ${req.url} → ${res.statusCode} (${Date.now() - start}ms)`);
};

app.use(logger);

app.use(async (req, res, next) => {
    if (req.method == 'POST' || req.method == 'PUT' || req.method == 'PATCH') {
        req.body = await parseBody(req);
    }
    await next();
});

app.use(logger);

const errorHandler: ErrorHandler = async (err, req, res, next) => {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof HttpError ? err.message : 'Internal sever Error';
    res.status(status).json({message});
};

app.use(errorHandler);

app.get('/', async (req, res) => {
    res.end(JSON.stringify('Hello'));
});

app.get('/bookings', async (req, res) => {
    res.json(Array.from(bookings.values()));
});

app.post('/bookings', async (req, res) => {
    const body = req.body as Omit<Booking, 'id' | 'enabled'>;
    if (!body.slotId || !body.userId) throw new HttpError(400, 'Invalid booking data');

    const existed = Array.from(bookings.values()).find((b) => b.enabled && b.slotId === body.slotId);
    if (existed) throw new HttpError(409, `Slot #${body.slotId} already booked`);

    const created = {
        id: crypto.randomUUID(),
        slotId: body.slotId,
        userId: body.userId,
        enabled: true,
    };

    bookings.set(created.id, created);

    res.status(201).json(created);
});

app.get('/bookings/:id', async (req, res) => {
    const id = req.params?.id ?? null;
    if (!id || !bookings.has(id)) throw new HttpError(404, `Booking #${id} not found`);

    res.json(bookings.get(id));
});

app.post('/bookings/:id/cancel', async (req, res) => {
    const id = req.params?.id ?? null;
    if (!id || !bookings.has(id)) throw new HttpError(404, `Booking #${id} not found`);

    bookings.set(id, {...bookings.get(id)!, enabled: false});

    res.json({status: 'OK'});
});

app.listen(3035, () => console.log(`Server started at http://localhost:3035`));