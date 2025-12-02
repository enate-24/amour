import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface WebSocketEvents {
  numberCalled: (data: { calledNumber: number; totalCalled: number; remainingNumbers: number }) => void;
  gameStatusChanged: (data: { status: string; gameId: string }) => void;
  winnerDetected: (data: { winnerId: string; pattern: string }) => void;
  cartelaSelected: (data: { cartelaId: string; userId: string }) => void;
  bonusUpdate: (data: { amount: number; type: string }) => void;
  playerJoined: (data: { username: string; userId: string }) => void;
  playerLeft: (data: { username: string; userId: string }) => void;
}

interface UseWebSocketOptions {
  gameId?: string;
  onNumberCalled?: WebSocketEvents['numberCalled'];
  onGameStatusChanged?: WebSocketEvents['gameStatusChanged'];
  onWinnerDetected?: WebSocketEvents['winnerDetected'];
  onCartelaSelected?: WebSocketEvents['cartelaSelected'];
  onBonusUpdate?: WebSocketEvents['bonusUpdate'];
  onPlayerJoined?: WebSocketEvents['playerJoined'];
  onPlayerLeft?: WebSocketEvents['playerLeft'];
}

export function useWebSocket(options: UseWebSocketOptions = {}) {
  const socketRef = useRef<Socket | null>(null);
  const {
    gameId,
    onNumberCalled,
    onGameStatusChanged,
    onWinnerDetected,
    onCartelaSelected,
    onBonusUpdate,
    onPlayerJoined,
    onPlayerLeft
  } = options;

  const connect = useCallback(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      console.warn('⚠️ No auth token found, cannot connect to WebSocket');
      return;
    }

    // Get WebSocket URL from environment or construct from API URL
    let wsUrl: string;
    
    // Check for explicit WebSocket URL
    const WS_URL = import.meta.env.VITE_WS_URL;
    if (WS_URL) {
      wsUrl = WS_URL;
    } else {
      // Construct from API URL
      const API_URL = import.meta.env.VITE_API_URL || '/api';
      
      if (API_URL.startsWith('http')) {
        // External API - extract base URL
        const url = new URL(API_URL);
        wsUrl = `${url.protocol === 'https:' ? 'wss:' : 'ws:'}//${url.host}`;
      } else {
        // Local API - use localhost with default port
        wsUrl = 'http://localhost:10000';
      }
    }

    console.log('🔌 Connecting to WebSocket:', wsUrl);

    const socket = io(wsUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      console.log('✅ WebSocket connected:', socket.id);
      if (gameId) {
        socket.emit('joinGame', gameId);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ WebSocket disconnected:', reason);
    });

    socket.on('connect_error', (error) => {
      console.error('🔴 WebSocket connection error:', error.message);
    });

    socketRef.current = socket;
    return socket;
  }, [gameId]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      if (gameId) {
        socketRef.current.emit('leaveGame', gameId);
      }
      socketRef.current.disconnect();
      socketRef.current = null;
      console.log('🔌 WebSocket disconnected');
    }
  }, [gameId]);

  // Setup event listeners
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    if (onNumberCalled) {
      socket.on('numberCalled', onNumberCalled);
    }
    if (onGameStatusChanged) {
      socket.on('gameStatusChanged', onGameStatusChanged);
    }
    if (onWinnerDetected) {
      socket.on('winnerDetected', onWinnerDetected);
    }
    if (onCartelaSelected) {
      socket.on('cartelaSelected', onCartelaSelected);
    }
    if (onBonusUpdate) {
      socket.on('bonusUpdate', onBonusUpdate);
    }
    if (onPlayerJoined) {
      socket.on('playerJoined', onPlayerJoined);
    }
    if (onPlayerLeft) {
      socket.on('playerLeft', onPlayerLeft);
    }

    return () => {
      if (onNumberCalled) socket.off('numberCalled', onNumberCalled);
      if (onGameStatusChanged) socket.off('gameStatusChanged', onGameStatusChanged);
      if (onWinnerDetected) socket.off('winnerDetected', onWinnerDetected);
      if (onCartelaSelected) socket.off('cartelaSelected', onCartelaSelected);
      if (onBonusUpdate) socket.off('bonusUpdate', onBonusUpdate);
      if (onPlayerJoined) socket.off('playerJoined', onPlayerJoined);
      if (onPlayerLeft) socket.off('playerLeft', onPlayerLeft);
    };
  }, [
    onNumberCalled,
    onGameStatusChanged,
    onWinnerDetected,
    onCartelaSelected,
    onBonusUpdate,
    onPlayerJoined,
    onPlayerLeft
  ]);

  // Connect on mount, disconnect on unmount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return {
    socket: socketRef.current,
    connect,
    disconnect,
    isConnected: socketRef.current?.connected || false
  };
}
