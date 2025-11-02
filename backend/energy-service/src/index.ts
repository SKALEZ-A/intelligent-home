import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import energyRoutes from './routes/energy.routes';
import { errorHandler } from '../../shared/middleware/error-handler';
import { logger } from '../../shared/utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/energy', energyRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'energy-service' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Energy service listening on port ${PORT}`);
});

export default app;
