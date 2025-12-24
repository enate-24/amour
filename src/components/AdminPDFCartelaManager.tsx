import React, { useState, useEffect } from 'react';
import { Upload, FileText, Download, Users, Eye, Trash2, AlertCircle, CheckCircle } from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

interface PDFFile {
  filename: string;
  size: number;
  uploadedAt: string;
  modifiedAt: string;
}

interface CartelaPreview {
  card_id: string;
  numbers: {
    B: number[];
    I: number[];
    N: (number | string)[];
    G: number[];
    O: number[];
  };
}

interface AssignmentPreview {
  range: string;
  totalAvailable: number;
  expectedCount: number;
  missingCount: number;
  sampleCartelas: CartelaPreview[];
  isValid: boolean;
}

const AdminPDFCartelaManager: React.FC = () => {
  const [pdfFiles, setPdfFiles] = useState<PDFFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  // Progress tracking states
  const [showProgress, setShowProgress] = useState(false);
  const [progressData, setProgressData] = useState({
    phase: '',
    message: '',
    progress: 0,
    current: 0,
    total: 0,
    extracted: 0,
    saved: 0
  });
  
  // PDF Processing states
  const [selectedPDF, setSelectedPDF] = useState('');
  const [cartelaCount, setCartelaCount] = useState(50);
  const [startCardId, setStartCardId] = useState(2001);
  
  // User assignment states
  const [assignToUser, setAssignToUser] = useState(false);
  const [assignUserId, setAssignUserId] = useState('');
  const [replaceExisting, setReplaceExisting] = useState(false);
  
  // Assignment states
  const [assignmentUserId, setAssignmentUserId] = useState('');
  const [assignmentStart, setAssignmentStart] = useState(2001);
  const [assignmentEnd, setAssignmentEnd] = useState(2050);
  const [replaceExisting, setReplaceExisting] = useState(false);
  const [assignmentPreview, setAssignmentPreview] = useState<AssignmentPreview | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchPDFFiles();
  }, []);

  const fetchPDFFiles = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('auth_token');
      
      const response = await fetch(`${API_BASE_URL}/admin/pdf-files`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        setPdfFiles(data.files || []);
      } else {
        setError('Failed to fetch PDF files');
      }
    } catch (err) {
      setError('Error fetching PDF files');
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile) return;

    try {
      setUploading(true);
      setError('');

      const formData = new FormData();
      formData.append('pdf', selectedFile);

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/admin/upload-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        await fetchPDFFiles();
        setSelectedFile(null);
        // Reset file input
        const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to upload PDF');
      }
    } catch (err) {
      setError('Error uploading PDF file');
    } finally {
      setUploading(false);
    }
  };

  const handleProcessPDF = async () => {
    if (!selectedPDF) return;

    try {
      setProcessing(true);
      setError('');
      setShowProgress(true);
      setProgressData({
        phase: 'starting',
        message: 'Initializing...',
        progress: 0,
        current: 0,
        total: 0,
        extracted: 0,
        saved: 0
      });

      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/admin/process-pdf-cartelas-with-progress`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filename: selectedPDF,
          count: cartelaCount,
          startCardId: startCardId,
          assignToUserId: assignUserId,
          replaceExisting: replaceExisting
        })
      });

      if (!response.ok) {
        throw new Error('Failed to start PDF processing');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'progress') {
                  setProgressData(prev => ({
                    ...prev,
                    phase: data.phase || prev.phase,
                    message: data.message || prev.message,
                    progress: data.progress || prev.progress,
                    current: data.current || prev.current,
                    total: data.total || prev.total,
                    extracted: data.extracted || prev.extracted,
                    saved: data.saved || prev.saved
                  }));
                } else if (data.type === 'success') {
                  setProgressData(prev => ({
                    ...prev,
                    phase: 'completed',
                    message: data.message,
                    progress: 100,
                    extracted: data.extracted,
                    saved: data.saved
                  }));
                  
                  setTimeout(() => {
                    const successMessage = `✅ Successfully processed PDF and saved cartelas to user!\n\nExtracted: ${data.extracted} cartelas\nSaved to user: ${data.saved} cartelas\nUser: ${data.assignment.user.username}\nCard Range: ${data.assignment.cardRange}\n\n${data.errors.length > 0 ? `Errors: ${data.errors.length}` : 'No errors'}`;
                    
                    alert(successMessage);
                    setShowProgress(false);
                  }, 1000);
                } else if (data.type === 'error') {
                  setError(data.message || 'Failed to process PDF');
                  setShowProgress(false);
                }
              } catch (parseError) {
                console.error('Error parsing progress data:', parseError);
              }
            }
          }
        }
      }

    } catch (err) {
      setError('Error processing PDF file');
      setShowProgress(false);
    } finally {
      setProcessing(false);
    }
  };

  const handlePreviewAssignment = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/admin/preview-cartela-assignment`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          startCardId: assignmentStart,
          endCardId: assignmentEnd
        })
      });

      if (response.ok) {
        const data = await response.json();
        setAssignmentPreview(data);
        setShowPreview(true);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to preview assignment');
      }
    } catch (err) {
      setError('Error previewing assignment');
    }
  };

  const handleAssignCartelas = async () => {
    if (!assignmentUserId) {
      setError('Please enter a user ID');
      return;
    }

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/admin/assign-cartelas-to-user`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId: assignmentUserId,
          startCardId: assignmentStart,
          endCardId: assignmentEnd,
          replaceExisting
        })
      });

      const data = await response.json();

      if (response.ok) {
        alert(`✅ Successfully assigned cartelas!\n\nUser: ${data.user.username}\nRange: ${data.assignedCartelas.range}\nCount: ${data.assignedCartelas.count}`);
        setShowPreview(false);
        setAssignmentPreview(null);
      } else {
        setError(data.error || 'Failed to assign cartelas');
      }
    } catch (err) {
      setError('Error assigning cartelas');
    }
  };

  const handleDeletePDF = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete ${filename}?`)) return;

    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/admin/pdf-files/${filename}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await fetchPDFFiles();
      } else {
        setError('Failed to delete PDF file');
      }
    } catch (err) {
      setError('Error deleting PDF file');
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <FileText className="h-8 w-8 text-yellow-400" />
          <h1 className="text-3xl font-bold text-white">PDF Cartela Manager</h1>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-600/20 border border-red-600 rounded-lg text-red-400">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Left Column - PDF Upload & Processing */}
          <div className="space-y-6">
            {/* PDF Upload */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Upload className="h-5 w-5 text-blue-400" />
                Upload PDF
              </h2>
              
              <div className="space-y-4">
                <div>
                  <input
                    id="pdf-upload"
                    type="file"
                    accept=".pdf"
                    onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
                  />
                </div>
                
                <button
                  onClick={handleFileUpload}
                  disabled={!selectedFile || uploading}
                  className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                >
                  {uploading ? 'Uploading...' : 'Upload PDF'}
                </button>
              </div>
            </div>

            {/* PDF Processing */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Download className="h-5 w-5 text-green-400" />
                Process PDF
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Select PDF File
                  </label>
                  <select
                    value={selectedPDF}
                    onChange={(e) => setSelectedPDF(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                  >
                    <option value="">Choose a PDF file...</option>
                    {pdfFiles.map((file) => (
                      <option key={file.filename} value={file.filename}>
                        {file.filename} ({formatFileSize(file.size)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Cartela Count
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="1000"
                      value={cartelaCount}
                      onChange={(e) => setCartelaCount(parseInt(e.target.value) || 50)}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Start Card ID
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={startCardId}
                      onChange={(e) => setStartCardId(parseInt(e.target.value) || 2001)}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                    />
                  </div>
                </div>

                {/* User Assignment Section - Now Required */}
                <div className="border-t border-slate-600 pt-4">
                  <div className="mb-4">
                    <h4 className="text-sm font-medium text-slate-300 mb-2">
                      User Assignment (Required)
                    </h4>
                    <p className="text-xs text-slate-400 mb-3">
                      Cartelas will be saved directly to the specified user. When the user is deleted, their cartelas are automatically removed.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-300 mb-1">
                        User ID *
                      </label>
                      <input
                        type="text"
                        value={assignUserId}
                        onChange={(e) => setAssignUserId(e.target.value)}
                        placeholder="Enter user ID (required)..."
                        className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                        required
                      />
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id="replace-existing-cartelas"
                        checked={replaceExisting}
                        onChange={(e) => setReplaceExisting(e.target.checked)}
                        className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
                      />
                      <label htmlFor="replace-existing-cartelas" className="text-sm text-slate-300">
                        Replace existing cartelas for this user
                      </label>
                    </div>
                  </div>
                </div>

                <button
                  onClick={handleProcessPDF}
                  disabled={!selectedPDF || processing || !assignUserId.trim()}
                  className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                >
                  {processing ? 'Processing...' : 'Process PDF & Save to User'}
                </button>
                
                {!assignUserId.trim() && (
                  <p className="text-xs text-red-400 mt-2">
                    User ID is required to process PDF
                  </p>
                )}
              </div>
            </div>

            {/* Progress Modal */}
            {showProgress && (
              <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                <div className="bg-slate-800 rounded-lg border border-slate-700 p-6 max-w-md w-full mx-4">
                  <h3 className="text-lg font-semibold text-white mb-4">Processing PDF</h3>
                  
                  {/* Progress Bar */}
                  <div className="mb-4">
                    <div className="flex justify-between text-sm text-slate-300 mb-2">
                      <span>Progress</span>
                      <span>{progressData.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-700 rounded-full h-2">
                      <div 
                        className="bg-green-600 h-2 rounded-full transition-all duration-300 ease-out"
                        style={{ width: `${progressData.progress}%` }}
                      ></div>
                    </div>
                  </div>

                  {/* Status Message */}
                  <div className="mb-4">
                    <p className="text-sm text-slate-300 mb-2">Status:</p>
                    <p className="text-white">{progressData.message}</p>
                  </div>

                  {/* Phase Indicators */}
                  <div className="space-y-2 mb-4">
                    <div className={`flex items-center gap-2 text-sm ${
                      progressData.phase === 'starting' || progressData.phase === 'reading' || 
                      progressData.phase === 'extracted' || progressData.phase === 'saving' || 
                      progressData.phase === 'completed' ? 'text-green-400' : 'text-slate-400'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${
                        progressData.phase === 'starting' || progressData.phase === 'reading' || 
                        progressData.phase === 'extracted' || progressData.phase === 'saving' || 
                        progressData.phase === 'completed' ? 'bg-green-400' : 'bg-slate-400'
                      }`}></div>
                      Reading PDF file
                    </div>
                    
                    <div className={`flex items-center gap-2 text-sm ${
                      progressData.phase === 'extracted' || progressData.phase === 'saving' || 
                      progressData.phase === 'completed' ? 'text-green-400' : 'text-slate-400'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${
                        progressData.phase === 'extracted' || progressData.phase === 'saving' || 
                        progressData.phase === 'completed' ? 'bg-green-400' : 'bg-slate-400'
                      }`}></div>
                      Extracting cartelas ({progressData.extracted} found)
                    </div>
                    
                    <div className={`flex items-center gap-2 text-sm ${
                      progressData.phase === 'saving' || progressData.phase === 'completed' ? 'text-green-400' : 'text-slate-400'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${
                        progressData.phase === 'saving' || progressData.phase === 'completed' ? 'bg-green-400' : 'bg-slate-400'
                      }`}></div>
                      Saving to user {assignUserId} ({progressData.current}/{progressData.total})
                    </div>
                    
                    <div className={`flex items-center gap-2 text-sm ${
                      progressData.phase === 'completed' ? 'text-green-400' : 'text-slate-400'
                    }`}>
                      <div className={`w-2 h-2 rounded-full ${
                        progressData.phase === 'completed' ? 'bg-green-400' : 'bg-slate-400'
                      }`}></div>
                      Completed ({progressData.saved} cartelas saved to user)
                    </div>
                  </div>

                  {/* Cancel Button (only show if not completed) */}
                  {progressData.phase !== 'completed' && (
                    <button
                      onClick={() => {
                        setShowProgress(false);
                        setProcessing(false);
                      }}
                      className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Right Column - Cartela Assignment */}
          <div className="space-y-6">
            {/* Cartela Assignment */}
            <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Users className="h-5 w-5 text-purple-400" />
                Assign Cartelas to User
              </h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    User ID
                  </label>
                  <input
                    type="text"
                    value={assignmentUserId}
                    onChange={(e) => setAssignmentUserId(e.target.value)}
                    placeholder="Enter user ID..."
                    className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      Start Card ID
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={assignmentStart}
                      onChange={(e) => setAssignmentStart(parseInt(e.target.value) || 2001)}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-slate-300 mb-1">
                      End Card ID
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={assignmentEnd}
                      onChange={(e) => setAssignmentEnd(parseInt(e.target.value) || 2050)}
                      className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="replace-existing"
                    checked={replaceExisting}
                    onChange={(e) => setReplaceExisting(e.target.checked)}
                    className="w-4 h-4 text-blue-600 bg-slate-700 border-slate-600 rounded focus:ring-blue-500"
                  />
                  <label htmlFor="replace-existing" className="text-sm text-slate-300">
                    Replace existing cartelas for this user
                  </label>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handlePreviewAssignment}
                    className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </button>
                  
                  <button
                    onClick={handleAssignCartelas}
                    disabled={!assignmentUserId}
                    className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-slate-600 text-white rounded-lg font-medium transition-colors"
                  >
                    Assign Cartelas
                  </button>
                </div>
              </div>
            </div>

            {/* Assignment Preview */}
            {showPreview && assignmentPreview && (
              <div className="bg-slate-800 rounded-lg border border-slate-700 p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Assignment Preview</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    {assignmentPreview.isValid ? (
                      <CheckCircle className="h-5 w-5 text-green-400" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-400" />
                    )}
                    <span className="text-slate-300">
                      Range: {assignmentPreview.range}
                    </span>
                  </div>
                  
                  <div className="text-sm text-slate-400 space-y-1">
                    <p>Expected: {assignmentPreview.expectedCount} cartelas</p>
                    <p>Available: {assignmentPreview.totalAvailable} cartelas</p>
                    {assignmentPreview.missingCount > 0 && (
                      <p className="text-red-400">Missing: {assignmentPreview.missingCount} cartelas</p>
                    )}
                  </div>

                  {assignmentPreview.sampleCartelas.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-slate-300 mb-2">Sample Cartelas:</p>
                      <div className="space-y-2">
                        {assignmentPreview.sampleCartelas.slice(0, 2).map((cartela) => (
                          <div key={cartela.card_id} className="bg-slate-700 rounded p-2">
                            <p className="text-xs text-slate-400 mb-1">Card #{cartela.card_id}</p>
                            <div className="grid grid-cols-5 gap-1 text-xs">
                              <div className="text-center text-red-400 font-bold">B</div>
                              <div className="text-center text-blue-400 font-bold">I</div>
                              <div className="text-center text-green-400 font-bold">N</div>
                              <div className="text-center text-yellow-400 font-bold">G</div>
                              <div className="text-center text-purple-400 font-bold">O</div>
                              {[0, 1, 2, 3, 4].map(row => (
                                <React.Fragment key={row}>
                                  <div className="text-center text-slate-300">{cartela.numbers.B[row]}</div>
                                  <div className="text-center text-slate-300">{cartela.numbers.I[row]}</div>
                                  <div className="text-center text-slate-300">{cartela.numbers.N[row]}</div>
                                  <div className="text-center text-slate-300">{cartela.numbers.G[row]}</div>
                                  <div className="text-center text-slate-300">{cartela.numbers.O[row]}</div>
                                </React.Fragment>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PDF Files List */}
        <div className="mt-8 bg-slate-800 rounded-lg border border-slate-700">
          <div className="p-6 border-b border-slate-700">
            <h2 className="text-xl font-semibold text-white">Uploaded PDF Files</h2>
          </div>
          
          <div className="p-6">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400 mx-auto mb-4"></div>
                <p className="text-slate-400">Loading PDF files...</p>
              </div>
            ) : pdfFiles.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="mx-auto h-12 w-12 text-slate-400 mb-4" />
                <p className="text-slate-400">No PDF files uploaded yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pdfFiles.map((file) => (
                  <div key={file.filename} className="flex items-center justify-between p-4 bg-slate-700 rounded-lg">
                    <div>
                      <p className="text-white font-medium">{file.filename}</p>
                      <p className="text-sm text-slate-400">
                        {formatFileSize(file.size)} • Uploaded {new Date(file.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeletePDF(file.filename)}
                      className="p-2 text-red-400 hover:text-red-300 hover:bg-red-600/20 rounded-lg transition-colors"
                      title="Delete PDF"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPDFCartelaManager;