-- Add approval status to profiles
ALTER TABLE public.profiles 
ADD COLUMN approval_status text NOT NULL DEFAULT 'pending' 
CHECK (approval_status IN ('pending', 'approved', 'rejected'));

-- Update existing profiles to approved (they were already in the system)
UPDATE public.profiles SET approval_status = 'approved' WHERE approval_status = 'pending';

-- Add index for faster filtering
CREATE INDEX idx_profiles_approval_status ON public.profiles(approval_status);