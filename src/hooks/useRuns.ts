import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { Run, RunMode, LogEntry } from '@/lib/types';

export function useRuns() {
  const { user } = useAuth();
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRuns = useCallback(async () => {
    if (!user) return;
    
    const { data, error } = await supabase
      .from('runs')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Transform the data to match our Run type
      const transformedRuns: Run[] = data.map(row => ({
        ...row,
        mode: row.mode as RunMode,
        status: row.status as Run['status'],
        log: (row.log as unknown) as LogEntry[] | null
      }));
      setRuns(transformedRuns);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  const createRun = async (file: File, mode: RunMode): Promise<string | null> => {
    if (!user) return null;

    // Create run record
    const { data: run, error: runError } = await supabase
      .from('runs')
      .insert({
        user_id: user.id,
        mode,
        status: 'QUEUED',
        input_filename: file.name,
        log: [],
      })
      .select()
      .single();

    if (runError || !run) {
      console.error('Error creating run:', runError);
      return null;
    }

    // Upload file to storage
    const filePath = `${user.id}/${run.id}/${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from('sales-input')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      // Update run with error
      await supabase
        .from('runs')
        .update({ 
          status: 'ERROR', 
          error_message: 'Ошибка загрузки файла: ' + uploadError.message 
        })
        .eq('id', run.id);
      return null;
    }

    // Update run with file path
    await supabase
      .from('runs')
      .update({ input_file_path: filePath })
      .eq('id', run.id);

    await fetchRuns();
    return run.id;
  };

  const getRun = async (id: string): Promise<Run | null> => {
    const { data, error } = await supabase
      .from('runs')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error || !data) return null;
    
    return {
      ...data,
      mode: data.mode as RunMode,
      status: data.status as Run['status'],
      log: (data.log as unknown) as LogEntry[] | null
    };
  };

  const updateRunStatus = async (
    id: string, 
    status: Run['status'], 
    updates?: Partial<Run>
  ) => {
    const updateData: Record<string, unknown> = { status, ...updates };
    
    await supabase
      .from('runs')
      .update(updateData)
      .eq('id', id);
    
    await fetchRuns();
  };

  const deleteRun = async (id: string) => {
    const run = runs.find(r => r.id === id);
    if (!run || !user) return;

    // Delete files from storage
    if (run.input_file_path) {
      await supabase.storage.from('sales-input').remove([run.input_file_path]);
    }
    if (run.processed_file_path) {
      await supabase.storage.from('sales-processed').remove([run.processed_file_path]);
    }
    if (run.result_file_path) {
      await supabase.storage.from('sales-results').remove([run.result_file_path]);
    }

    // Delete run record
    await supabase.from('runs').delete().eq('id', id);
    await fetchRuns();
  };

  const getDownloadUrl = async (bucket: string, path: string): Promise<string | null> => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, 3600); // 1 hour expiry

    if (error) {
      console.error('Error getting download URL:', error);
      return null;
    }
    return data.signedUrl;
  };

  return {
    runs,
    loading,
    createRun,
    getRun,
    updateRunStatus,
    deleteRun,
    getDownloadUrl,
    refetch: fetchRuns,
  };
}