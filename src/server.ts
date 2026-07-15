import http, { IncomingMessage, ServerResponse } from 'node:http';
import { HttpMethod } from './router.js';
import { Router } from './router.js';
import { HttpError } from './http-error.js';

export interface Request extends IncomingMessage {
    params?: Record<string, string>;
    query?: URLSearchParams;
    body?: unknown;
}

export class Response extends ServerResponse {
    status(code: number): this {
        this.statusCode = code;
        return this;
    }

    json(data: unknown): void {
        this.setHeader('Content-Type', 'application/json');
        this.end(JSON.stringify(data));
    }
}

export type Handler = (req: Request, res: Response, next: () => Promise<void>) => Promise<void> | void;

export type ErrorHandler = (err: unknown, req: Request, res: Response, next: (err?: Error) => Promise<void>) => Promise<void> | void;

interface App {
    use(handler: Handler): void;

    use(handler: ErrorHandler): void;

    get(path: string, handler: Handler): void;

    post(path: string, handler: Handler): void;

    put(path: string, handler: Handler): void;

    patch(path: string, handler: Handler): void;

    delete(path: string, handler: Handler): void;

    listen(port: number, cb?: () => void): void;
}

async function dispatch(
    handlers: (Handler | ErrorHandler)[],
    req: Request,
    res: Response,
    i: number,
    err?: unknown,
): Promise<void> {
    const handler = handlers[i];

    if (!handler) {
        if (err) throw err;
        return;
    }

    const isErrorHandler = handler.length === 4;
    const next = (e?: unknown) => dispatch(handlers, req, res, i + 1, e ?? err);

    if (err && !isErrorHandler) return next(err);
    if (!err && isErrorHandler) return next();

    try {
        isErrorHandler ? await (handler as ErrorHandler)(err, req, res, next) : await (handler as Handler)(req, res, next);
    } catch (e) {
        return next(e);
    }
}

export default function (): App {
    const router = new Router();
    const middlewares: (Handler | ErrorHandler)[] = [];

    const server = http.createServer(
        {ServerResponse: Response},
        async (req: Request, res: Response,
        ) => {
            const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
            const method = (req.method as HttpMethod) ?? 'GET';

            const route = router.findRoute(url.pathname, method);

            const notFound: Handler = () => {
                throw new HttpError(404, `${method} ${url.pathname} Not Found`);
            }

            try {
                req.params = route?.params;
                req.query = url.searchParams;

                const _middlewares = middlewares.filter((fn) => fn.length !== 4);
                const _errorHandlers = middlewares.filter((fn) => fn.length === 4);

                await dispatch(
                    [
                        ..._middlewares,
                        ...(route ? [route.handler] : []),
                        notFound,
                        ..._errorHandlers],
                    req,
                    res,
                    0,
                );
            } catch (e) {
                if (res.headersSent) return;
                console.log(322323);
                res.status(500).json({message: 'Internal Server Error'});
            }
        });

    return {
        get: (path: string, handler: Handler) => {
            router.addRoute(path, 'GET', handler);
        },
        post: (path: string, handler: Handler) => {
            router.addRoute(path, 'POST', handler);
        },
        put: (path: string, handler: Handler) => {
            router.addRoute(path, 'PUT', handler);
        },
        patch: (path: string, handler: Handler) => {
            router.addRoute(path, 'PATCH', handler);
        },
        delete: (path: string, handler: Handler) => {
            router.addRoute(path, 'DELETE', handler);
        },
        use(fn: Handler | ErrorHandler) {
            middlewares.push(fn);
        },
        listen: (port: number, cb?: () => void) => {
            server.listen(port);
            if (cb) cb();
        },
    };
}