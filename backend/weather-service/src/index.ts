import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import weatherRoutes from './routes/weather.routes';
import forecastRoutes from './routes/forecast.routes';
import alertRoutes from './routes/alert.routes';
import { errorHandler } from './middleware/error-handler';
import { logger } from './utils/logger';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3008;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use('/api/weather', weatherRoutes);
app.use('/api/forecast', forecastRoutes);
app.use('/api/alerts', alertRoutes);

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'weather-service' });
});

app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Weather service listening on port ${PORT}`);
});

export default app;
