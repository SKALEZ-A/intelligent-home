import React, { useState } from 'react';
import { User, UserPreferences } from '../../types/user';
import './UserSettings.css';

interface UserSettingsProps {
  user: User;
  onUpdatePreferences: (preferences: Partial<UserPreferences>) => Promise<void>;
  onUpdateProfile: (profile: Partial<User>) => Promise<void>;
}

export const UserSettings: React.FC<UserSettingsProps> = ({
  user,
  onUpdatePreferences,
  onUpdateProfile
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'preferences' | 'security'>('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handlePreferenceChange = async (key: keyof UserPreferences, value: any) => {
    setLoading(true);
    try {
      await onUpdatePreferences({ [key]: value });
      setMessage({ type: 'success', text: 'Preferences updated successfully' });
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to update preferences' });
    } finally {
      setLoading(false);
      setTimeout(() => setMessage(null), 3000);
    }
  };

  return (
    <div className="user-settings">
      <div className="user-settings__header">
        <h2 className="user-settings__title">Settings</h2>
      </div>

      <div className="user-settings__tabs">
        <button
          className={`user-settings__tab ${activeTab === 'profile' ? 'user-settings__tab--active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          Profile
        </button>
        <button
          className={`user-settings__tab ${activeTab === 'preferences' ? 'user-settings__tab--active' : ''}`}
          onClick={() => setActiveTab('preferences')}
        >
          Preferences
        </button>
        <button
          className={`user-settings__tab ${activeTab === 'security' ? 'user-settings__tab--active' : ''}`}
          onClick={() => setActiveTab('security')}
        >
          Security
        </button>
      </div>

      {message && (
        <div className={`user-settings__message user-settings__message--${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="user-settings__content">
        {activeTab === 'profile' && (
          <div className="user-settings__section">
            <h3 className="user-settings__section-title">Profile Information</h3>
            <div className="user-settings__field">
              <label className="user-settings__label">Email</label>
              <input
                type="email"
                className="user-settings__input"
                value={user.email}
                disabled
              />
            </div>
            <div className="user-settings__field">
              <label className="user-settings__label">Username</label>
              <input
                type="text"
                className="user-settings__input"
                value={user.username}
                disabled
              />
            </div>
            <div className="user-settings__field">
              <label className="user-settings__label">First Name</label>
              <input
                type="text"
                className="user-settings__input"
                value={user.firstName}
                onChange={(e) => onUpdateProfile({ firstName: e.target.value })}
              />
            </div>
            <div className="user-settings__field">
              <label className="user-settings__label">Last Name</label>
              <input
                type="text"
                className="user-settings__input"
                value={user.lastName}
                onChange={(e) => onUpdateProfile({ lastName: e.target.value })}
              />
            </div>
          </div>
        )}

        {activeTab === 'preferences' && (
          <div className="user-settings__section">
            <h3 className="user-settings__section-title">Display Preferences</h3>
            <div className="user-settings__field">
              <label className="user-settings__label">Theme</label>
              <select
                className="user-settings__select"
                value={user.preferences.theme}
                onChange={(e) => handlePreferenceChange('theme', e.target.value)}
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto</option>
              </select>
            </div>
            <div className="user-settings__field">
              <label className="user-settings__label">Temperature Unit</label>
              <select
                className="user-settings__select"
                value={user.preferences.temperatureUnit}
                onChange={(e) => handlePreferenceChange('temperatureUnit', e.target.value)}
              >
                <option value="celsius">Celsius</option>
                <option value="fahrenheit">Fahrenheit</option>
              </select>
            </div>
            <div className="user-settings__field">
              <label className="user-settings__label">Time Format</label>
              <select
                className="user-settings__select"
                value={user.preferences.timeFormat}
                onChange={(e) => handlePreferenceChange('timeFormat', e.target.value)}
              >
                <option value="12h">12 Hour</option>
                <option value="24h">24 Hour</option>
              </select>
            </div>
          </div>
        )}

        {activeTab === 'security' && (
          <div className="user-settings__section">
            <h3 className="user-settings__section-title">Security Settings</h3>
            <div className="user-settings__field">
              <label className="user-settings__label">Two-Factor Authentication</label>
              <div className="user-settings__toggle">
                <input
                  type="checkbox"
                  checked={user.twoFactorEnabled}
                  onChange={(e) => onUpdateProfile({ twoFactorEnabled: e.target.checked })}
                />
                <span>{user.twoFactorEnabled ? 'Enabled' : 'Disabled'}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
