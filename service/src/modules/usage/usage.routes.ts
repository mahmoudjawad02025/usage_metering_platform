import { Router } from 'express';
import { validate } from '../../core/middleware/validate.middleware';
import { consumeController } from './usage.controller';
import { consumeBodySchema } from './usage.schemas';

export const usageRouter = Router();

usageRouter.post('/consume', validate({ body: consumeBodySchema }), consumeController);