import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState(null); // null, 'success', 'error'
  const [message, setMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const tokenParam = searchParams.get('token');
    if (!tokenParam) {
      setStatus('error');
      setMessage('Invalid reset link');
    } else {
      setToken(tokenParam);
    }
  }, [searchParams]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatus(null);

    // Validate passwords match
    if (newPassword !== confirmPassword) {
      setStatus('error');
      setMessage('Passwords do not match');
      setLoading(false);
      return;
    }

    // Validate password length
    if (newPassword.length < 6) {
      setStatus('error');
      setMessage('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'https://api.binary-bets.com'}/api/auth/reset-password`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, newPassword, confirmPassword }),
        }
      );

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        setMessage(data.message);
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(data.error || 'Failed to reset password');
      }
    } catch (error) {
      console.error('Reset password error:', error);
      setStatus('error');
      setMessage('Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '20px',
          padding: '50px',
          maxWidth: '500px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <div style={{ fontSize: '64px', marginBottom: '20px' }}>❌</div>
          <h2 style={{ color: '#dc3545', marginBottom: '10px' }}>Invalid Reset Link</h2>
          <p style={{ color: '#666', marginBottom: '30px' }}>
            This password reset link is invalid or has expired.
          </p>
          <button
            onClick={() => navigate('/forgot-password')}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              padding: '15px 40px',
              borderRadius: '50px',
              fontSize: '16px',
              fontWeight: 'bold',
              cursor: 'pointer',
              boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
            }}
          >
            Request New Link
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '20px',
        padding: '50px',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <div style={{ fontSize: '64px', marginBottom: '10px' }}>🔑</div>
          <h2 style={{ color: '#333', margin: '0 0 10px 0' }}>Reset Your Password</h2>
          <p style={{ color: '#666', margin: 0 }}>
            Choose a strong new password for your account.
          </p>
        </div>

        {status === 'success' ? (
          <div style={{
            background: '#d4edda',
            border: '1px solid #c3e6cb',
            borderRadius: '10px',
            padding: '20px',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '10px' }}>✅</div>
            <p style={{ color: '#155724', margin: 0, marginBottom: '10px' }}>
              {message}
            </p>
            <p style={{ color: '#666', fontSize: '14px', margin: 0 }}>
              Redirecting to login page...
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#333',
                fontWeight: '600'
              }}>
                New Password
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                  required
                  style={{
                    width: '100%',
                    padding: '15px',
                    paddingRight: '50px',
                    border: '2px solid #e0e0e0',
                    borderRadius: '10px',
                    fontSize: '16px',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.3s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = '#667eea'}
                  onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '15px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '20px'
                  }}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                color: '#333',
                fontWeight: '600'
              }}>
                Confirm Password
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                style={{
                  width: '100%',
                  padding: '15px',
                  border: '2px solid #e0e0e0',
                  borderRadius: '10px',
                  fontSize: '16px',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.3s'
                }}
                onFocus={(e) => e.target.style.borderColor = '#667eea'}
                onBlur={(e) => e.target.style.borderColor = '#e0e0e0'}
              />
            </div>

            {status === 'error' && (
              <div style={{
                background: '#f8d7da',
                border: '1px solid #f5c6cb',
                borderRadius: '10px',
                padding: '15px',
                marginBottom: '20px',
                color: '#721c24'
              }}>
                {message}
              </div>
            )}

            <div style={{
              background: '#f8f9ff',
              padding: '15px',
              borderRadius: '10px',
              marginBottom: '20px',
              fontSize: '14px',
              color: '#666'
            }}>
              <strong>Password Requirements:</strong>
              <ul style={{ margin: '10px 0', paddingLeft: '20px' }}>
                <li>At least 6 characters long</li>
                <li>Mix of letters and numbers recommended</li>
                <li>Avoid common passwords</li>
              </ul>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                background: loading ? '#ccc' : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                border: 'none',
                padding: '18px',
                borderRadius: '50px',
                fontSize: '18px',
                fontWeight: 'bold',
                cursor: loading ? 'not-allowed' : 'pointer',
                marginBottom: '15px',
                boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => !loading && (e.target.style.transform = 'translateY(-2px)')}
              onMouseLeave={(e) => e.target.style.transform = 'translateY(0)'}
            >
              {loading ? '🔄 Resetting...' : '🔐 Reset Password'}
            </button>
          </form>
        )}

        <div style={{
          textAlign: 'center',
          marginTop: '20px',
          paddingTop: '20px',
          borderTop: '1px solid #e0e0e0'
        }}>
          <button
            onClick={() => navigate('/')}
            style={{
              background: 'none',
              border: 'none',
              color: '#667eea',
              fontSize: '16px',
              cursor: 'pointer',
              textDecoration: 'underline'
            }}
          >
            ← Back to Login
          </button>
        </div>
      </div>
    </div>
  );
}

export default ResetPassword;
