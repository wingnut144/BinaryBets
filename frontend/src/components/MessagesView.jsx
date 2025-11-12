import { useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'https://api.binary-bets.com';

function MessagesView({ token, user, loadUnreadCount }) {
  const [messages, setMessages] = useState([]);
  const [tab, setTab] = useState('inbox');
  const [showCompose, setShowCompose] = useState(false);
  const [admins, setAdmins] = useState([]);
  const [composeForm, setComposeForm] = useState({
    to_user_id: '',
    subject: '',
    message: ''
  });

  useEffect(() => {
    loadMessages();
    loadAdmins();
  }, [tab]);

  const loadMessages = async () => {
    try {
      const response = await fetch(`${API_URL}/api/messages?type=${tab}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMessages(data);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  };

  const loadAdmins = async () => {
    try {
      const response = await fetch(`${API_URL}/api/admins`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setAdmins(data);
      }
    } catch (error) {
      console.error('Error loading admins:', error);
    }
  };

  const markAsRead = async (messageId) => {
    try {
      await fetch(`${API_URL}/api/messages/${messageId}/read`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });
      loadMessages();
      loadUnreadCount();
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${API_URL}/api/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(composeForm)
      });

      if (response.ok) {
        alert('Message sent successfully!');
        setShowCompose(false);
        setComposeForm({ to_user_id: '', subject: '', message: '' });
        loadMessages();
      } else {
        const error = await response.json();
        alert(error.error || 'Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message');
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold text-gray-800">Messages</h2>
        <button
          onClick={() => setShowCompose(true)}
          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
        >
          ✉️ New Message
        </button>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setTab('inbox')}
          className={`px-6 py-2 rounded-lg font-medium transition-all ${
            tab === 'inbox'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Inbox
        </button>
        <button
          onClick={() => setTab('sent')}
          className={`px-6 py-2 rounded-lg font-medium transition-all ${
            tab === 'sent'
              ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Sent
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-lg">
        {messages.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">📭</div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">No Messages</h3>
            <p className="text-gray-600">Your {tab} is empty</p>
          </div>
        ) : (
          <div className="divide-y">
            {messages.map(message => (
              <div
                key={message.id}
                className={`p-4 hover:bg-gray-50 cursor-pointer ${
                  !message.is_read && tab === 'inbox' ? 'bg-blue-50' : ''
                }`}
                onClick={() => {
                  if (tab === 'inbox' && !message.is_read) {
                    markAsRead(message.id);
                  }
                }}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800">
                        {tab === 'inbox' ? `From: ${message.from_username}` : `To: ${message.to_username}`}
                      </span>
                      {!message.is_read && tab === 'inbox' && (
                        <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">New</span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-gray-700 mt-1">{message.subject}</p>
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(message.created_at).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2 whitespace-pre-wrap">{message.message}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {showCompose && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">New Message</h2>
              <button onClick={() => setShowCompose(false)} className="text-gray-500 hover:text-gray-700">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={sendMessage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">To (Admin)</label>
                <select
                  required
                  value={composeForm.to_user_id}
                  onChange={(e) => setComposeForm({...composeForm, to_user_id: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
                >
                  <option value="">Select admin...</option>
                  {admins.map(admin => (
                    <option key={admin.id} value={admin.id}>{admin.username}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subject</label>
                <input
                  type="text"
                  required
                  value={composeForm.subject}
                  onChange={(e) => setComposeForm({...composeForm, subject: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Message</label>
                <textarea
                  required
                  value={composeForm.message}
                  onChange={(e) => setComposeForm({...composeForm, message: e.target.value})}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-600"
                  rows="6"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
              >
                Send Message
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default MessagesView;
