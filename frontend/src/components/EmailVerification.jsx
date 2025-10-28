import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';

function EmailVerification() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('verifying'); // verifying, success, error, already-verified
  const [message, setMessage] = useState('Verifying your email...');
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setMessage('Invalid verification link');
      return;
    }

    verifyEmail();
  }, [token]);

  const verifyEmail = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'https://api.binary-bets.com'}/api/auth/verify-email?token=${token}`
      );
      
      const data = await response.json();

      if (response.ok) {
        if (data.alreadyVerified) {
          setStatus('already-verified');
          setMessage('Your email is already verified!');
        } else {
          setStatus('success');
          setMessage('Email verified successfully! You can now log in.');
        }
        
        // Redirect to login after 3 seconds
        setTimeout(() => {
          navigate('/');
        }, 3000);
      } else {
        setStatus('error');
        setMessage(data.error || 'Verification failed');
      }
    } catch (error) {
      console.error('Verification error:', error);
      setStatus('error');
      setMessage('Failed to verify email. Please try again.');
    }
  };

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
        {status === 'verifying' && (
          <>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>
              ⏳
            </div>
            <h2 style={{ color: '#333', marginBottom: '10px' }}>Verifying Email</h2>
            <p style={{ color: '#666' }}>{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>
              ✅
            </div>
            <h2 style={{ color: '#28a745', marginBottom: '10px' }}>Email Verified!</h2>
            <p style={{ color: '#666', marginBottom: '20px' }}>{message}</p>
            <p style={{ color: '#999', fontSize: '14px' }}>
              Redirecting to login page...
            </p>
          </>
        )}

        {status === 'already-verified' && (
          <>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>
              ✓
            </div>
            <h2 style={{ color: '#667eea', marginBottom: '10px' }}>Already Verified</h2>
            <p style={{ color: '#666', marginBottom: '20px' }}>{message}</p>
            <p style={{ color: '#999', fontSize: '14px' }}>
              Redirecting to login page...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <div style={{ fontSize: '64px', marginBottom: '20px' }}>
              ❌
            </div>
            <h2 style={{ color: '#dc3545', marginBottom: '10px' }}>Verification Failed</h2>
            <p style={{ color: '#666', marginBottom: '30px' }}>{message}</p>
            <button
              onClick={() => navigate('/')}
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
              Back to Login
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default EmailVerification;
