import React, { useState, useEffect } from 'react';
import './RoomManager.css';

interface Room {
  id: string;
  name: string;
  type: string;
  devices: string[];
  temperature?: number;
  humidity?: number;
  occupancy: boolean;
}

export const RoomManager: React.FC = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomType, setNewRoomType] = useState('living_room');

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    const mockRooms: Room[] = [
      {
        id: '1',
        name: 'Living Room',
        type: 'living_room',
        devices: ['light-1', 'tv-1', 'thermostat-1'],
        temperature: 22,
        humidity: 45,
        occupancy: true
      },
      {
        id: '2',
        name: 'Bedroom',
        type: 'bedroom',
        devices: ['light-2', 'fan-1'],
        temperature: 20,
        humidity: 50,
        occupancy: false
      },
      {
        id: '3',
        name: 'Kitchen',
        type: 'kitchen',
        devices: ['light-3', 'smart-plug-1'],
        temperature: 23,
        humidity: 55,
        occupancy: false
      }
    ];
    setRooms(mockRooms);
  };

  const handleAddRoom = async () => {
    const newRoom: Room = {
      id: Date.now().toString(),
      name: newRoomName,
      type: newRoomType,
      devices: [],
      occupancy: false
    };

    setRooms([...rooms, newRoom]);
    setShowAddModal(false);
    setNewRoomName('');
    setNewRoomType('living_room');
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (window.confirm('Are you sure you want to delete this room?')) {
      setRooms(rooms.filter(r => r.id !== roomId));
      if (selectedRoom?.id === roomId) {
        setSelectedRoom(null);
      }
    }
  };

  const getRoomIcon = (type: string) => {
    const icons = {
      living_room: '🛋️',
      bedroom: '🛏️',
      kitchen: '🍳',
      bathroom: '🚿',
      office: '💼',
      garage: '🚗',
      garden: '🌳'
    };
    return icons[type] || '🏠';
  };

  return (
    <div className="room-manager">
      <div className="room-header">
        <h2>Room Manager</h2>
        <button className="add-room-btn" onClick={() => setShowAddModal(true)}>
          + Add Room
        </button>
      </div>

      <div className="rooms-grid">
        {rooms.map((room) => (
          <div
            key={room.id}
            className={`room-card ${selectedRoom?.id === room.id ? 'selected' : ''}`}
            onClick={() => setSelectedRoom(room)}
          >
            <div className="room-icon">{getRoomIcon(room.type)}</div>
            <div className="room-info">
              <h3>{room.name}</h3>
              <p className="room-type">{room.type.replace('_', ' ')}</p>
              <div className="room-stats">
                <span className="device-count">{room.devices.length} devices</span>
                {room.temperature && (
                  <span className="temperature">{room.temperature}°C</span>
                )}
                {room.occupancy && <span className="occupancy-badge">Occupied</span>}
              </div>
            </div>
            <button
              className="delete-room-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteRoom(room.id);
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      {selectedRoom && (
        <div className="room-details">
          <h3>{selectedRoom.name} Details</h3>
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">Type:</span>
              <span className="detail-value">{selectedRoom.type.replace('_', ' ')}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Devices:</span>
              <span className="detail-value">{selectedRoom.devices.length}</span>
            </div>
            {selectedRoom.temperature && (
              <div className="detail-item">
                <span className="detail-label">Temperature:</span>
                <span className="detail-value">{selectedRoom.temperature}°C</span>
              </div>
            )}
            {selectedRoom.humidity && (
              <div className="detail-item">
                <span className="detail-label">Humidity:</span>
                <span className="detail-value">{selectedRoom.humidity}%</span>
              </div>
            )}
            <div className="detail-item">
              <span className="detail-label">Occupancy:</span>
              <span className="detail-value">
                {selectedRoom.occupancy ? 'Occupied' : 'Empty'}
              </span>
            </div>
          </div>
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Add New Room</h3>
            <div className="form-group">
              <label>Room Name</label>
              <input
                type="text"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                placeholder="Enter room name"
              />
            </div>
            <div className="form-group">
              <label>Room Type</label>
              <select value={newRoomType} onChange={(e) => setNewRoomType(e.target.value)}>
                <option value="living_room">Living Room</option>
                <option value="bedroom">Bedroom</option>
                <option value="kitchen">Kitchen</option>
                <option value="bathroom">Bathroom</option>
                <option value="office">Office</option>
                <option value="garage">Garage</option>
                <option value="garden">Garden</option>
              </select>
            </div>
            <div className="modal-actions">
              <button onClick={() => setShowAddModal(false)}>Cancel</button>
              <button onClick={handleAddRoom} disabled={!newRoomName}>
                Add Room
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
