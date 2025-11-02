import React, { useState, useEffect } from 'react';
import './WidgetCustomizer.css';

interface Widget {
  id: string;
  type: string;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  config: any;
}

interface WidgetCustomizerProps {
  widgets: Widget[];
  onSave: (widgets: Widget[]) => void;
  onClose: () => void;
}

export const WidgetCustomizer: React.FC<WidgetCustomizerProps> = ({ widgets, onSave, onClose }) => {
  const [editableWidgets, setEditableWidgets] = useState<Widget[]>(widgets);
  const [selectedWidget, setSelectedWidget] = useState<string | null>(null);
  const [draggedWidget, setDraggedWidget] = useState<string | null>(null);

  const widgetTypes = [
    { type: 'energy', label: 'Energy Monitor', icon: '⚡' },
    { type: 'devices', label: 'Device Status', icon: '🔌' },
    { type: 'weather', label: 'Weather', icon: '🌤️' },
    { type: 'automation', label: 'Automations', icon: '🤖' },
    { type: 'security', label: 'Security', icon: '🔒' },
    { type: 'chart', label: 'Analytics Chart', icon: '📊' },
  ];

  const handleAddWidget = (type: string) => {
    const newWidget: Widget = {
      id: `widget_${Date.now()}`,
      type,
      title: widgetTypes.find(w => w.type === type)?.label || type,
      position: { x: 0, y: 0 },
      size: { width: 2, height: 2 },
      config: {},
    };

    setEditableWidgets([...editableWidgets, newWidget]);
  };

  const handleRemoveWidget = (widgetId: string) => {
    setEditableWidgets(editableWidgets.filter(w => w.id !== widgetId));
    if (selectedWidget === widgetId) {
      setSelectedWidget(null);
    }
  };

  const handleWidgetUpdate = (widgetId: string, updates: Partial<Widget>) => {
    setEditableWidgets(editableWidgets.map(w =>
      w.id === widgetId ? { ...w, ...updates } : w
    ));
  };

  const handleDragStart = (widgetId: string) => {
    setDraggedWidget(widgetId);
  };

  const handleDragEnd = () => {
    setDraggedWidget(null);
  };

  const handleSave = () => {
    onSave(editableWidgets);
    onClose();
  };

  return (
    <div className="widget-customizer">
      <div className="widget-customizer__header">
        <h2 className="widget-customizer__title">Customize Dashboard</h2>
        <button className="widget-customizer__close" onClick={onClose}>×</button>
      </div>

      <div className="widget-customizer__content">
        <div className="widget-customizer__sidebar">
          <h3 className="widget-customizer__sidebar-title">Available Widgets</h3>
          <div className="widget-customizer__widget-list">
            {widgetTypes.map(widget => (
              <div
                key={widget.type}
                className="widget-customizer__widget-item"
                onClick={() => handleAddWidget(widget.type)}
              >
                <span className="widget-customizer__widget-icon">{widget.icon}</span>
                <span className="widget-customizer__widget-label">{widget.label}</span>
              </div>
            ))}
          </div>

          {selectedWidget && (
            <div className="widget-customizer__properties">
              <h3 className="widget-customizer__sidebar-title">Widget Properties</h3>
              {editableWidgets.find(w => w.id === selectedWidget) && (
                <div className="widget-customizer__property-form">
                  <div className="widget-customizer__property-group">
                    <label>Title</label>
                    <input
                      type="text"
                      value={editableWidgets.find(w => w.id === selectedWidget)?.title || ''}
                      onChange={(e) => handleWidgetUpdate(selectedWidget, { title: e.target.value })}
                    />
                  </div>
                  <div className="widget-customizer__property-group">
                    <label>Width</label>
                    <input
                      type="number"
                      min="1"
                      max="4"
                      value={editableWidgets.find(w => w.id === selectedWidget)?.size.width || 2}
                      onChange={(e) => {
                        const widget = editableWidgets.find(w => w.id === selectedWidget);
                        if (widget) {
                          handleWidgetUpdate(selectedWidget, {
                            size: { ...widget.size, width: parseInt(e.target.value) }
                          });
                        }
                      }}
                    />
                  </div>
                  <div className="widget-customizer__property-group">
                    <label>Height</label>
                    <input
                      type="number"
                      min="1"
                      max="4"
                      value={editableWidgets.find(w => w.id === selectedWidget)?.size.height || 2}
                      onChange={(e) => {
                        const widget = editableWidgets.find(w => w.id === selectedWidget);
                        if (widget) {
                          handleWidgetUpdate(selectedWidget, {
                            size: { ...widget.size, height: parseInt(e.target.value) }
                          });
                        }
                      }}
                    />
                  </div>
                  <button
                    className="widget-customizer__remove-button"
                    onClick={() => handleRemoveWidget(selectedWidget)}
                  >
                    Remove Widget
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="widget-customizer__canvas">
          <div className="widget-customizer__grid">
            {editableWidgets.map(widget => (
              <div
                key={widget.id}
                className={`widget-customizer__widget ${selectedWidget === widget.id ? 'widget-customizer__widget--selected' : ''}`}
                style={{
                  gridColumn: `span ${widget.size.width}`,
                  gridRow: `span ${widget.size.height}`,
                }}
                onClick={() => setSelectedWidget(widget.id)}
                draggable
                onDragStart={() => handleDragStart(widget.id)}
                onDragEnd={handleDragEnd}
              >
                <div className="widget-customizer__widget-header">
                  <span className="widget-customizer__widget-title">{widget.title}</span>
                  <span className="widget-customizer__widget-type">{widget.type}</span>
                </div>
                <div className="widget-customizer__widget-preview">
                  {widgetTypes.find(w => w.type === widget.type)?.icon}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="widget-customizer__footer">
        <button className="widget-customizer__button widget-customizer__button--secondary" onClick={onClose}>
          Cancel
        </button>
        <button className="widget-customizer__button widget-customizer__button--primary" onClick={handleSave}>
          Save Layout
        </button>
      </div>
    </div>
  );
};
