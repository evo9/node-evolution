import { IncomingMessage } from 'node:http';
import crypto from 'node:crypto';
import server from './server.js';

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
                reject('Invalid JSON Body');
            }
        });
    });
};

let bookings = new Map<string, Booking>();

const app = server();

app.get('/', async (req, res) => {
    res.end(JSON.stringify('Hello'))
})

app.get('/bookings', async (req, res) => {
    res.end(JSON.stringify(Array.from(bookings.values())));
});

app.post('/bookings', async (req, res) => {
    try {
        const body = await parseBody<Omit<Booking, 'id' | 'enabled'>>(req);
        if (!body.slotId || !body.userId) {
            res.statusCode = 400;
            res.end(JSON.stringify({message: 'Invalid booking data'}));
            return;
        }

        const existed = Array.from(bookings.values()).find((b) => b.enabled && b.slotId === body.slotId);
        if (existed) {
            res.statusCode = 409;
            res.end(JSON.stringify({message: `Slot #${body.slotId} already booked`}));
            return;
        }

        const created = {
            id: crypto.randomUUID(),
            slotId: body.slotId,
            userId: body.userId,
            enabled: true,
        };

        bookings.set(created.id, created);

        res.statusCode = 201;
        res.end(JSON.stringify(created));
    } catch (e) {
        res.statusCode = 400;
        res.end(JSON.stringify({message: 'Invalid json body'}));
    }
});

app.get('/bookings/:id', async (req, res) => {
    const id = req.params?.id ?? null;
    if (!id || !bookings.has(id)) {
        res.statusCode = 404;
        res.end(JSON.stringify({message: `Booking #${id} not found`}));
        return;
    }

    res.end(JSON.stringify(bookings.get(id)));
});

app.post('/bookings/:id/cancel', async (req, res) => {
    const id = req.params?.id ?? null;
    if (!id || !bookings.has(id)) {
        res.statusCode = 404;
        res.end(JSON.stringify({message: `Booking #${id} not found`}));
        return;
    }

    bookings.set(id, {...bookings.get(id)!, enabled: false},);

    res.end(JSON.stringify({status: 'OK'}));
});

app.listen(3035, () => console.log(`Server started at http://localhost:3035`));