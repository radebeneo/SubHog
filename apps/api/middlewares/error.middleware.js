const errorMiddleware = (err, req, res, next) => {
    try{
        let error = err;

        if (err.type === 'entity.parse.failed'
            && req.method === 'POST'
            && req.originalUrl?.split('?')[0] === '/api/v1/identity/provision') {
            error = new Error('The request body must be an empty JSON object');
            error.statusCode = 400;
            error.code = 'REQUEST_INVALID';
        }

        //Mongoose bad ObjectId conversion error
        if(error === err && err.name === 'CastError') {
            const message = `Resource not found. Invalid ${error.path}`;
            error = new Error(message);
            error.statusCode = 404;
        }

        //Mongoose duplicate key error
        if(error === err && err.code === 11000) {
            const message = 'Duplicate field value entered';
            error = new Error(message);
            error.statusCode = 400;
        }

        //Mongoose validation error
        if(error === err && err.name === 'ValidationError') {
            const message = Object.values(err.errors).map(val => val.message);
            error = new Error(message.join(', '));
            error.statusCode = 400;
        }

        const payload = {
            success: false,
            ...(error.code ? { code: error.code } : {}),
            message: error.message || 'Server error',
        };

        res.status(error.statusCode || 500).json(payload);

    } catch(error) {
        next(error);
    }
}

export default errorMiddleware;
