import http, { IncomingMessage, ServerResponse } from 'node:http';
import { HttpMethod, RouteHandler } from './router.js';
import { Router } from './router.js';

export interface Request extends IncomingMessage {
    params?: Record<string, string>;
    query?: URLSearchParams;
    body?: unknown;
}

export default function () {
    const router = new Router();

    const server = http.createServer(async (req: Request, res: ServerResponse) => {
        const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
        const method = (req.method as HttpMethod) ?? 'GET';

        res.appendHeader('Content-Type', 'application/json');

        const route = router.findRoute(url.pathname, method);
        if (!route) {
            res.statusCode = 404;
            res.end(JSON.stringify({message: `${method} ${url.pathname} Not Found`}));
            return;
        }

        try {
            req.params = route.params;
            req.query = url.searchParams;

            await route.handler(req, res);
        } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({message: 'Internal Server Error'}));
        }
    });

    return {
        get: (path: string, handler: RouteHandler) => {
            router.addRoute(path, 'GET', handler);
        },
        post: (path: string, handler: RouteHandler) => {
            router.addRoute(path, 'POST', handler);
        },
        put: (path: string, handler: RouteHandler) => {
            router.addRoute(path, 'PUT', handler);
        },
        patch: (path: string, handler: RouteHandler) => {
            router.addRoute(path, 'PATCH', handler);
        },
        delete: (path: string, handler: RouteHandler) => {
            router.addRoute(path, 'DELETE', handler);
        },
        listen: (port: number, cb?: () => void) => {
            server.listen(port);
            if (cb) cb();
        },
    };
}