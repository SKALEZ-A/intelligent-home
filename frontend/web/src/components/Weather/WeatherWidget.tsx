import React, { useEffect, useState } from 'react';
import { useWeather } from '../../hooks/useWeather';
import { Weather, WeatherForecast } from '../../types/weather';
import './WeatherWidget.css';

export const WeatherWidget: React.FC = () => {
  const { weather, forecast, loading, error, refreshWeather } = useWeather();
  const [selectedDay, setSelectedDay] = useState<number>(0);

  useEffect(() => {
    refreshWeather();
    const interval = setInterval(refreshWeather, 300000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return <div className="weather-widget weather-widget--loading">Loading weather...</div>;
  }

  if (error) {
    return <div className="weather-widget weather-widget--error">Error loading weather</div>;
  }

  if (!weather) {
    return null;
  }

  return (
    <div className="weather-widget">
      <div className="weather-widget__current">
        <div className="weather-widget__icon">
          <img src={`/icons/weather/${weather.current.icon}.svg`} alt={weather.current.condition} />
        </div>
        <div className="weather-widget__temp">
          {Math.round(weather.current.temperature)}°
        </div>
        <div className="weather-widget__details">
          <div className="weather-widget__condition">{weather.current.condition}</div>
          <div className="weather-widget__location">{weather.location.city}</div>
        </div>
      </div>

      <div className="weather-widget__stats">
        <div className="weather-widget__stat">
          <span className="weather-widget__stat-label">Feels Like</span>
          <span className="weather-widget__stat-value">{Math.round(weather.current.feelsLike)}°</span>
        </div>
        <div className="weather-widget__stat">
          <span className="weather-widget__stat-label">Humidity</span>
          <span className="weather-widget__stat-value">{weather.current.humidity}%</span>
        </div>
        <div className="weather-widget__stat">
          <span className="weather-widget__stat-label">Wind</span>
          <span className="weather-widget__stat-value">{weather.current.windSpeed} mph</span>
        </div>
        <div className="weather-widget__stat">
          <span className="weather-widget__stat-label">UV Index</span>
          <span className="weather-widget__stat-value">{weather.current.uvIndex}</span>
        </div>
      </div>

      {forecast && forecast.length > 0 && (
        <div className="weather-widget__forecast">
          <h3 className="weather-widget__forecast-title">7-Day Forecast</h3>
          <div className="weather-widget__forecast-list">
            {forecast.map((day, index) => (
              <div
                key={day.date}
                className={`weather-widget__forecast-item ${selectedDay === index ? 'weather-widget__forecast-item--selected' : ''}`}
                onClick={() => setSelectedDay(index)}
              >
                <div className="weather-widget__forecast-day">
                  {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <img
                  src={`/icons/weather/${day.icon}.svg`}
                  alt={day.condition}
                  className="weather-widget__forecast-icon"
                />
                <div className="weather-widget__forecast-temps">
                  <span className="weather-widget__forecast-high">{Math.round(day.high)}°</span>
                  <span className="weather-widget__forecast-low">{Math.round(day.low)}°</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {weather.alerts && weather.alerts.length > 0 && (
        <div className="weather-widget__alerts">
          {weather.alerts.map(alert => (
            <div key={alert.id} className={`weather-widget__alert weather-widget__alert--${alert.severity}`}>
              <div className="weather-widget__alert-title">{alert.title}</div>
              <div className="weather-widget__alert-description">{alert.description}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
