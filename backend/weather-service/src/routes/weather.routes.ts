import { Router } from 'express';
import { WeatherController } from '../controllers/weather.controller';

const router = Router();
const weatherController = new WeatherController();

router.get('/current/:location', weatherController.getCurrentWeather.bind(weatherController));
router.get('/forecast/:location', weatherController.getForecast.bind(weatherController));
router.get('/historical/:location', weatherController.getHistoricalData.bind(weatherController));
router.post('/alerts/subscribe', weatherController.subscribeToAlerts.bind(weatherController));
router.delete('/alerts/unsubscribe/:id', weatherController.unsubscribeFromAlerts.bind(weatherController));

export default router;
