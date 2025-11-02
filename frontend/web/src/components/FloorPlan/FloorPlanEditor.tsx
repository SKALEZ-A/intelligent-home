import React, { useState, useRef, useEffect } from 'react';
import './FloorPlanEditor.css';

interface Device {
  id: string;
  name: string;
  type: string;
  x: number;
  y: number;
}

interface Room {
  id: string;
  name: string;
  points: Array<{ x: number; y: number }>;
  color: string;
}

export const FloorPlanEditor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<'view' | 'add-device' | 'draw-room'>('view');

  useEffect(() => {
    drawFloorPlan();
  }, [devices, rooms]);

  const drawFloorPlan = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    rooms.forEach(room => {
      ctx.fillStyle = room.color + '40';
      ctx.strokeStyle = room.color;
      ctx.lineWidth = 2;

      ctx.beginPath();
      room.points.forEach((point, index) => {
        if (index === 0) {
          ctx.moveTo(point.x, point.y);
        } else {
          ctx.lineTo(point.x, point.y);
        }
      });
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const centerX = room.points.reduce((sum, p) => sum + p.x, 0) / room.points.length;
      const centerY = room.points.reduce((sum, p) => sum + p.y, 0) / room.points.length;
      ctx.fillStyle = '#333';
      ctx.font = '14px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(room.name, centerX, centerY);
    });

    devices.forEach(device => {
      const icon = getDeviceIcon(device.type);
      ctx.fillStyle = selectedDevice?.id === device.id ? '#2196F3' : '#666';
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.fillText(icon, device.x, device.y);

      ctx.fillStyle = '#333';
      ctx.font = '10px Arial';
      ctx.fillText(device.name, device.x, device.y + 20);
    });
  };

  const getDeviceIcon = (type: string): string => {
    const icons: Record<string, string> = {
      light: '💡',
      thermostat: '🌡️',
      camera: '📷',
      lock: '🔒',
      speaker: '🔊',
      tv: '📺',
      sensor: '📡'
    };
    return icons[type] || '📱';
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (mode === 'add-device') {
      const newDevice: Device = {
        id: Date.now().toString(),
        name: `Device ${devices.length + 1}`,
        type: 'light',
        x,
        y
      };
      setDevices([...devices, newDevice]);
      setMode('view');
    } else if (mode === 'view') {
      const clickedDevice = devices.find(d => 
        Math.abs(d.x - x) < 20 && Math.abs(d.y - y) < 20
      );
      setSelectedDevice(clickedDevice || null);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'view' || !selectedDevice) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (Math.abs(selectedDevice.x - x) < 20 && Math.abs(selectedDevice.y - y) < 20) {
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !selectedDevice) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setDevices(devices.map(d => 
      d.id === selectedDevice.id ? { ...d, x, y } : d
    ));
    setSelectedDevice({ ...selectedDevice, x, y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  return (
    <div className="floor-plan-editor">
      <div className="editor-toolbar">
        <h2>Floor Plan Editor</h2>
        <div className="toolbar-buttons">
          <button 
            className={mode === 'view' ? 'active' : ''}
            onClick={() => setMode('view')}
          >
            View
          </button>
          <button 
            className={mode === 'add-device' ? 'active' : ''}
            onClick={() => setMode('add-device')}
          >
            Add Device
          </button>
          <button 
            className={mode === 'draw-room' ? 'active' : ''}
            onClick={() => setMode('draw-room')}
          >
            Draw Room
          </button>
        </div>
      </div>

      <div className="editor-content">
        <canvas
          ref={canvasRef}
          width={800}
          height={600}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="floor-plan-canvas"
        />

        {selectedDevice && (
          <div className="device-properties">
            <h3>Device Properties</h3>
            <div className="property">
              <label>Name:</label>
              <input
                type="text"
                value={selectedDevice.name}
                onChange={(e) => {
                  const updated = { ...selectedDevice, name: e.target.value };
                  setSelectedDevice(updated);
                  setDevices(devices.map(d => d.id === updated.id ? updated : d));
                }}
              />
            </div>
            <div className="property">
              <label>Type:</label>
              <select
                value={selectedDevice.type}
                onChange={(e) => {
                  const updated = { ...selectedDevice, type: e.target.value };
                  setSelectedDevice(updated);
                  setDevices(devices.map(d => d.id === updated.id ? updated : d));
                }}
              >
                <option value="light">Light</option>
                <option value="thermostat">Thermostat</option>
                <option value="camera">Camera</option>
                <option value="lock">Lock</option>
                <option value="speaker">Speaker</option>
                <option value="tv">TV</option>
                <option value="sensor">Sensor</option>
              </select>
            </div>
            <button
              className="delete-btn"
              onClick={() => {
                setDevices(devices.filter(d => d.id !== selectedDevice.id));
                setSelectedDevice(null);
              }}
            >
              Delete Device
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
