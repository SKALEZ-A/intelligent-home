import { Router } from 'express';
import { ForecastController } from '../controllers/forecast.controller';
import { authenticate } from '../../../shared/middleware/authenticate';

const router = Router();
const forecastController = new ForecastController();

router.use(authenticate);

router.get('/hourly', forecastController.getHourlyForecast.bind(forecastController));
router.get('/daily', forecastController.getDailyForecast.bind(forecastController));
router.get('/extended', forecastController.getExtendedForecast.bind(forecastController));
router.get('/location/:lat/:lon', forecastController.getForecastByLocation.bind(forecastController));

export default router;
