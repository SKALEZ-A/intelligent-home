import React, { useState, useEffect, useMemo } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Tooltip,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
} from '@mui/material';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  BoltOutlined,
  SolarPowerOutlined,
  BatteryChargingFullOutlined,
  EcoOutlined,
  RefreshOutlined,
  DownloadOutlined,
  InfoOutlined,
} from '@mui/icons-material';
import { useAppDispatch, useAppSelector } from '../../hooks/redux';
import {
  fetchEnergyConsumption,
  fetchEnergyForecast,
  fetchEnergyRecommendations,
  selectEnergyData,
  selectEnergyLoading,
  selectEnergyError,
} from '../../store/slices/energySlice';
import { formatCurrency, formatEnergy, formatPercentage } from '../../utils/formatters';

interface EnergyDashboardProps {
  homeId: string;
}

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const EnergyDashboard: React.FC<EnergyDashboardProps> = ({ homeId }) => {
  const dispatch = useAppDispatch();
  const energyData = useAppSelector(selectEnergyData);
  const loading = useAppSelector(selectEnergyLoading);
  const error = useAppSelector(selectEnergyError);

  const [period, setPeriod] = useState<'day' | 'week' | 'month' | 'year'>('day');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadEnergyData();
  }, [homeId, period]);

  const loadEnergyData = async () => {
    try {
      await Promise.all([
        dispatch(fetchEnergyConsumption({ homeId, period })).unwrap(),
        dispatch(fetchEnergyForecast({ homeId, period })).unwrap(),
        dispatch(fetchEnergyRecommendations({ homeId })).unwrap(),
      ]);
    } catch (err) {
      console.error('Failed to load energy data:', err);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadEnergyData();
    setRefreshing(false);
  };

  const handleExport = () => {
    // Export energy data to CSV
    const csv = generateCSV(energyData);
    downloadCSV(csv, `energy-report-${period}-${new Date().toISOString()}.csv`);
  };

  const generateCSV = (data: any): string => {
    // Generate CSV from energy data
    return '';
  };

  const downloadCSV = (csv: string, filename: string) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const totalEnergy = useMemo(() => {
    if (!energyData?.consumption) return 0;
    return energyData.consumption.totalEnergyWh / 1000; // Convert to kWh
  }, [energyData]);

  const totalCost = useMemo(() => {
    if (!energyData?.consumption) return 0;
    return energyData.consumption.totalCost;
  }, [energyData]);

  const solarProduction = useMemo(() => {
    if (!energyData?.consumption?.solarProductionWh) return 0;
    return energyData.consumption.solarProductionWh / 1000; // Convert to kWh
  }, [energyData]);

  const gridImport = useMemo(() => {
    if (!energyData?.consumption?.gridImportWh) return 0;
    return energyData.consumption.gridImportWh / 1000;
  }, [energyData]);

  const gridExport = useMemo(() => {
    if (!energyData?.consumption?.gridExportWh) return 0;
    return energyData.consumption.gridExportWh / 1000;
  }, [energyData]);

  const selfConsumption = useMemo(() => {
    if (!solarProduction || !totalEnergy) return 0;
    return (solarProduction / totalEnergy) * 100;
  }, [solarProduction, totalEnergy]);

  const costTrend = useMemo(() => {
    // Calculate cost trend compared to previous period
    return 5.2; // Placeholder
  }, [energyData]);

  const energyTrend = useMemo(() => {
    // Calculate energy trend compared to previous period
    return -3.1; // Placeholder
  }, [energyData]);

  const deviceBreakdown = useMemo(() => {
    if (!energyData?.consumption?.deviceBreakdown) return [];
    return energyData.consumption.deviceBreakdown
      .sort((a, b) => b.energyWh - a.energyWh)
      .slice(0, 10);
  }, [energyData]);

  const hourlyData = useMemo(() => {
    // Generate hourly consumption data
    return Array.from({ length: 24 }, (_, i) => ({
      hour: `${i}:00`,
      consumption: Math.random() * 5,
      solar: Math.random() * 3,
      grid: Math.random() * 2,
    }));
  }, [energyData]);

  const recommendations = useMemo(() => {
    if (!energyData?.recommendations) return [];
    return energyData.recommendations.slice(0, 5);
  }, [energyData]);

  if (loading && !energyData) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ m: 2 }}>
        {error}
      </Alert>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" fontWeight="bold">
          Energy Dashboard
        </Typography>
        <Box display="flex" gap={2}>
          <FormControl size="small" sx={{ minWidth: 120 }}>
            <InputLabel>Period</InputLabel>
            <Select
              value={period}
              label="Period"
              onChange={(e) => setPeriod(e.target.value as any)}
            >
              <MenuItem value="day">Today</MenuItem>
              <MenuItem value="week">This Week</MenuItem>
              <MenuItem value="month">This Month</MenuItem>
              <MenuItem value="year">This Year</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Refresh">
            <IconButton onClick={handleRefresh} disabled={refreshing}>
              <RefreshOutlined />
            </IconButton>
          </Tooltip>
          <Tooltip title="Export">
            <IconButton onClick={handleExport}>
              <DownloadOutlined />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {/* Summary Cards */}
      <Grid container spacing={3} mb={3}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <BoltOutlined color="primary" sx={{ mr: 1 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Total Consumption
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                {formatEnergy(totalEnergy)}
              </Typography>
              <Box display="flex" alignItems="center" mt={1}>
                {energyTrend < 0 ? (
                  <TrendingDown color="success" fontSize="small" />
                ) : (
                  <TrendingUp color="error" fontSize="small" />
                )}
                <Typography
                  variant="body2"
                  color={energyTrend < 0 ? 'success.main' : 'error.main'}
                  ml={0.5}
                >
                  {formatPercentage(Math.abs(energyTrend))} vs last {period}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <Typography variant="subtitle2" color="text.secondary">
                  Total Cost
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                {formatCurrency(totalCost)}
              </Typography>
              <Box display="flex" alignItems="center" mt={1}>
                {costTrend < 0 ? (
                  <TrendingDown color="success" fontSize="small" />
                ) : (
                  <TrendingUp color="error" fontSize="small" />
                )}
                <Typography
                  variant="body2"
                  color={costTrend < 0 ? 'success.main' : 'error.main'}
                  ml={0.5}
                >
                  {formatPercentage(Math.abs(costTrend))} vs last {period}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <SolarPowerOutlined color="warning" sx={{ mr: 1 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  Solar Production
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                {formatEnergy(solarProduction)}
              </Typography>
              <Box mt={1}>
                <Typography variant="body2" color="text.secondary">
                  {formatPercentage(selfConsumption)} self-consumption
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={1}>
                <EcoOutlined color="success" sx={{ mr: 1 }} />
                <Typography variant="subtitle2" color="text.secondary">
                  CO₂ Saved
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight="bold">
                {(solarProduction * 0.5).toFixed(1)} kg
              </Typography>
              <Box mt={1}>
                <Typography variant="body2" color="text.secondary">
                  Equivalent to {(solarProduction * 2).toFixed(0)} trees
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Charts */}
      <Grid container spacing={3} mb={3}>
        {/* Consumption Over Time */}
        <Grid item xs={12} lg={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Energy Consumption Over Time
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" />
                  <YAxis label={{ value: 'kWh', angle: -90, position: 'insideLeft' }} />
                  <RechartsTooltip />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="consumption"
                    stackId="1"
                    stroke="#8884d8"
                    fill="#8884d8"
                    name="Total Consumption"
                  />
                  <Area
                    type="monotone"
                    dataKey="solar"
                    stackId="2"
                    stroke="#82ca9d"
                    fill="#82ca9d"
                    name="Solar Production"
                  />
                  <Area
                    type="monotone"
                    dataKey="grid"
                    stackId="3"
                    stroke="#ffc658"
                    fill="#ffc658"
                    name="Grid Import"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Energy Sources */}
        <Grid item xs={12} lg={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Energy Sources
              </Typography>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Solar', value: solarProduction },
                      { name: 'Grid', value: gridImport },
                    ]}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {[
                      { name: 'Solar', value: solarProduction },
                      { name: 'Grid', value: gridImport },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Device Breakdown */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Top Energy Consumers
              </Typography>
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Device</TableCell>
                      <TableCell align="right">Energy (kWh)</TableCell>
                      <TableCell align="right">Cost</TableCell>
                      <TableCell align="right">Percentage</TableCell>
                      <TableCell align="right">Runtime (hrs)</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {deviceBreakdown.map((device) => (
                      <TableRow key={device.deviceId}>
                        <TableCell>{device.deviceName}</TableCell>
                        <TableCell align="right">
                          {formatEnergy(device.energyWh / 1000)}
                        </TableCell>
                        <TableCell align="right">{formatCurrency(device.cost)}</TableCell>
                        <TableCell align="right">
                          <Box display="flex" alignItems="center" justifyContent="flex-end">
                            <Box width="100px" mr={1}>
                              <LinearProgress
                                variant="determinate"
                                value={device.percentage}
                                sx={{ height: 8, borderRadius: 4 }}
                              />
                            </Box>
                            {formatPercentage(device.percentage)}
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          {device.runtimeHours.toFixed(1)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        </Grid>

        {/* Recommendations */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Energy Saving Recommendations
              </Typography>
              <Grid container spacing={2}>
                {recommendations.map((rec) => (
                  <Grid item xs={12} md={6} key={rec.id}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Box display="flex" justifyContent="space-between" alignItems="start" mb={1}>
                        <Typography variant="subtitle1" fontWeight="bold">
                          {rec.title}
                        </Typography>
                        <Chip
                          label={rec.difficulty}
                          size="small"
                          color={
                            rec.difficulty === 'easy'
                              ? 'success'
                              : rec.difficulty === 'medium'
                              ? 'warning'
                              : 'error'
                          }
                        />
                      </Box>
                      <Typography variant="body2" color="text.secondary" mb={2}>
                        {rec.description}
                      </Typography>
                      <Box display="flex" justifyContent="space-between" alignItems="center">
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Potential Savings
                          </Typography>
                          <Typography variant="h6" color="success.main">
                            {formatPercentage(rec.potentialSavings)}
                          </Typography>
                        </Box>
                        <Box>
                          <Typography variant="caption" color="text.secondary">
                            Est. Cost Savings
                          </Typography>
                          <Typography variant="h6" color="success.main">
                            {formatCurrency(rec.estimatedCostSavings)}/mo
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EnergyDashboard;
