import { Router } from 'express';
import { EnergyController } from '../controllers/energy.controller';
import { authenticate } from '../../../shared/middleware/authenticate';

const router = Router();
const controller = new EnergyController();

// All routes require authentication
router.use(authenticate);

// Energy consumption
router.get('/consumption', controller.getConsumption.bind(controller));
router.get('/consumption/device/:deviceId', controller.getDeviceConsumption.bind(controller));
router.get('/consumption/summary', controller.getConsumptionSummary.bind(controller));

// Energy analytics
router.get('/analytics', controller.getAnalytics.bind(controller));
router.get('/analytics/trends', controller.getTrends.bind(controller));
router.get('/analytics/comparison', controller.getComparison.bind(controller));

// Energy forecasting
router.get('/forecast', controller.getForecast.bind(controller));
router.get('/forecast/device/:deviceId', controller.getDeviceForecast.bind(controller));

// Energy profiles
router.get('/profiles', controller.getProfiles.bind(controller));
router.get('/profiles/:id', controller.getProfile.bind(controller));
router.post('/profiles', controller.createProfile.bind(controller));
router.put('/profiles/:id', controller.updateProfile.bind(controller));
router.delete('/profiles/:id', controller.deleteProfile.bind(controller));

// Energy optimization
router.get('/optimization/recommendations', controller.getRecommendations.bind(controller));
router.post('/optimization/apply', controller.applyOptimization.bind(controller));
router.get('/optimization/savings', controller.getSavings.bind(controller));

// Load balancing
router.get('/load-balancing/status', controller.getLoadStatus.bind(controller));
router.post('/load-balancing/balance', controller.balanceLoad.bind(controller));
router.get('/load-balancing/schedule', controller.getLoadSchedule.bind(controller));

// Cost calculation
router.get('/cost', controller.getCost.bind(controller));
router.get('/cost/breakdown', controller.getCostBreakdown.bind(controller));
router.get('/cost/projection', controller.getCostProjection.bind(controller));

// Carbon footprint
router.get('/carbon', controller.getCarbonFootprint.bind(controller));
router.get('/carbon/offset', controller.getCarbonOffset.bind(controller));

// Reports
router.get('/reports/daily', controller.getDailyReport.bind(controller));
router.get('/reports/weekly', controller.getWeeklyReport.bind(controller));
router.get('/reports/monthly', controller.getMonthlyReport.bind(controller));
router.get('/reports/export', controller.exportReport.bind(controller));

export { router as energyRoutes };
