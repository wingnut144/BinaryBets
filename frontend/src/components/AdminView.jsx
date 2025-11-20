import { useState, useEffect } from 'react';

const API_URL = 'https://api.binary-bets.com';

function AdminView({ token, loadAnnouncements }) {
  const [activeTab, setActiveTab] = useState('announcements');
  const [announcements, setAnnouncements] = useState([]);
  const [reports, setReports] = useState([]);
  const [resolverLogs, setResolverLogs] = useState([]);
  const [categories, setCategories] = useState([]);
  const [newCategory, setNewCategory] = useState({ name: '', icon: '', parent_id: null });
  const [loading, setLoading] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: '',
    content: ''
  });

  useEffect(() => {
    if (activeTab === 'announcements') {
      loadAdminAnnouncements();
    } else if (activeTab === 'reports') {
      loadReports();
    } else if (activeTab === 'resolver') {
      loadResolverLogs();
    }
  }, [activeTab]);

  const loadAdminAnnouncements = async () => {
    try {
      const response = await fetch(`${API_URL}/api/announcements`, {
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

  const loadReports = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/reports?_t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setReports(data);
      }
    } catch (error) {
      console.error('Error loading reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadResolverLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/admin/resolver-logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setResolverLogs(data);
      }
    } catch (error) {
      console.error('Error loading resolver logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/announcements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(newAnnouncement)
      });
      
      if (response.ok) {
        alert('Announcement created successfully!');
        setNewAnnouncement({ title: '', content: '' });
        loadAdminAnnouncements();
        loadAnnouncements();
      } else {
        alert('Failed to create announcement');
      }
    } catch (error) {
      console.error('Error creating announcement:', error);
      alert('Failed to create announcement');
    }
  };

  const handleDeleteAnnouncement = async (id) => {
    if (!confirm('Are you sure you want to delete this announcement?')) return;
    
    try {
      const response = await fetch(`${API_URL}/api/announcements/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.ok) {
        alert('Announcement deleted successfully!');
        loadAdminAnnouncements();
        loadAnnouncements();
      } else {
        alert('Failed to delete announcement');
      }
    } catch (error) {
      console.error('Error deleting announcement:', error);
      alert('Failed to delete announcement');
    }
  };

  const handleUpdateReport = async (reportId, newStatus) => {
    try {
      const response = await fetch(`${API_URL}/api/admin/reports/${reportId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
      
      if (response.ok) {
        alert(`Report marked as ${newStatus}`);
        loadReports();
      } else {
        alert('Failed to update report');
      }
    } catch (error) {
      console.error('Error updating report:', error);
      alert('Failed to update report');
    }
  };

  return (
    <div>
      <h2 className="text-3xl font-bold text-gray-800 mb-6">⚙️ Admin Panel</h2>

      <div className="flex gap-4 mb-6">
        <button
        onClick={() => setActiveTab('categories')}
        className={`px-6 py-3 rounded-lg font-semibold transition-all ${
          activeTab === 'categories'
            ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        📁 Categories
      </button>
      <button
          onClick={() => setActiveTab('announcements')}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${
            activeTab === 'announcements'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          📢 Announcements
        </button>
        
        <button
          onClick={() => setActiveTab('reports')}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${
            activeTab === 'reports'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          🚩 Reports {reports.filter(r => r.status === 'pending').length > 0 && (
            <span className="ml-2 bg-red-500 text-white rounded-full px-2 py-1 text-xs">
              {reports.filter(r => r.status === 'pending').length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('resolver')}
          className={`px-6 py-3 rounded-lg font-semibold transition-all ${
            activeTab === 'resolver'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          🤖 AI Resolver Logs
        </button>
      </div>

      {activeTab === 'announcements' && (
        <div>
          <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Create New Announcement</h3>
            <form onSubmit={handleCreateAnnouncement} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title</label>
                <input
                  type="text"
                  required
                  value={newAnnouncement.title}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
                  placeholder="Enter announcement title"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Content</label>
                <textarea
                  required
                  value={newAnnouncement.content}
                  onChange={(e) => setNewAnnouncement({ ...newAnnouncement, content: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
                  rows="4"
                  placeholder="Enter announcement content"
                />
              </div>
              <button
                type="submit"
                className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
              >
                Create Announcement
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl shadow-lg p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">Existing Announcements</h3>
            {announcements.length === 0 ? (
              <p className="text-gray-600">No announcements yet.</p>
            ) : (
              <div className="space-y-4">
                {announcements.map((announcement) => (
                  <div key={announcement.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-bold text-gray-800">{announcement.title}</h4>
                        <p className="text-gray-600 mt-2">{announcement.content}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(announcement.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={() => handleDeleteAnnouncement(announcement.id)}
                        className="px-4 py-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition-all"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'reports' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Market Reports</h3>
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-600 border-t-transparent"></div>
            </div>
          ) : reports.length === 0 ? (
            <p className="text-gray-600">No reports yet.</p>
          ) : (
            <div className="space-y-4">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className={`border rounded-lg p-4 ${
                    report.status === 'pending'
                      ? 'border-orange-300 bg-orange-50'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800">{report.market_question}</h4>
                      <p className="text-sm text-gray-600 mt-1">Market ID: {report.market_id}</p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        report.status === 'pending'
                          ? 'bg-orange-200 text-orange-800'
                          : report.status === 'resolved'
                          ? 'bg-green-200 text-green-800'
                          : 'bg-gray-200 text-gray-800'
                      }`}
                    >
                      {report.status}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded border border-gray-200 mb-3">
                    <p className="text-sm text-gray-700">
                      <strong>Reason:</strong> {report.reason}
                    </p>
                  </div>
                  <div className="flex items-center justify-between text-xs text-gray-500">
                    <div>
                      <p>Reported by: <strong>{report.reporter}</strong></p>
                      <p>{new Date(report.created_at).toLocaleString()}</p>
                      {report.reviewed_by && (
                        <p className="mt-1">Reviewed by: <strong>{report.reviewed_by}</strong></p>
                      )}
                    </div>
                    {report.status === 'pending' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateReport(report.id, 'resolved')}
                          className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-all text-sm font-medium"
                        >
                          Mark Resolved
                        </button>
                        <button
                          onClick={() => handleUpdateReport(report.id, 'dismissed')}
                          className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all text-sm font-medium"
                        >
                          Dismiss
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'resolver' && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-800 mb-4">🤖 AI Resolver Logs</h3>
          <p className="text-sm text-gray-600 mb-6">
            The AI resolver runs daily at 1:00 AM to evaluate markets and determine if they should be resolved early.
          </p>
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-gray-600 border-t-transparent"></div>
            </div>
          ) : resolverLogs.length === 0 ? (
            <p className="text-gray-600">No resolver logs yet. The resolver will run at 1:00 AM daily.</p>
          ) : (
            <div className="space-y-4">
              {resolverLogs.map((log) => (
                <div
                  key={log.id}
                  className={`border rounded-lg p-4 ${
                    log.decision === 'RESOLVE'
                      ? 'border-green-300 bg-green-50'
                      : 'border-blue-300 bg-blue-50'
                  }`}
                >
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex-1">
                      <h4 className="font-bold text-gray-800">{log.market_question}</h4>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(log.created_at).toLocaleString()} • Evaluated by {log.ai_provider}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        log.decision === 'RESOLVE'
                          ? 'bg-green-200 text-green-800'
                          : 'bg-blue-200 text-blue-800'
                      }`}
                    >
                      {log.decision === 'RESOLVE' ? '✅ RESOLVED' : '⏳ KEPT OPEN'}
                    </span>
                  </div>

                  {log.outcome && (
                    <div className="mb-3">
                      <span className="text-sm font-semibold text-gray-700">Winner: </span>
                      <span className="text-sm font-bold text-green-600">{log.outcome}</span>
                    </div>
                  )}

                  <div className="bg-white p-3 rounded border border-gray-200 mb-3">
                    <p className="text-sm text-gray-700">
                      <strong>AI Reasoning:</strong> {log.reasoning}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-gray-600">
                    <span>Confidence: <strong>{log.confidence}%</strong></span>
                    <span>Market ID: <strong>#{log.market_id}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default AdminView;
