export interface SessionRecord {
  referenceNumber: string;
  fullName: string;
  seatType: string;
  duration: string;
  amount: number;
  hourlyRate: number;
  bookingDate: string;
  startTime: string;
  endTime: string;
  status: 'PENDING SESSION' | 'ACTIVE' | 'EXPIRED' | 'AWAITING PAYMENT';
  paymentMethod?: 'CASH' | 'ONLINE';
  timestamp: string;
  activatedAt?: string;
  xenditInvoiceId?: string;
  xenditInvoiceUrl?: string;
  paidAt?: string;
  paymentConfirmed?: boolean;
}

export interface AppState {
  currentTab: 'avail' | 'check';
  paymentMethod: 'cash' | 'online';
  booking: {
    fullName: string;
    seatType: string;
    duration: string;
    hours: number;
    amount: number;
    bookingDate: string;
    startTime: string;
    endTime: string;
  };
  dbConnected: boolean;
}

export interface AdminState {
  clickCount: number;
  clickTimer: ReturnType<typeof setTimeout> | null;
  isAuthenticated: boolean;
  recordsCache: SessionRecord[];
  filteredCache: SessionRecord[];
  unsubscribe: ((snap: any) => void) | null;
  currentPage: number;
  pageSize: number;
}

export interface SessionTimes {
  startTime: string;
  endTime: string;
}
