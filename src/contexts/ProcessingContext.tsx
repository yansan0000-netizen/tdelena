import { createContext, useContext, useState, ReactNode } from 'react';

interface PendingProcessing {
  runId: string;
  file: File;
  mode: string;
}

interface ProcessingContextType {
  pendingProcessing: PendingProcessing | null;
  setPendingProcessing: (data: PendingProcessing | null) => void;
}

const ProcessingContext = createContext<ProcessingContextType | null>(null);

export function ProcessingProvider({ children }: { children: ReactNode }) {
  const [pendingProcessing, setPendingProcessing] = useState<PendingProcessing | null>(null);

  return (
    <ProcessingContext.Provider value={{ pendingProcessing, setPendingProcessing }}>
      {children}
    </ProcessingContext.Provider>
  );
}

export function useProcessingContext() {
  const context = useContext(ProcessingContext);
  if (!context) {
    throw new Error('useProcessingContext must be used within ProcessingProvider');
  }
  return context;
}
