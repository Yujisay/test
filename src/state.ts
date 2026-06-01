import { AppState, AdminState } from './types';
import { PAGE_SIZE } from './config';

export const state: AppState = {
  currentTab: 'avail',
  paymentMethod: 'cash',
  booking: {
    fullName: '', seatType: '', duration: '', hours: 0, amount: 0,
    bookingDate: new Date().toISOString().split('T')[0],
    startTime: '', endTime: ''
  },
  dbConnected: false
};

export const adminState: AdminState = {
  clickCount: 0,
  clickTimer: null,
  isAuthenticated: false,
  recordsCache: [],
  filteredCache: [],
  unsubscribe: null,
  currentPage: 1,
  pageSize: PAGE_SIZE
};
