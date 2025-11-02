import React, { useState } from 'react';
import './Settings.css';

interface SettingsProps {
  onClose: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onClose }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [settings, setSettings] = useState({
    theme: 'light',
    language: 'en',
    notifications: {
      push: true,
      email: true,
      sms: false,
    },
    privacy: {
      shareData: false,
      analytics: true,
    },
  });

  const handleSave = () => {
    console.log('Saving settings:', settings);
    onClose();
  };

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h2>Settings</h2>
        <button onClick={onClose}>&times;</button>
      </div>

      <div className="settings-content">
        <div className="settings-tabs">
          <button
            className={activeTab === 'general' ? 'active' : ''}
            onClick={() => setActiveTab('general')}
          >
            General
          </button>
          <button
            className={activeTab === 'notifications' ? 'active' : ''}
            onClick={() => setActiveTab('notifications')}
          >
            Notifications
          </button>
          <button
            className={activeTab === 'privacy' ? 'active' : ''}
            onClick={() => setActiveTab('privacy')}
          >
            Privacy
          </button>
        </div>

        <div className="settings-panel">
          {activeTab === 'general' && (
            <div>
              <div className="setting-item">
                <label>Theme</label>
                <select
                  value={settings.theme}
                  onChange={(e) =>
                    setSettings({ ...settings, theme: e.target.value })
                  }
                >
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                  <option value="auto">Auto</option>
                </select>
              </div>

              <div className="setting-item">
                <label>Language</label>
                <select
                  value={settings.language}
                  onChange={(e) =>
                    setSettings({ ...settings, language: e.target.value })
                  }
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                </select>
              </div>
            </div>
          )}

          {activeTab === 'notifications' && (
            <div>
              <div className="setting-item">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.notifications.push}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          push: e.target.checked,
                        },
                      })
                    }
                  />
                  Push Notifications
                </label>
              </div>

              <div className="setting-item">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.notifications.email}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          email: e.target.checked,
                        },
                      })
                    }
                  />
                  Email Notifications
                </label>
              </div>

              <div className="setting-item">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.notifications.sms}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        notifications: {
                          ...settings.notifications,
                          sms: e.target.checked,
                        },
                      })
                    }
                  />
                  SMS Notifications
                </label>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div>
              <div className="setting-item">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.privacy.shareData}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        privacy: {
                          ...settings.privacy,
                          shareData: e.target.checked,
                        },
                      })
                    }
                  />
                  Share Usage Data
                </label>
              </div>

              <div className="setting-item">
                <label>
                  <input
                    type="checkbox"
                    checked={settings.privacy.analytics}
                    onChange={(e) =>
                      setSettings({
                        ...settings,
                        privacy: {
                          ...settings.privacy,
                          analytics: e.target.checked,
                        },
                      })
                    }
                  />
                  Enable Analytics
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="settings-footer">
        <button onClick={onClose}>Cancel</button>
        <button onClick={handleSave} className="primary">
          Save Changes
        </button>
      </div>
    </div>
  );
};
