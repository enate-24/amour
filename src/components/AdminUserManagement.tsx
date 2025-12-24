 import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Users, Search, Lock, Ban, CheckCircle, RefreshCw, Eye } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
// Temporarily inline network utilities to fix import issue
const fetchWithRetry = async (url: string, options: RequestInit & { timeout?: number; retries?: number } = {}) => {
  const { timeout = 30000, retries = 2, ...fetchOptions } = options;
  
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response;
      
    } catch (error) {
      const isLastAttempt = attempt === retries;
      
      if (error instanceof Error) {
        console.warn(`Fetch attempt ${attempt + 1} failed:`, error.message);
        
        if (isLastAttempt) {
          throw error;
        }
        
        // Wait before retrying
        if (!isLastAttempt) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } else {
        throw new Error('Unknown network error');
      }
    }
  }
  
  throw new Error('All retry attempts failed');
};

const getNetworkErrorMessage = (error: any): string => {
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return 'Request timeout - the server took too long to respond. Please try again.';
    } else if (error.message.includes('ERR_QUIC_PROTOCOL_ERROR') || error.message.includes('Failed to fetch')) {
      return 'Network connection error. The backend server may be unavailable. Please check your connection and try again.';
    }
    return error.message;
  }
  return 'An unexpected error occurred';
};

const checkServerHealth = async (baseUrl: string): Promise<boolean> => {
  try {
    const response = await fetchWithRetry(`${baseUrl}/health`, {
      method: 'GET',
      timeout: 10000,
      retries: 1
    });
    return response.ok;
  } catch (error) {
    console.warn('Server health check failed:', error);
    return false;
  }
};

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface User {
  id: string;
  username: string;
  email: string;
  shopname?: string;
  role: string;
  balance: number;
  totalGamesPlayed: number;
  totalWinnings: number;
  is_active: boolean;
  createdAt: string;
  updatedAt: string;
  cartelaCount?: number; // Number of assigned cartelas
}

interface UserCartela {
  id: string;
  card_id: string;
  numbers: {
    B: number[];
    I: number[];
    N: (number | string)[];
    G: number[];
    O: number[];
  };
  is_active: boolean;
  is_winner: boolean;
  created_at: string;
}

interface UserCartelaResponse {
  success: boolean;
  user: {
    id: string;
    username: string;
    email: string;
    shopname?: string;
  };
  cartelas: UserCartela[];
  total: number;
  range: {
    start: number;
    end: number;
  } | null;
}

interface CreateUserData {
  username: string;
  email: string;
  password: string;
  shopname: string;
  role: string;
  userType: string;
  balance?: number;
  balanceLimit?: number;
  voiceCategory: 'boy' | 'girl'; // Required field
}

const AdminUserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState<CreateUserData>({
    username: '',
    email: '',
    password: '',
    shopname: '',
    role: 'user',
    userType: 'prepaid',
    voiceCategory: 'girl'
  });
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [backendStatus, setBackendStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [showTroubleshootModal, setShowTroubleshootModal] = useState(false);
  
  // Cartela viewing states
  const [showCartelaModal, setShowCartelaModal] = useState(false);
  const [selectedUserCartelas, setSelectedUserCartelas] = useState<UserCartelaResponse | null>(null);
  const [loadingCartelas, setLoadingCartelas] = useState(false);
  
  // Progress tracking states
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [creationProgress, setCreationProgress] = useState({
    phase: '',
    current: 0,
    total: 0,
    percentage: 0,
    message: ''
  });
  const [progressComplete, setProgressComplete] = useState(false);
  const [progressError, setProgressError] = useState('');

  // Cartela assignment states
  const [showCartelaAssignModal, setShowCartelaAssignModal] = useState(false);
  const [selectedUserForCartelas, setSelectedUserForCartelas] = useState<User | null>(null);
  const [assignmentType, setAssignmentType] = useState<'copy' | 'upload'>('copy');
  const [copyRangeStart, setCopyRangeStart] = useState(1);
  const [copyRangeEnd, setCopyRangeEnd] = useState(50);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadCount, setUploadCount] = useState(50);
  const [assigningCartelas, setAssigningCartelas] = useState(false);

  const { user: currentUser } = useAuth();

  // Check backend connectivity with retry
  const checkBackendStatus = async () => {
    setBackendStatus('checking');
    const isOnline = await checkServerHealth(API_BASE_URL);
    setBackendStatus(isOnline ? 'online' : 'offline');
  };

  // Fetch users
  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(''); // Clear previous errors
      
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetchWithRetry(`${API_BASE_URL}/admin/users`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000,
        retries: 2
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setUsers(data.users || []);
      setBackendStatus('online'); // Update status on successful fetch
      
    } catch (err) {
      console.error('Fetch users error:', err);
      setError(getNetworkErrorMessage(err));
      
      // Update backend status if it's a network error
      if (err && typeof err === 'object' && 'isNetworkError' in err) {
        setBackendStatus('offline');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkBackendStatus();
    fetchUsers();
  }, []);

  // Filter users based on search term
  const filteredUsers = users.filter(user =>
    user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user.shopname && user.shopname.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  // Handle form input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  // Validate form
  const validateForm = (): string[] => {
    const errors: string[] = [];

    if (!formData.username || formData.username.length < 3) {
      errors.push('Username must be at least 3 characters');
    }

    if (!formData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.push('Valid email is required');
    }

    if (!formData.password || formData.password.length < 6) {
      errors.push('Password must be at least 6 characters');
    }

    if (formData.shopname && formData.shopname.length < 2) {
      errors.push('Shop name must be at least 2 characters');
    }

    // Validate balance for prepaid users
    if (formData.userType === 'prepaid' && (formData.balance === undefined || formData.balance < 0)) {
      errors.push('Balance is required for prepaid users and must be non-negative');
    }

    // Validate voice category
    if (!formData.voiceCategory || !['boy', 'girl'].includes(formData.voiceCategory)) {
      errors.push('Voice category must be selected (boy or girl)');
    }

    return errors;
  };

  // Create user with progress tracking
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();

    const errors = validateForm();
    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }

    try {
      setSubmitting(true);
      setFormErrors([]);
      setShowCreateModal(false);
      setShowProgressModal(true);
      setProgressComplete(false);
      setProgressError('');
      setCreationProgress({
        phase: 'starting',
        current: 0,
        total: 0,
        percentage: 0,
        message: 'Initializing user creation...'
      });

      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      // Use fetch with streaming response
      const response = await fetch(`${API_BASE_URL}/admin/users/with-progress`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Response body is not readable');
      }

      let buffer = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        buffer += decoder.decode(value, { stream: true });
        
        // Process complete lines
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6)); // Remove 'data: ' prefix
              
              if (data.type === 'progress') {
                setCreationProgress({
                  phase: data.phase || '',
                  current: data.current || 0,
                  total: data.total || 0,
                  percentage: data.percentage || 0,
                  message: data.message || ''
                });
              } else if (data.type === 'success') {
                setCreationProgress({
                  phase: 'completed',
                  current: data.assignedCartelas?.count || 0,
                  total: data.assignedCartelas?.count || 0,
                  percentage: 100,
                  message: data.message || 'User created successfully!'
                });
                setProgressComplete(true);
                
                // Refresh users list after a short delay
                setTimeout(async () => {
                  await fetchUsers();
                  
                  // Reset form
                  setFormData({
                    username: '',
                    email: '',
                    password: '',
                    shopname: '',
                    role: 'user',
                    userType: 'prepaid',
                    voiceCategory: 'girl'
                  });
                }, 1000);
                
              } else if (data.type === 'error') {
                setProgressError(data.message || 'An error occurred during user creation');
                setProgressComplete(true);
              }
            } catch (parseError) {
              console.error('Error parsing progress data:', parseError);
            }
          }
        }
      }

    } catch (err) {
      console.error('Create user error:', err);
      setProgressError(err instanceof Error ? err.message : 'Failed to create user');
      setProgressComplete(true);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete user with all data
  const handleDeleteUser = async (userId: string, username: string) => {
    const confirmMessage = `⚠️ WARNING: This will permanently delete user "${username}" and ALL associated data including:\n\n• All game history\n• All cartelas\n• All transaction records\n• All admin logs\n\nThis action CANNOT be undone!\n\nType "DELETE" to confirm:`;
    
    const confirmation = prompt(confirmMessage);
    
    if (confirmation !== 'DELETE') {
      if (confirmation !== null) {
        alert('Deletion cancelled. You must type "DELETE" exactly to confirm.');
      }
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      console.log('🔄 Attempting to delete user:', { userId, username });
      console.log('🔗 API URL:', `${API_BASE_URL}/admin/users/${userId}?hardDelete=true`);

      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}?hardDelete=true`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📥 Response status:', response.status);
      console.log('📥 Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete user' }));
        console.error('❌ Delete error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Delete success:', result);
      alert(`✅ ${result.message}\n\nDeleted:\n• ${result.deletedData?.cartelas || 0} cartelas\n• ${result.deletedData?.affectedGames || 0} affected games`);

      // Refresh users list
      await fetchUsers();

    } catch (err) {
      console.error('❌ Delete exception:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete user');
    }
  };

  // Update user password
  const handleUpdatePassword = async () => {
    if (!passwordUserId || !newPassword) {
      setPasswordError('Password is required');
      return;
    }

    if (newPassword.length < 6) {
      setPasswordError('Password must be at least 6 characters');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetch(`${API_BASE_URL}/admin/users/${passwordUserId}/password`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newPassword })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to update password' }));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      alert('✅ Password updated successfully');
      setShowPasswordModal(false);
      setPasswordUserId(null);
      setNewPassword('');
      setPasswordError('');

    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to update password');
    }
  };

  // Ban/Unban user
  const handleToggleBan = async (userId: string, username: string, currentStatus: boolean) => {
    // currentStatus is user.is_active (true = active, false = banned)
    // We want to toggle this: if active, ban them; if banned, unban them
    const action = currentStatus ? 'ban' : 'unban';
    const shouldBan = currentStatus; // if currently active, we want to ban (true)
    
    if (!confirm(`Are you sure you want to ${action} user "${username}"?`)) {
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      console.log(`🔄 Attempting to ${action} user:`, { userId, username, currentStatus, shouldBan });
      console.log('🔗 API URL:', `${API_BASE_URL}/admin/users/${userId}/ban`);
      console.log('📦 Request body:', { banned: shouldBan });

      const response = await fetchWithRetry(`${API_BASE_URL}/admin/users/${userId}/ban`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ banned: shouldBan }),
        timeout: 30000,
        retries: 2
      });

      console.log('📥 Response status:', response.status);
      console.log('📥 Response ok:', response.ok);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `Failed to ${action} user` }));
        console.error('❌ Ban/unban error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Ban/unban success:', result);
      alert(`✅ User ${action}ned successfully`);

      // Refresh users list
      await fetchUsers();

    } catch (err) {
      console.error('❌ Ban/unban exception:', err);
      setError(getNetworkErrorMessage(err));
    }
  };

  // Delete all assigned cartelas from user
  const handleDeleteAllCartelas = async (userId: string, username: string) => {
    const confirmMessage = `⚠️ WARNING: This will permanently delete ALL assigned cartelas from user "${username}".\n\nThis action will:\n• Remove all cartelas from the user's account\n• User will have no cartelas to play with\n• This action CANNOT be undone!\n\nType "DELETE CARTELAS" to confirm:`;
    
    const confirmation = prompt(confirmMessage);
    
    if (confirmation !== 'DELETE CARTELAS') {
      if (confirmation !== null) {
        alert('Deletion cancelled. You must type "DELETE CARTELAS" exactly to confirm.');
      }
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      console.log('🔄 Attempting to delete all cartelas for user:', { userId, username });

      const response = await fetch(`${API_BASE_URL}/admin/users/${userId}/cartelas`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('📥 Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to delete cartelas' }));
        console.error('❌ Delete cartelas error:', errorData);
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Delete cartelas success:', result);
      alert(`✅ ${result.message}`);

      // Refresh users list
      await fetchUsers();

    } catch (err) {
      console.error('Delete cartelas error:', err);
      alert(`❌ Failed to delete cartelas: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Fetch user cartelas
  const fetchUserCartelas = async (userId: string) => {
    try {
      setLoadingCartelas(true);
      
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }

      const response = await fetchWithRetry(`${API_BASE_URL}/admin/users/${userId}/cartelas`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000,
        retries: 2
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data: UserCartelaResponse = await response.json();
      setSelectedUserCartelas(data);
      setShowCartelaModal(true);
      
    } catch (err) {
      console.error('Fetch user cartelas error:', err);
      setError(getNetworkErrorMessage(err));
    } finally {
      setLoadingCartelas(false);
    }
  };

  // Handle username click to show cartelas
  const handleUsernameClick = (userId: string) => {
    fetchUserCartelas(userId);
  };

  // Open cartela assignment modal
  const openCartelaAssignModal = (user: User) => {
    setSelectedUserForCartelas(user);
    setShowCartelaAssignModal(true);
    setAssignmentType('copy');
    setCopyRangeStart(1);
    setCopyRangeEnd(50);
    setUploadFile(null);
    setUploadCount(50);
  };

  // Handle cartela assignment
  const handleAssignCartelas = async () => {
    if (!selectedUserForCartelas) return;

    try {
      setAssigningCartelas(true);
      const token = localStorage.getItem('auth_token');

      if (assignmentType === 'copy') {
        // Copy cartelas from existing range
        const response = await fetch(`${API_BASE_URL}/admin/assign-cartelas-to-user`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: selectedUserForCartelas.id,
            startCardId: copyRangeStart,
            endCardId: copyRangeEnd,
            replaceExisting: true
          })
        });

        if (response.ok) {
          const data = await response.json();
          alert(`✅ Successfully assigned ${data.assignedCartelas.count} cartelas to ${selectedUserForCartelas.username}!`);
          setShowCartelaAssignModal(false);
          await fetchUsers(); // Refresh user list
        } else {
          const errorData = await response.json();
          setError(errorData.error || 'Failed to assign cartelas');
        }
      } else {
        // Upload and process PDF
        if (!uploadFile) {
          setError('Please select a PDF file to upload');
          return;
        }

        // First upload the PDF
        const formData = new FormData();
        formData.append('pdf', uploadFile);

        const uploadResponse = await fetch(`${API_BASE_URL}/admin/upload-pdf`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });

        if (!uploadResponse.ok) {
          const errorData = await uploadResponse.json();
          setError(errorData.error || 'Failed to upload PDF');
          return;
        }

        const uploadData = await uploadResponse.json();
        const filename = uploadData.file.filename;

        // Process the PDF
        const processResponse = await fetch(`${API_BASE_URL}/admin/process-pdf-cartelas`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            filename: filename,
            count: uploadCount,
            startCardId: 2001 // Start from 2001 for PDF cartelas
          })
        });

        if (!processResponse.ok) {
          const errorData = await processResponse.json();
          setError(errorData.error || 'Failed to process PDF');
          return;
        }

        await processResponse.json();

        // Assign the processed cartelas to user
        const assignResponse = await fetch(`${API_BASE_URL}/admin/assign-cartelas-to-user`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            userId: selectedUserForCartelas.id,
            startCardId: 2001,
            endCardId: 2001 + uploadCount - 1,
            replaceExisting: true
          })
        });

        if (assignResponse.ok) {
          const assignData = await assignResponse.json();
          alert(`✅ Successfully processed PDF and assigned ${assignData.assignedCartelas.count} cartelas to ${selectedUserForCartelas.username}!`);
          setShowCartelaAssignModal(false);
          await fetchUsers(); // Refresh user list
        } else {
          const errorData = await assignResponse.json();
          setError(errorData.error || 'Failed to assign processed cartelas');
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to assign cartelas');
    } finally {
      setAssigningCartelas(false);
    }
  };

  // Open password modal
  const openPasswordModal = (userId: string) => {
    setPasswordUserId(userId);
    setNewPassword('');
    setPasswordError('');
    setShowPasswordModal(true);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <div className="text-slate-400">Loading users...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <Users className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-400 flex-shrink-0" />
              <h1 className="text-2xl sm:text-3xl font-bold text-white">User Management</h1>
            </div>
            {/* Backend Status Indicator */}
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${
                backendStatus === 'online' ? 'bg-green-400' :
                backendStatus === 'offline' ? 'bg-red-400' : 'bg-yellow-400'
              }`}></div>
              <span className={`text-xs ${
                backendStatus === 'online' ? 'text-green-400' :
                backendStatus === 'offline' ? 'text-red-400' : 'text-yellow-400'
              }`}>
                {backendStatus === 'online' ? 'Backend Online' :
                 backendStatus === 'offline' ? 'Backend Offline' : 'Checking...'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={() => checkBackendStatus()}
              className="bg-slate-700 hover:bg-slate-600 text-slate-300 px-3 py-2 rounded-lg font-medium flex items-center justify-center transition-colors"
              title="Check backend status"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Create User</span>
              <span className="sm:hidden">Create</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 sm:py-2 bg-slate-800 border border-slate-600 rounded-lg text-white text-sm sm:text-base placeholder-slate-400 focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Backend Status Warning */}
        {backendStatus === 'offline' && (
          <div className="mb-6 p-4 bg-orange-600/20 border border-orange-600 rounded-lg text-orange-400">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-orange-400 rounded-full"></div>
                <span className="font-medium">Backend Server Unavailable</span>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowTroubleshootModal(true)}
                  className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                >
                  Troubleshoot
                </button>
                <button
                  onClick={async () => {
                    await checkBackendStatus();
                    await fetchUsers();
                  }}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1 rounded text-sm font-medium transition-colors"
                >
                  Retry Connection
                </button>
              </div>
            </div>
            <p className="mt-1 text-sm">
              The backend server at {API_BASE_URL} is not responding. This may be due to:
            </p>
            <ul className="mt-2 text-sm list-disc list-inside space-y-1">
              <li>Server maintenance or deployment</li>
              <li>Network connectivity issues</li>
              <li>Server overload (Render free tier limitations)</li>
            </ul>
            <p className="mt-2 text-sm">
              Please wait a moment and try the "Retry Connection" button, or contact support if the issue persists.
            </p>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-600/20 border border-red-600 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* Users Table/Cards */}
        <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
          {filteredUsers.length === 0 ? (
            <div className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-slate-400" />
              <h3 className="mt-2 text-sm font-medium text-slate-400">No users found</h3>
              <p className="mt-1 text-sm text-slate-500">
                {searchTerm ? 'Try adjusting your search criteria.' : 'Get started by creating your first user.'}
              </p>
            </div>
          ) : (
            <>
              {/* Desktop Table View - Hidden on Mobile */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-700">
                    <tr>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                        User
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                        Shop Name
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                        Role
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                        Balance
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                        Cartelas
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider">
                        Created
                      </th>
                      <th className="px-4 lg:px-6 py-3 text-right text-xs font-medium text-slate-300 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700">
                    {filteredUsers.map((user) => (
                      <tr key={user.id} className="hover:bg-slate-700/50">
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          <button
                            onClick={() => handleUsernameClick(user.id)}
                            className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
                            title="Click to view assigned cartelas"
                          >
                            {user.username}
                          </button>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-300">{user.email}</div>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-300">{user.shopname || '-'}</div>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.role === 'admin'
                              ? 'bg-purple-600 text-purple-100'
                              : 'bg-green-600 text-green-100'
                          }`}>
                            {user.role}
                          </span>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                          {user.balance.toFixed(2)} Birr
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            user.is_active
                              ? 'bg-green-600 text-green-100'
                              : 'bg-red-600 text-red-100'
                          }`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                          {user.cartelaCount !== undefined ? (
                            user.cartelaCount > 0 ? (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-600 text-green-100">
                                {user.cartelaCount} Cartelas
                              </span>
                            ) : (
                              <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-600 text-orange-100">
                                No Cartelas
                              </span>
                            )
                          ) : (
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-gray-600 text-gray-100">
                              Loading...
                            </span>
                          )}
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm text-slate-300">
                          {formatDate(user.createdAt)}
                        </td>
                        <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() => handleUsernameClick(user.id)}
                              className="text-blue-400 hover:text-blue-300 transition-colors"
                              title="View assigned cartelas"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => openCartelaAssignModal(user)}
                              className="text-green-400 hover:text-green-300 transition-colors"
                              title="Assign cartelas"
                            >
                              <Plus className="h-4 w-4" />
                            </button>
                            {user.cartelaCount && user.cartelaCount > 0 && (
                              <button
                                onClick={() => handleDeleteAllCartelas(user.id, user.username)}
                                className="text-orange-400 hover:text-orange-300 transition-colors"
                                title="Delete all assigned cartelas"
                              >
                                <RefreshCw className="h-4 w-4" />
                              </button>
                            )}
                            <button
                              onClick={() => openPasswordModal(user.id)}
                              className="text-purple-400 hover:text-purple-300 transition-colors"
                              title="Update password"
                            >
                              <Lock className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleToggleBan(user.id, user.username, user.is_active)}
                              className={`${
                                user.is_active 
                                  ? 'text-orange-400 hover:text-orange-300' 
                                  : 'text-green-400 hover:text-green-300'
                              } transition-colors`}
                              title={user.is_active ? 'Ban user' : 'Unban user'}
                              disabled={user.id === currentUser?.id}
                            >
                              {user.is_active ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                            </button>
                            <button
                              onClick={() => handleDeleteUser(user.id, user.username)}
                              className="text-red-400 hover:text-red-300 transition-colors"
                              title="Delete user and all data"
                              disabled={user.id === currentUser?.id}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card View - Visible only on Mobile */}
              <div className="md:hidden divide-y divide-slate-700">
                {filteredUsers.map((user) => (
                  <div key={user.id} className="p-4">
                    {/* Header Row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => handleUsernameClick(user.id)}
                          className="text-base font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer truncate block text-left"
                          title="Click to view assigned cartelas"
                        >
                          {user.username}
                        </button>
                        <p className="text-xs text-slate-400 truncate">{user.email}</p>
                        {user.shopname && (
                          <p className="text-xs text-slate-500 truncate mt-0.5">{user.shopname}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.role === 'admin'
                            ? 'bg-purple-600 text-purple-100'
                            : 'bg-green-600 text-green-100'
                        }`}>
                          {user.role}
                        </span>
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          user.is_active
                            ? 'bg-green-600 text-green-100'
                            : 'bg-red-600 text-red-100'
                        }`}>
                          {user.is_active ? 'Active' : 'Banned'}
                        </span>
                      </div>
                    </div>

                    {/* Info Grid */}
                    <div className="grid grid-cols-3 gap-3 mb-3 text-sm">
                      <div>
                        <p className="text-xs text-slate-400">Balance</p>
                        <p className="text-slate-200 font-medium">{user.balance.toFixed(2)} Birr</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Cartelas</p>
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-orange-600 text-orange-100">
                          None
                        </span>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Created</p>
                        <p className="text-slate-200 text-xs">{formatDate(user.createdAt)}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-3 border-t border-slate-700">
                      <button
                        onClick={() => handleUsernameClick(user.id)}
                        className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                        title="View cartelas"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View</span>
                      </button>
                      <button
                        onClick={() => openCartelaAssignModal(user)}
                        className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                        title="Assign cartelas"
                      >
                        <Plus className="h-4 w-4" />
                        <span>Assign</span>
                      </button>
                      <button
                        onClick={() => openPasswordModal(user.id)}
                        className="flex-1 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2"
                        title="Update password"
                      >
                        <Lock className="h-4 w-4" />
                        <span>Password</span>
                      </button>
                      <button
                        onClick={() => handleToggleBan(user.id, user.username, user.is_active)}
                        className={`flex-1 px-3 py-2 text-white text-sm rounded-lg transition-colors flex items-center justify-center gap-2 ${
                          user.is_active 
                            ? 'bg-orange-600 hover:bg-orange-700' 
                            : 'bg-green-600 hover:bg-green-700'
                        }`}
                        title={user.is_active ? 'Ban user' : 'Unban user'}
                        disabled={user.id === currentUser?.id}
                      >
                        {user.is_active ? <Ban className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                        <span>{user.is_active ? 'Ban' : 'Unban'}</span>
                      </button>
                      <button
                        onClick={() => handleDeleteUser(user.id, user.username)}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg transition-colors flex items-center justify-center"
                        title="Delete user and all data"
                        disabled={user.id === currentUser?.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Update Password Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6">
                <h3 className="text-lg font-medium text-white mb-4">Update User Password</h3>

                <div className="space-y-4">
                  <div>
                    <label htmlFor="newPassword" className="block text-sm font-medium text-slate-300 mb-1">
                      New Password *
                    </label>
                    <input
                      type="password"
                      id="newPassword"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                      placeholder="Enter new password (min 6 characters)"
                    />
                  </div>

                  {passwordError && (
                    <div className="p-3 bg-red-600/20 border border-red-600 rounded-lg">
                      <p className="text-sm text-red-400">{passwordError}</p>
                    </div>
                  )}

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordModal(false);
                        setPasswordUserId(null);
                        setNewPassword('');
                        setPasswordError('');
                      }}
                      className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdatePassword}
                      className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors"
                    >
                      Update Password
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create User Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6">
                <h3 className="text-lg font-medium text-white mb-4">Create New User</h3>

                <form onSubmit={handleCreateUser} className="space-y-4">
                  <div>
                    <label htmlFor="username" className="block text-sm font-medium text-slate-300 mb-1">
                      Username *
                    </label>
                    <input
                      type="text"
                      id="username"
                      name="username"
                      value={formData.username}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                      placeholder="Enter username"
                    />
                  </div>

                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                      placeholder="Enter email"
                    />
                  </div>

                  <div>
                    <label htmlFor="shopname" className="block text-sm font-medium text-slate-300 mb-1">
                      Shop Name
                    </label>
                    <input
                      type="text"
                      id="shopname"
                      name="shopname"
                      value={formData.shopname}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                      placeholder="Enter shop name (optional)"
                    />
                  </div>

                  <div>
                    <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
                      Password *
                    </label>
                    <input
                      type="password"
                      id="password"
                      name="password"
                      value={formData.password}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                      placeholder="Enter password"
                    />
                  </div>

                  <div>
                    <label htmlFor="role" className="block text-sm font-medium text-slate-300 mb-1">
                      Role
                    </label>
                    <select
                      id="role"
                      name="role"
                      value={formData.role}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="userType" className="block text-sm font-medium text-slate-300 mb-1">
                      User Type *
                    </label>
                    <select
                      id="userType"
                      name="userType"
                      value={formData.userType}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                    >
                      <option value="prepaid">Prepaid</option>
                      <option value="postpaid">Postpaid</option>
                    </select>
                  </div>

                  {formData.userType === 'prepaid' && (
                    <div>
                      <label htmlFor="balance" className="block text-sm font-medium text-slate-300 mb-1">
                        Initial Balance * (Birr)
                      </label>
                      <input
                        type="number"
                        id="balance"
                        name="balance"
                        value={formData.balance || 0}
                        onChange={handleInputChange}
                        required
                        min="0"
                        step="0.01"
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                        placeholder="Enter initial balance"
                      />
                      <p className="text-xs text-slate-400 mt-1">Prepaid users can only spend up to their balance</p>
                    </div>
                  )}

                  {formData.userType === 'postpaid' && (
                    <div>
                      <p className="text-sm text-slate-300 p-3 bg-slate-700 rounded-lg border border-slate-600">
                        <span className="font-medium">Postpaid Account:</span> This user will have unlimited credit. Their balance will go negative as they play games.
                      </p>
                    </div>
                  )}

                  {/* Voice Category Assignment */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Voice Category *
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          console.log('🔵 Boy voice selected');
                          setFormData(prev => ({ ...prev, voiceCategory: 'boy' }));
                        }}
                        className={`px-4 py-3 rounded-lg border-2 transition-colors flex items-center justify-center gap-2 ${
                          formData.voiceCategory === 'boy'
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        👦 Boy Voice
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          console.log('🔴 Girl voice selected');
                          setFormData(prev => ({ ...prev, voiceCategory: 'girl' }));
                        }}
                        className={`px-4 py-3 rounded-lg border-2 transition-colors flex items-center justify-center gap-2 ${
                          formData.voiceCategory === 'girl'
                            ? 'bg-pink-600 border-pink-500 text-white'
                            : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        👧 Girl Voice
                      </button>
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                      User will only hear this voice category during gameplay. Cartelas will be assigned separately after user creation.
                      <br />
                      <span className="text-yellow-400">Current selection: {formData.voiceCategory || 'none'}</span>
                    </p>
                  </div>

                  {formErrors.length > 0 && (
                    <div className="p-3 bg-red-600/20 border border-red-600 rounded-lg">
                      <ul className="text-sm text-red-400 space-y-1">
                        {formErrors.map((error, index) => (
                          <li key={index}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                    >
                      {submitting ? 'Creating...' : 'Create User'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Cartela Viewing Modal */}
        {showCartelaModal && selectedUserCartelas && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-6xl max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-medium text-white">
                      Assigned Cartelas - {selectedUserCartelas.user.username}
                    </h3>
                    <p className="text-sm text-slate-400">
                      {selectedUserCartelas.user.email} • {selectedUserCartelas.total} cartelas
                      {selectedUserCartelas.range && (
                        <span> • Range: {selectedUserCartelas.range.start}-{selectedUserCartelas.range.end}</span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowCartelaModal(false);
                      setSelectedUserCartelas(null);
                    }}
                    className="text-slate-400 hover:text-white transition-colors"
                  >
                    ✕
                  </button>
                </div>

                {selectedUserCartelas.cartelas.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-slate-400 mb-2">No cartelas assigned</div>
                    <p className="text-sm text-slate-500 mb-4">
                      This user has no cartelas assigned to them. Use the "Assign Cartelas" button to add cartelas.
                    </p>
                    <button
                      onClick={() => {
                        setShowCartelaModal(false);
                        setSelectedUserCartelas(null);
                        if (selectedUserCartelas?.user) {
                          const user = users.find(u => u.id === selectedUserCartelas.user.id);
                          if (user) {
                            openCartelaAssignModal(user);
                          }
                        }
                      }}
                      className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 mx-auto"
                    >
                      <Plus className="h-4 w-4" />
                      Assign Cartelas Now
                    </button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Cartela Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {selectedUserCartelas.cartelas.slice(0, 20).map((cartela) => (
                        <div
                          key={cartela.id}
                          className="bg-slate-700 rounded-lg p-3 border border-slate-600"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-white">
                              Card #{cartela.card_id}
                            </span>
                            <div className="flex items-center gap-1">
                              {cartela.is_winner && (
                                <span className="text-xs bg-yellow-600 text-yellow-100 px-1.5 py-0.5 rounded">
                                  Winner
                                </span>
                              )}
                              <span className={`text-xs px-1.5 py-0.5 rounded ${
                                cartela.is_active 
                                  ? 'bg-green-600 text-green-100' 
                                  : 'bg-red-600 text-red-100'
                              }`}>
                                {cartela.is_active ? 'Active' : 'Inactive'}
                              </span>
                            </div>
                          </div>
                          
                          {/* BINGO Card Preview */}
                          <div className="bg-slate-800 rounded p-2">
                            <div className="grid grid-cols-5 gap-1 text-xs">
                              {/* Header */}
                              <div className="text-center font-bold text-red-400">B</div>
                              <div className="text-center font-bold text-blue-400">I</div>
                              <div className="text-center font-bold text-green-400">N</div>
                              <div className="text-center font-bold text-yellow-400">G</div>
                              <div className="text-center font-bold text-purple-400">O</div>
                              
                              {/* Numbers */}
                              {[0, 1, 2, 3, 4].map(row => (
                                <React.Fragment key={row}>
                                  <div className="text-center text-slate-300 py-0.5">
                                    {cartela.numbers.B[row]}
                                  </div>
                                  <div className="text-center text-slate-300 py-0.5">
                                    {cartela.numbers.I[row]}
                                  </div>
                                  <div className="text-center text-slate-300 py-0.5">
                                    {cartela.numbers.N[row]}
                                  </div>
                                  <div className="text-center text-slate-300 py-0.5">
                                    {cartela.numbers.G[row]}
                                  </div>
                                  <div className="text-center text-slate-300 py-0.5">
                                    {cartela.numbers.O[row]}
                                  </div>
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                          
                          <div className="mt-2 text-xs text-slate-400">
                            Assigned: {new Date(cartela.created_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>

                    {selectedUserCartelas.cartelas.length > 20 && (
                      <div className="text-center py-4 border-t border-slate-600">
                        <p className="text-sm text-slate-400">
                          Showing first 20 of {selectedUserCartelas.total} cartelas
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Full range: {selectedUserCartelas.range?.start}-{selectedUserCartelas.range?.end}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end pt-4 border-t border-slate-600 mt-6">
                  <button
                    onClick={() => {
                      setShowCartelaModal(false);
                      setSelectedUserCartelas(null);
                    }}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Loading Cartelas Overlay */}
        {loadingCartelas && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-slate-800 rounded-lg p-6 border border-slate-700">
              <div className="flex items-center space-x-3">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400"></div>
                <span className="text-white">Loading cartelas...</span>
              </div>
            </div>
          </div>
        )}

        {/* Progress Modal */}
        {showProgressModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-md">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-white">Creating User</h3>
                  {progressComplete && !progressError && (
                    <button
                      onClick={() => setShowProgressModal(false)}
                      className="text-slate-400 hover:text-white transition-colors"
                    >
                      ✕
                    </button>
                  )}
                </div>

                <div className="space-y-4">
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-300">
                        {creationProgress.phase === 'copying' ? 'Copying Cartelas' : 
                         creationProgress.phase === 'validation' ? 'Validating Data' :
                         creationProgress.phase === 'checking' ? 'Checking Existing Users' :
                         creationProgress.phase === 'validating_cartelas' ? 'Validating Cartelas' :
                         creationProgress.phase === 'creating_user' ? 'Creating User Account' :
                         creationProgress.phase === 'setting_voice' ? 'Setting Voice Category' :
                         creationProgress.phase === 'logging' ? 'Creating Admin Log' :
                         creationProgress.phase === 'completed' ? 'Completed' :
                         'Processing...'}
                      </span>
                      <span className="text-slate-400">
                        {creationProgress.percentage > 0 ? `${creationProgress.percentage}%` : ''}
                      </span>
                    </div>
                    
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full transition-all duration-300 ${
                          progressError ? 'bg-red-500' : 
                          progressComplete ? 'bg-green-500' : 'bg-blue-500'
                        }`}
                        style={{ 
                          width: `${Math.max(creationProgress.percentage, progressError ? 100 : 5)}%` 
                        }}
                      ></div>
                    </div>
                  </div>

                  {/* Progress Message */}
                  <div className="text-sm text-slate-300">
                    {progressError ? (
                      <div className="text-red-400">
                        ❌ {progressError}
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        {!progressComplete && (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                        )}
                        <span>
                          {progressComplete && !progressError ? '✅ ' : ''}
                          {creationProgress.message}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Progress Details for Cartela Copying */}
                  {creationProgress.phase === 'copying' && creationProgress.total > 0 && (
                    <div className="text-xs text-slate-400 bg-slate-700 p-3 rounded">
                      <div className="flex justify-between">
                        <span>Cartelas Copied:</span>
                        <span>{creationProgress.current} / {creationProgress.total}</span>
                      </div>
                      <div className="mt-1 text-slate-500">
                        This may take a moment for large ranges...
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end pt-4 border-t border-slate-600">
                    {progressError ? (
                      <div className="flex space-x-3">
                        <button
                          onClick={() => {
                            setShowProgressModal(false);
                            setShowCreateModal(true);
                          }}
                          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors"
                        >
                          Try Again
                        </button>
                        <button
                          onClick={() => setShowProgressModal(false)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                        >
                          Close
                        </button>
                      </div>
                    ) : progressComplete ? (
                      <button
                        onClick={() => setShowProgressModal(false)}
                        className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Done
                      </button>
                    ) : (
                      <button
                        onClick={() => {
                          setShowProgressModal(false);
                          setShowCreateModal(true);
                        }}
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Troubleshooting Modal */}
        {showTroubleshootModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6">
                <h3 className="text-lg font-medium text-white mb-4">Network Connection Troubleshooting</h3>

                <div className="space-y-4 text-sm text-slate-300">
                  <div>
                    <h4 className="font-medium text-white mb-2">Common Issues & Solutions:</h4>
                    
                    <div className="space-y-3">
                      <div className="p-3 bg-slate-700 rounded-lg">
                        <h5 className="font-medium text-orange-400 mb-1">ERR_QUIC_PROTOCOL_ERROR</h5>
                        <p className="mb-2">This Chrome-specific error occurs with HTTP/3 protocol issues.</p>
                        <p className="font-medium">Solutions:</p>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          <li>Try refreshing the page (Ctrl+F5 or Cmd+Shift+R)</li>
                          <li>Clear browser cache and cookies</li>
                          <li>Try in an incognito/private window</li>
                          <li>Try a different browser (Firefox, Safari, Edge)</li>
                        </ul>
                      </div>

                      <div className="p-3 bg-slate-700 rounded-lg">
                        <h5 className="font-medium text-blue-400 mb-1">Server Unavailable</h5>
                        <p className="mb-2">The backend server may be temporarily down.</p>
                        <p className="font-medium">Possible causes:</p>
                        <ul className="list-disc list-inside mt-1 space-y-1">
                          <li>Server maintenance or deployment</li>
                          <li>Render free tier sleep mode (takes ~30s to wake up)</li>
                          <li>High server load or resource limits</li>
                          <li>Network connectivity issues</li>
                        </ul>
                      </div>

                      <div className="p-3 bg-slate-700 rounded-lg">
                        <h5 className="font-medium text-green-400 mb-1">Quick Fixes</h5>
                        <ul className="list-disc list-inside space-y-1">
                          <li>Wait 30-60 seconds and try again</li>
                          <li>Check your internet connection</li>
                          <li>Disable VPN if using one</li>
                          <li>Try from a different network (mobile hotspot)</li>
                          <li>Contact support if issue persists</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-slate-600 pt-4">
                    <h4 className="font-medium text-white mb-2">Technical Details:</h4>
                    <div className="bg-slate-900 p-3 rounded font-mono text-xs">
                      <p>Backend URL: {API_BASE_URL}</p>
                      <p>Status: {backendStatus}</p>
                      <p>Browser: {navigator.userAgent.split(' ').slice(-2).join(' ')}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-4">
                  <button
                    onClick={() => setShowTroubleshootModal(false)}
                    className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Cartela Assignment Modal */}
        {showCartelaAssignModal && selectedUserForCartelas && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-slate-800 rounded-lg border border-slate-700 w-full max-w-md max-h-[90vh] overflow-y-auto">
              <div className="p-4 sm:p-6">
                <h3 className="text-lg font-medium text-white mb-4">
                  Assign Cartelas - {selectedUserForCartelas.username}
                </h3>

                <div className="space-y-4">
                  {/* Assignment Type Selection */}
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                      Assignment Method
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setAssignmentType('copy')}
                        className={`px-4 py-3 rounded-lg border-2 transition-colors flex items-center justify-center gap-2 ${
                          assignmentType === 'copy'
                            ? 'bg-blue-600 border-blue-500 text-white'
                            : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        📋 Copy Range
                      </button>
                      <button
                        type="button"
                        onClick={() => setAssignmentType('upload')}
                        className={`px-4 py-3 rounded-lg border-2 transition-colors flex items-center justify-center gap-2 ${
                          assignmentType === 'upload'
                            ? 'bg-green-600 border-green-500 text-white'
                            : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        📄 Upload PDF
                      </button>
                    </div>
                  </div>

                  {/* Copy Range Options */}
                  {assignmentType === 'copy' && (
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-2">
                        Cartela Range to Copy
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="copyRangeStart" className="block text-xs text-slate-400 mb-1">
                            Start Card ID
                          </label>
                          <input
                            type="number"
                            id="copyRangeStart"
                            value={copyRangeStart}
                            onChange={(e) => setCopyRangeStart(parseInt(e.target.value) || 1)}
                            min="1"
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                            placeholder="e.g., 1"
                          />
                        </div>
                        <div>
                          <label htmlFor="copyRangeEnd" className="block text-xs text-slate-400 mb-1">
                            End Card ID
                          </label>
                          <input
                            type="number"
                            id="copyRangeEnd"
                            value={copyRangeEnd}
                            onChange={(e) => setCopyRangeEnd(parseInt(e.target.value) || 50)}
                            min="1"
                            className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                            placeholder="e.g., 50"
                          />
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Will copy cartelas {copyRangeStart}-{copyRangeEnd} ({copyRangeEnd - copyRangeStart + 1} cartelas)
                      </p>
                    </div>
                  )}

                  {/* Upload PDF Options */}
                  {assignmentType === 'upload' && (
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="uploadFile" className="block text-sm font-medium text-slate-300 mb-1">
                          PDF File
                        </label>
                        <input
                          type="file"
                          id="uploadFile"
                          accept=".pdf"
                          onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                          Select a PDF file containing cartela layouts
                        </p>
                      </div>
                      <div>
                        <label htmlFor="uploadCount" className="block text-sm font-medium text-slate-300 mb-1">
                          Number of Cartelas to Extract
                        </label>
                        <input
                          type="number"
                          id="uploadCount"
                          value={uploadCount}
                          onChange={(e) => setUploadCount(parseInt(e.target.value) || 50)}
                          min="1"
                          max="1000"
                          className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:border-blue-500 focus:outline-none"
                          placeholder="e.g., 50"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                          Maximum number of cartelas to extract from the PDF
                        </p>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="p-3 bg-red-600/20 border border-red-600 rounded-lg">
                      <p className="text-sm text-red-400">{error}</p>
                    </div>
                  )}

                  <div className="flex space-x-3 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setShowCartelaAssignModal(false);
                        setSelectedUserForCartelas(null);
                        setError('');
                      }}
                      className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleAssignCartelas}
                      disabled={assigningCartelas || (assignmentType === 'upload' && !uploadFile)}
                      className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                    >
                      {assigningCartelas ? 'Assigning...' : 'Assign Cartelas'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminUserManagement;
