import React, { useState } from 'react';
import { Card } from '../components/shared/Cards';
import { showToast } from '../utils/toast';

type StoredUser = {
  name?: string;
  username?: string;
  email?: string;
  phone?: string;
  designation?: string;
  organization?: string;
};

const inputClass =
  'mt-1 w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none';

const getStoredUser = (): StoredUser => {
  const raw = localStorage.getItem('user');
  if (!raw) return {};

  try {
    return JSON.parse(raw) as StoredUser;
  } catch {
    return {};
  }
};

export const Profile: React.FC = () => {
  const [user, setUser] = useState<StoredUser>(getStoredUser);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState('');
  const name = user.name || user.username || 'User';

  const saveProfile = () => {
    localStorage.setItem('user', JSON.stringify(user));
    window.dispatchEvent(new Event('user-updated'));
    setMessage('Profile updated.');
    setIsEditing(false);
    showToast({
      type: 'success',
      title: 'Profile updated',
      message: 'Your profile changes were saved.',
    });
  };

  const cancelEdit = () => {
    setUser(getStoredUser());
    setIsEditing(false);
    setMessage('');
    showToast({
      type: 'info',
      title: 'Edit cancelled',
      message: 'Profile changes were discarded.',
    });
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('user-updated'));
    showToast({
      type: 'success',
      title: 'Logged out',
      message: 'Returning to login page.',
    });
    window.location.href = '/auth';
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Card title="My Profile">
        <div className="flex flex-col gap-6 md:flex-row">
          <div className="sample-gradient flex h-28 w-28 shrink-0 items-center justify-center rounded-full text-4xl font-bold text-white">
            {name.charAt(0).toUpperCase()}
          </div>

          <div className="grid flex-1 gap-4 md:grid-cols-2">
            <label className="text-sm text-gray-300">
              Full Name
              {isEditing ? (
                <input className={inputClass} value={user.name || ''} onChange={(e) => setUser({ ...user, name: e.target.value })} />
              ) : (
                <p className="mt-1 font-semibold text-white">{user.name || '-'}</p>
              )}
            </label>
            <label className="text-sm text-gray-300">
              Username
              {isEditing ? (
                <input className={inputClass} value={user.username || ''} onChange={(e) => setUser({ ...user, username: e.target.value })} />
              ) : (
                <p className="mt-1 font-semibold text-white">{user.username || '-'}</p>
              )}
            </label>
            <label className="text-sm text-gray-300">
              Email
              {isEditing ? (
                <input className={inputClass} value={user.email || ''} onChange={(e) => setUser({ ...user, email: e.target.value })} />
              ) : (
                <p className="mt-1 font-semibold text-white">{user.email || '-'}</p>
              )}
            </label>
            <label className="text-sm text-gray-300">
              Phone Number
              {isEditing ? (
                <input className={inputClass} value={user.phone || ''} onChange={(e) => setUser({ ...user, phone: e.target.value })} />
              ) : (
                <p className="mt-1 font-semibold text-white">{user.phone || '-'}</p>
              )}
            </label>
            <label className="text-sm text-gray-300">
              Designation
              {isEditing ? (
                <input className={inputClass} value={user.designation || ''} onChange={(e) => setUser({ ...user, designation: e.target.value })} />
              ) : (
                <p className="mt-1 font-semibold text-white">{user.designation || '-'}</p>
              )}
            </label>
            <label className="text-sm text-gray-300">
              Organization
              {isEditing ? (
                <input className={inputClass} value={user.organization || ''} onChange={(e) => setUser({ ...user, organization: e.target.value })} />
              ) : (
                <p className="mt-1 font-semibold text-white">{user.organization || '-'}</p>
              )}
            </label>
          </div>
        </div>

        {message && (
          <div className="mt-5 rounded-lg border border-green-700 bg-green-900/20 p-3 text-sm text-green-200">
            {message}
          </div>
        )}

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          {isEditing ? (
            <>
              <button className="rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800" onClick={cancelEdit}>
                Cancel
              </button>
              <button className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700" onClick={saveProfile}>
                Save Profile
              </button>
            </>
          ) : (
            <button
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              onClick={() => {
                setIsEditing(true);
                showToast({
                  type: 'info',
                  title: 'Edit profile',
                  message: 'Profile fields are now editable.',
                });
              }}
            >
              Edit
            </button>
          )}
          <button className="rounded-lg border border-red-700 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-900/30" onClick={logout}>
            Logout
          </button>
        </div>
      </Card>

    </div>
  );
};
