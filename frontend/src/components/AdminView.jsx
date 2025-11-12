import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.binary-bets.com';

function AdminView({ token, loadAnnouncements }) {
  const [tab, setTab] = useState('reports');
  const [reports, setReports] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [announcementForm, setAnnouncementForm] = useState({
    title: '',
    message: '',
    expires_at: ''
  });

  useEffect(() => {
    if (tab === 'reports') {
      loadReports();
    } else if (tab === 'announcements') {
      loadAllAnnouncements();
    }
  }, [tab]);

  const loadReports = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/reports`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setReports(data);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    }
  };

  const loadAllAnnouncements = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admin/announcements`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAnnouncements(data);
      }
    } catch (error) {
      console.error('Error loading announcements:', error);
    }
  };

  const reviewReport = async (reportId, action, notes) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/reports/${reportId}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ action, admin_notes: notes })
      });

      if (response.ok) {
        alert(`Report ${action === 'approve' ? 'approved' : 'dismissed'} successfully!`);
        loadReports();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to review report');
      }
    } catch (error) {
      console.error('Error reviewing report:', error);
      alert('Failed to review report');
    }
  };

  const createAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/admin/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(announcementForm)
      });

      if (response.ok) {
        alert('Announcement created successfully!');
        setAnnouncementForm({ title: '', message: '', expires_at: '' });
        loadAllAnnouncements();
        loadAnnouncements();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to create announcement');
      }
    } catch (error) {
      console.error('Error creating announcement:', error);
      alert('Failed to create announcement');
    }
  };

  const deleteAnnouncement = async (id) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;

    try {
      const response = await fetch(`${API_URL}/api/admin/announcements/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        alert('Announcement deleted!');
        loadAllAnnouncements();
        loadAnnouncements();
      }
    } catch (error) {
      console.error('Error deleting announcement:', error);
      alert('Failed to delete announcement');
    }
  };

  return (
    <div className="max-w-6xl mx-auto">
      <h2 className="text-3xl font-bold text-gray-800 mb-6">Admin Dashboard</h2>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('reports')}
          className={`px-6 py-2 rounded-lg font-medium transition-all ${
            tab === 'reports'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Reported Bets
        </button>
        <button
          onClick={() => setTab('announcements')}
          className={`px-6 py-2 rounded-lg font-medium transition-all ${
            tab === 'announcements'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Announcements
        </button>
      </div>

      {tab === 'reports' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Pending Reports</h3>
          {reports.filter(r => r.status === 'pending').length === 0 ? (
            <p className="text-gray-600 text-center py-8">No pending reports</p>
          ) : (
            <div className="space-y-4">
              {reports.filter(r => r.status === 'pending').map(report => (
                <div key={report.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-semibold text-gray-800">Report #{report.id}</p>
                      <p className="text-sm text-gray-600">Bet ID: #{report.bet_id}</p>
                      <p className="text-sm text-gray-600">Market: {report.market_question}</p>
                      <p className="text-sm text-gray-600">Option: {report.option_name}</p>
                    </div>
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-semibold">
                      Pending
                    </span>
                  </div>
                  
                  <div className="bg-gray-50 rounded p-3 mb-3">
                    <p className="text-sm font-medium text-gray-700 mb-1">Reason:</p>
                    <p className="text-sm text-gray-600">{report.reason}</p>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const notes = prompt('Admin notes (optional):');
                        reviewReport(report.id, 'approve', notes);
                      }}
                      className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all"
                    >
                      Delete Bet
                    </button>
                    <button
                      onClick={() => {
                        const notes = prompt('Admin notes (optional):');
                        reviewReport(report.id, 'dismiss', notes);
                      }}
                      className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all"
                    >
                      Dismiss Report
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'announcements' && (
        <div>
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Create Announcement</h3>
            <form onSubmit={createAnnouncement} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  required
                  value={announcementForm.title}
                  onChange={(e) => setAnnouncementForm({...announcementForm, title: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                <textarea
                  required
                  value={announcementForm.message}
                  onChange={(e) => setAnnouncementForm({...announcementForm, message: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
                  rows="4"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Expiration Date (optional)
                </label>
                <input
                  type="datetime-local"
                  value={announcementForm.expires_at}
                  onChange={(e) => setAnnouncementForm({...announcementForm, expires_at: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
              >
                Create Announcement
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">All Announcements</h3>
            {announcements.length === 0 ? (
              <p className="text-gray-600 text-center py-8">No announcements</p>
            ) : (
              <div className="space-y-4">
                {announcements.map(announcement => (
                  <div key={announcement.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-800">{announcement.title}</h4>
                        <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{announcement.message}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          Created: {new Date(announcement.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                          announcement.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {announcement.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <button
                          onClick={() => deleteAnnouncement(announcement.id)}
                          className="text-red-600 hover:text-red-800"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default AdminView;
